from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _as_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    database_path: Path
    rules_directory: Path
    groq_api_key: str | None
    groq_model: str
    groq_base_url: str
    max_upload_bytes: int
    max_image_dimension: int
    analyze_rate_limit_per_minute: int
    allowed_origins: tuple[str, ...]
    enable_scheduler: bool
    smtp_host: str | None
    smtp_port: int
    smtp_username: str | None
    smtp_password: str | None
    smtp_from: str | None
    smtp_use_tls: bool

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            item.strip()
            for item in os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080",
            ).split(",")
            if item.strip()
        )
        return cls(
            app_name="PaperGuard API",
            database_path=Path(os.getenv("DATABASE_PATH", "data/paperguard.db")),
            rules_directory=Path(
                os.getenv("RULES_DIRECTORY", str(Path(__file__).resolve().parent.parent / "rules"))
            ),
            groq_api_key=os.getenv("GROQ_API_KEY") or None,
            groq_model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
            groq_base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/"),
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024))),
            max_image_dimension=int(os.getenv("MAX_IMAGE_DIMENSION", "1600")),
            analyze_rate_limit_per_minute=int(os.getenv("ANALYZE_RATE_LIMIT_PER_MINUTE", "20")),
            allowed_origins=origins,
            enable_scheduler=_as_bool("ENABLE_SCHEDULER", True),
            smtp_host=os.getenv("SMTP_HOST") or None,
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_username=os.getenv("SMTP_USERNAME") or None,
            smtp_password=os.getenv("SMTP_PASSWORD") or None,
            smtp_from=os.getenv("SMTP_FROM") or None,
            smtp_use_tls=_as_bool("SMTP_USE_TLS", True),
        )

