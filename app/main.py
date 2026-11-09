from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.ai import ExtractionError, GroqExtractor
from app.config import Settings
from app.database import Database
from app.notifier import EmailNotifier, process_daily_jobs
from app.rules import RuleEngine
from app.schemas import (
    AnalyzeResponse,
    Deadline,
    DeadlineUpdate,
    DocumentDetail,
    DocumentSummary,
    HealthResponse,
)
from app.security import RateLimiter, prepare_image, redact_sensitive_text
from app.services import build_ics, deadlines_from_extraction


logger = logging.getLogger("paperguard")
DISCLAIMER = (
    "PaperGuard can make mistakes and is not legal or financial advice. "
    "Check every quote against the original document and consult a qualified professional for important decisions."
)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    database = Database(settings.database_path)
    rule_engine = RuleEngine(settings.rules_directory)
    extractor = GroqExtractor(settings)
    limiter = RateLimiter(settings.analyze_rate_limit_per_minute)
    scheduler: Any = None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal scheduler
        database.initialize()
        rule_engine.load()
        if settings.enable_scheduler:
            try:
                from apscheduler.schedulers.background import BackgroundScheduler

                notifier = EmailNotifier(settings)
                scheduler = BackgroundScheduler(timezone="UTC")
                scheduler.add_job(
                    process_daily_jobs, "cron", hour=8, args=(database, notifier),
                    id="daily-reminders", replace_existing=True,
                )
                scheduler.start()
            except ImportError:
                logger.warning("APScheduler is not installed; daily reminders are disabled")
        yield
        if scheduler is not None:
            scheduler.shutdown(wait=False)

    app = FastAPI(
        title=settings.app_name, version="0.1.0",
        description="Paperwork extraction, rule checking, storage, and deadline tracking.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.database = database
    app.state.rule_engine = rule_engine
    app.state.extractor = extractor
    app.state.rate_limiter = limiter
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins), allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "X-User-ID", "X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:100]
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled request error request_id=%s", request_id)
            return JSONResponse(
                status_code=500,
                content={"detail": "An unexpected server error occurred.", "request_id": request_id},
            )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        if not request.app.state.database.ping():
            raise HTTPException(status_code=503, detail="Database unavailable")
        return HealthResponse(
            status="ok", database="ok",
            rules_loaded=len(request.app.state.rule_engine.load()),
            ai_configured=bool(settings.groq_api_key),
            timestamp=datetime.now(timezone.utc),
        )

    @app.post("/api/analyze", response_model=AnalyzeResponse, status_code=201)
    async def analyze(request: Request) -> AnalyzeResponse:
        client = request.client.host if request.client else "unknown"
        request.app.state.rate_limiter.check(client)
        payload, upload = await _parse_analyze_request(request)
        text = _optional_string(payload.get("text"))
        user_id = _optional_string(payload.get("user_id")) or request.headers.get("X-User-ID", "demo-user")
        no_save = _as_bool(payload.get("no_save"), False)
        store_original = _as_bool(payload.get("store_original"), False)
        if bool(text) == bool(upload):
            raise HTTPException(status_code=400, detail="Provide exactly one of text or file.")
        if len(user_id) > 120:
            raise HTTPException(status_code=422, detail="user_id is too long.")
        redactions: list[str] = []
        image_bytes: bytes | None = None
        media_type = "image/jpeg"
        if text:
            if len(text) > 100_000:
                raise HTTPException(status_code=413, detail="Text is too long.")
            text, redactions = redact_sensitive_text(text)
        elif upload:
            image_bytes, media_type = await prepare_image(
                upload, settings.max_upload_bytes, settings.max_image_dimension
            )
        try:
            extraction = await request.app.state.extractor.extract(
                text=text, image_bytes=image_bytes, image_media_type=media_type,
            )
        except ExtractionError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        hits = request.app.state.rule_engine.evaluate(extraction)
        deadlines = deadlines_from_extraction(extraction)
        document_id: int | None = None
        if not no_save:
            document_id, deadlines = request.app.state.database.save_analysis(
                user_id, extraction, hits, deadlines, store_original
            )
        return AnalyzeResponse(
            document_id=document_id, saved=not no_save, extraction=extraction,
            rule_hits=hits, deadlines=deadlines, redactions=redactions, disclaimer=DISCLAIMER,
        )

    @app.get("/api/documents", response_model=list[DocumentSummary])
    async def documents(request: Request, user_id: str = "demo-user"):
        return request.app.state.database.list_documents(user_id)

    @app.get("/api/documents/{document_id}", response_model=DocumentDetail)
    async def document(document_id: int, request: Request, user_id: str = "demo-user"):
        result = request.app.state.database.get_document(document_id, user_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        return {**result, "disclaimer": DISCLAIMER}

    @app.get("/api/deadlines", response_model=list[Deadline])
    async def deadlines(request: Request, user_id: str = "demo-user", include_done: bool = False):
        return request.app.state.database.list_deadlines(user_id, include_done)

    @app.patch("/api/deadlines/{deadline_id}", response_model=Deadline)
    async def update_deadline(
        deadline_id: int, update: DeadlineUpdate, request: Request,
        user_id: str = "demo-user",
    ):
        result = request.app.state.database.update_deadline(deadline_id, user_id, update.status)
        if result is None:
            raise HTTPException(status_code=404, detail="Deadline not found.")
        return result

    @app.get("/api/deadlines/calendar")
    async def calendar(request: Request, user_id: str = "demo-user"):
        items = request.app.state.database.list_deadlines(user_id, include_done=False)
        return Response(
            content=build_ics(items), media_type="text/calendar",
            headers={"Content-Disposition": "attachment; filename=paperguard-deadlines.ics"},
        )

    return app


async def _parse_analyze_request(request: Request) -> tuple[dict[str, Any], UploadFile | None]:
    content_type = request.headers.get("content-type", "").lower()
    upload: UploadFile | None = None
    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="JSON body must be an object.")
        return payload, None
    if content_type.startswith("multipart/form-data") or content_type.startswith("application/x-www-form-urlencoded"):
        form = await request.form()
        payload = dict(form)
        possible_file = form.get("file")
        if isinstance(possible_file, (UploadFile, StarletteUploadFile)):
            upload = possible_file
            payload.pop("file", None)
        return payload, upload
    raise HTTPException(
        status_code=415,
        detail="Use application/json for text or multipart/form-data for a file.",
    )


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="Expected a text value.")
    value = value.strip()
    return value or None


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.lower() in {"true", "1", "yes", "on"}:
        return True
    if isinstance(value, str) and value.lower() in {"false", "0", "no", "off"}:
        return False
    raise HTTPException(status_code=422, detail="Expected a boolean value.")


app = create_app()
