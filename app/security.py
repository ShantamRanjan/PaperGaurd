from __future__ import annotations

import re
from collections import defaultdict, deque
from io import BytesIO
from threading import Lock
from time import monotonic

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError


REDACTION_PATTERNS = {
    "PAN": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", re.IGNORECASE),
    "Aadhaar-like number": re.compile(r"(?<!\d)(?:\d[ -]?){11}\d(?!\d)"),
    "bank/account-like number": re.compile(r"(?<!\d)\d{9,18}(?!\d)"),
}


def redact_sensitive_text(text: str) -> tuple[str, list[str]]:
    result = text
    found: list[str] = []
    for label, pattern in REDACTION_PATTERNS.items():
        result, count = pattern.subn(f"[REDACTED {label}]", result)
        if count:
            found.append(label)
    return result, found


async def prepare_image(upload: UploadFile, max_bytes: int, max_dimension: int) -> tuple[bytes, str]:
    content_type = (upload.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )
    raw = await upload.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="The uploaded image is too large.")
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    try:
        with Image.open(BytesIO(raw)) as source:
            source.verify()
        with Image.open(BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="JPEG", quality=85, optimize=True)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="The image is invalid or unsafe.") from exc
    return output.getvalue(), "image/jpeg"


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = monotonic()
        with self._lock:
            events = self._events[key]
            while events and now - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail="Too many analysis requests. Please try again in a minute.",
                    headers={"Retry-After": str(self.window_seconds)},
                )
            events.append(now)

