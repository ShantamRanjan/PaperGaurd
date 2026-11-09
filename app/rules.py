from __future__ import annotations

import json
import operator
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable

from app.schemas import Extraction, RuleHit


SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _context(extraction: Extraction) -> dict[str, Any]:
    return {
        "doc_type": extraction.doc_type,
        "amounts": {
            slug(item.label): {"value": item.value, "currency": item.currency}
            for item in extraction.amounts
        },
        "dates": {
            slug(item.label): {"date": item.date.isoformat()}
            for item in extraction.dates
        },
        "clauses": {
            slug(item.topic): {"value": item.value, "quote": item.quote}
            for item in extraction.clauses
        },
    }


def _resolve(context: dict[str, Any], path: str) -> Any:
    current: Any = context
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _number(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


COMPARATORS: dict[str, Callable[[Any, Any], bool]] = {
    "equals": operator.eq,
    "not_equals": operator.ne,
    "gt": lambda left, right: _number(left) > _number(right),
    "gte": lambda left, right: _number(left) >= _number(right),
    "lt": lambda left, right: _number(left) < _number(right),
    "lte": lambda left, right: _number(left) <= _number(right),
    "contains": lambda left, right: str(right).lower() in str(left).lower(),
}


@dataclass(slots=True)
class RuleEngine:
    directory: Path

    def load(self) -> list[dict[str, Any]]:
        rules: list[dict[str, Any]] = []
        if not self.directory.exists():
            return rules
        for path in sorted(self.directory.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                raise ValueError(f"Rule file {path} must contain a JSON list")
            for rule in data:
                self._validate_rule(rule, path)
                rules.append(rule)
        return rules

    @staticmethod
    def _validate_rule(rule: Any, path: Path) -> None:
        required = {
            "id", "applies_to", "field", "operator", "severity",
            "message", "source", "reviewed_on",
        }
        if not isinstance(rule, dict) or not required.issubset(rule):
            raise ValueError(f"Malformed rule in {path}")
        if rule["operator"] not in {*COMPARATORS, "exists", "missing"}:
            raise ValueError(f"Unsupported operator in rule {rule['id']}")
        if rule["severity"] not in SEVERITY_ORDER:
            raise ValueError(f"Unsupported severity in rule {rule['id']}")
        if rule["operator"] not in {"exists", "missing"} and not (
            "value" in rule or "compare_to" in rule
        ):
            raise ValueError(f"Rule {rule['id']} needs value or compare_to")

    def evaluate(self, extraction: Extraction) -> list[RuleHit]:
        context = _context(extraction)
        hits: list[RuleHit] = []
        for rule in self.load():
            if rule["applies_to"] != extraction.doc_type:
                continue
            left = _resolve(context, rule["field"])
            operation = rule["operator"]
            if operation == "exists":
                matched = left is not None
            elif operation == "missing":
                matched = left is None
            elif left is None:
                matched = False
            else:
                right = _resolve(context, rule["compare_to"]) if "compare_to" in rule else rule.get("value")
                if right is None:
                    matched = False
                else:
                    if "multiplier" in rule:
                        try:
                            right = _number(right) * _number(rule["multiplier"])
                        except (InvalidOperation, ValueError):
                            right = None
                    try:
                        matched = right is not None and COMPARATORS[operation](left, right)
                    except (InvalidOperation, TypeError, ValueError):
                        matched = False
            if matched:
                quote_path = rule.get("quote_field")
                quote = str(_resolve(context, quote_path) or "") if quote_path else ""
                hits.append(
                    RuleHit(
                        rule_id=rule["id"], severity=rule["severity"],
                        message=rule["message"], quote=quote, source=rule["source"],
                    )
                )
        return sorted(hits, key=lambda item: SEVERITY_ORDER[item.severity], reverse=True)

