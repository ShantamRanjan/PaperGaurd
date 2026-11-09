from __future__ import annotations

from datetime import date

from app.schemas import Deadline, Extraction


DEADLINE_WORDS = ("deadline", "due", "expiry", "expiration", "renewal", "end date", "notice")


def deadlines_from_extraction(extraction: Extraction) -> list[Deadline]:
    seen: set[tuple[date, str]] = set()
    deadlines: list[Deadline] = []
    for item in extraction.dates:
        if any(word in item.label.lower() for word in DEADLINE_WORDS):
            key = (item.date, item.label.casefold())
            if key not in seen:
                seen.add(key)
                status = "overdue" if item.date < date.today() else "open"
                deadlines.append(Deadline(due_date=item.date, what=item.label, status=status))
    return sorted(deadlines, key=lambda item: item.due_date)


def build_ics(deadlines: list[dict[str, object]]) -> str:
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PaperGuard//Deadlines//EN",
        "CALSCALE:GREGORIAN",
    ]
    for item in deadlines:
        due = str(item["due_date"]).replace("-", "")
        summary = (str(item["what"]).replace("\\", "\\\\").replace(";", "\\;")
                   .replace(",", "\\,").replace("\n", "\\n"))
        lines.extend([
            "BEGIN:VEVENT", f"UID:deadline-{item['id']}@paperguard",
            f"DTSTART;VALUE=DATE:{due}", f"SUMMARY:{summary}", "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
