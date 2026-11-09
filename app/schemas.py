from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Amount(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    value: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")


class ExtractedDate(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    date: date


class Clause(StrictModel):
    topic: str = Field(min_length=1, max_length=120)
    value: str = Field(max_length=2000)
    quote: str = Field(min_length=1, max_length=4000)


class Extraction(StrictModel):
    doc_type: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    summary: str = Field(min_length=1, max_length=2000)
    parties: list[str] = Field(max_length=30)
    amounts: list[Amount] = Field(max_length=100)
    dates: list[ExtractedDate] = Field(max_length=100)
    clauses: list[Clause] = Field(max_length=100)
    reply: str = Field(max_length=5000)

    @field_validator("parties")
    @classmethod
    def validate_parties(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if any(len(item) > 200 for item in cleaned):
            raise ValueError("A party name is too long")
        return cleaned


class RuleHit(StrictModel):
    rule_id: str
    severity: Literal["low", "medium", "high", "critical"]
    message: str
    quote: str
    source: str


class Deadline(StrictModel):
    id: int | None = None
    document_id: int | None = None
    due_date: date
    what: str
    status: Literal["open", "done", "overdue"] = "open"


class AnalyzeResponse(StrictModel):
    document_id: int | None
    saved: bool
    extraction: Extraction
    rule_hits: list[RuleHit]
    deadlines: list[Deadline]
    redactions: list[str]
    disclaimer: str


class DocumentSummary(StrictModel):
    id: int
    user_id: str
    doc_type: str
    summary: str
    uploaded_at: datetime
    store_original: bool
    flag_count: int
    highest_severity: str | None


class DocumentDetail(StrictModel):
    id: int
    user_id: str
    uploaded_at: datetime
    store_original: bool
    extraction: Extraction
    rule_hits: list[RuleHit]
    deadlines: list[Deadline]
    disclaimer: str


class DeadlineUpdate(StrictModel):
    status: Literal["open", "done"]


class HealthResponse(StrictModel):
    status: Literal["ok"]
    database: Literal["ok"]
    rules_loaded: int
    ai_configured: bool
    timestamp: datetime

