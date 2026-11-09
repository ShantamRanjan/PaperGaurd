from __future__ import annotations

import base64
import json

import httpx
from pydantic import ValidationError

from app.config import Settings
from app.schemas import Extraction


class ExtractionError(RuntimeError):
    """The external extraction service could not return safe, valid data."""


SYSTEM_PROMPT = """You extract facts from paperwork. Do not give legal advice and do not invent
missing values. Return only the requested JSON. Use an empty list or empty string when a fact is
not present. Quotes must be exact text visible in the document. Dates must use YYYY-MM-DD.
doc_type must be a short lowercase snake_case label. The reply is a neutral draft with square-
bracket placeholders for facts the user must supply."""


class GroqExtractor:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def extract(
        self,
        *,
        text: str | None = None,
        image_bytes: bytes | None = None,
        image_media_type: str = "image/jpeg",
    ) -> Extraction:
        if not self.settings.groq_api_key:
            raise ExtractionError("AI extraction is not configured. Set GROQ_API_KEY on the server.")
        content: list[dict[str, object]] = [{
            "type": "text",
            "text": text or "Extract the document shown in the image. If it is not paperwork, return empty facts.",
        }]
        if image_bytes is not None:
            encoded = base64.b64encode(image_bytes).decode("ascii")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{image_media_type};base64,{encoded}"},
            })
        payload = {
            "model": self.settings.groq_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            "temperature": 0,
            "stream": False,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "paperguard_extraction", "strict": True,
                    "schema": Extraction.model_json_schema(),
                },
            },
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    f"{self.settings.groq_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            return Extraction.model_validate(json.loads(raw))
        except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValidationError) as exc:
            raise ExtractionError("The extraction service returned an invalid response.") from exc

