from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from app.schemas import Deadline, Extraction, RuleHit


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    doc_type TEXT NOT NULL, summary TEXT NOT NULL, reply TEXT NOT NULL,
    uploaded_at TEXT NOT NULL, store_original INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS extracted_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('party','amount','date','clause')),
    label TEXT NOT NULL, value TEXT NOT NULL, quote TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rule_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL,
    quote TEXT NOT NULL, source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL, what TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','overdue'))
);
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deadline_id INTEGER NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
    send_on TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'email',
    sent INTEGER NOT NULL DEFAULT 0, UNIQUE(deadline_id, send_on, channel)
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON deadlines(status, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent, send_on);
"""


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(SCHEMA)

    def ping(self) -> bool:
        with self.connect() as connection:
            return connection.execute("SELECT 1").fetchone()[0] == 1

    def save_analysis(
        self,
        user_id: str,
        extraction: Extraction,
        hits: list[RuleHit],
        deadlines: list[Deadline],
        store_original: bool,
    ) -> tuple[int, list[Deadline]]:
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO users(id, email, created_at) VALUES (?, NULL, ?)",
                (user_id, now),
            )
            cursor = connection.execute(
                """INSERT INTO documents
                   (user_id, doc_type, summary, reply, uploaded_at, store_original)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, extraction.doc_type, extraction.summary, extraction.reply, now, int(store_original)),
            )
            document_id = int(cursor.lastrowid)
            rows: list[tuple[Any, ...]] = []
            rows.extend((document_id, "party", "Party", party, "") for party in extraction.parties)
            rows.extend(
                (document_id, "amount", item.label,
                 json.dumps({"value": str(item.value), "currency": item.currency}), "")
                for item in extraction.amounts
            )
            rows.extend(
                (document_id, "date", item.label, item.date.isoformat(), "")
                for item in extraction.dates
            )
            rows.extend(
                (document_id, "clause", item.topic, item.value, item.quote)
                for item in extraction.clauses
            )
            connection.executemany(
                "INSERT INTO extracted_items(document_id, kind, label, value, quote) VALUES (?, ?, ?, ?, ?)",
                rows,
            )
            connection.executemany(
                """INSERT INTO rule_hits(document_id, rule_id, severity, message, quote, source)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [(document_id, h.rule_id, h.severity, h.message, h.quote, h.source) for h in hits],
            )
            saved: list[Deadline] = []
            for item in deadlines:
                deadline_cursor = connection.execute(
                    "INSERT INTO deadlines(document_id, due_date, what, status) VALUES (?, ?, ?, ?)",
                    (document_id, item.due_date.isoformat(), item.what, item.status),
                )
                deadline_id = int(deadline_cursor.lastrowid)
                saved.append(item.model_copy(update={"id": deadline_id, "document_id": document_id}))
                for days_before in (7, 2, 1):
                    connection.execute(
                        """INSERT OR IGNORE INTO reminders(deadline_id, send_on, channel, sent)
                           VALUES (?, ?, 'email', 0)""",
                        (deadline_id, (item.due_date - timedelta(days=days_before)).isoformat()),
                    )
        return document_id, saved

    def list_documents(self, user_id: str) -> list[dict[str, Any]]:
        severity = (
            "CASE rh.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 "
            "WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"
        )
        with self.connect() as connection:
            rows = connection.execute(
                f"""SELECT d.id, d.user_id, d.doc_type, d.summary, d.uploaded_at,
                           d.store_original, COUNT(rh.id) AS flag_count,
                           CASE MAX({severity}) WHEN 4 THEN 'critical' WHEN 3 THEN 'high'
                           WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE NULL END AS highest_severity
                    FROM documents d LEFT JOIN rule_hits rh ON rh.document_id = d.id
                    WHERE d.user_id = ? GROUP BY d.id ORDER BY d.uploaded_at DESC""",
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_document(self, document_id: int, user_id: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            document = connection.execute(
                """SELECT id, user_id, doc_type, summary, reply, uploaded_at, store_original
                   FROM documents WHERE id = ? AND user_id = ?""",
                (document_id, user_id),
            ).fetchone()
            if document is None:
                return None
            items = connection.execute(
                """SELECT kind, label, value, quote FROM extracted_items
                   WHERE document_id = ? ORDER BY id""",
                (document_id,),
            ).fetchall()
            hit_rows = connection.execute(
                """SELECT rule_id, severity, message, quote, source FROM rule_hits
                   WHERE document_id = ? ORDER BY id""",
                (document_id,),
            ).fetchall()
            deadline_rows = connection.execute(
                """SELECT id, document_id, due_date, what, status FROM deadlines
                   WHERE document_id = ? ORDER BY due_date, id""",
                (document_id,),
            ).fetchall()

        parties: list[str] = []
        amounts: list[dict[str, Any]] = []
        dates: list[dict[str, Any]] = []
        clauses: list[dict[str, Any]] = []
        for item in items:
            if item["kind"] == "party":
                parties.append(item["value"])
            elif item["kind"] == "amount":
                amount = json.loads(item["value"])
                amounts.append({"label": item["label"], **amount})
            elif item["kind"] == "date":
                dates.append({"label": item["label"], "date": item["value"]})
            elif item["kind"] == "clause":
                clauses.append({
                    "topic": item["label"], "value": item["value"], "quote": item["quote"]
                })
        return {
            "id": document["id"],
            "user_id": document["user_id"],
            "uploaded_at": document["uploaded_at"],
            "store_original": bool(document["store_original"]),
            "extraction": {
                "doc_type": document["doc_type"],
                "summary": document["summary"],
                "parties": parties,
                "amounts": amounts,
                "dates": dates,
                "clauses": clauses,
                "reply": document["reply"],
            },
            "rule_hits": [dict(row) for row in hit_rows],
            "deadlines": [dict(row) for row in deadline_rows],
        }

    def mark_overdue(self, today: date | None = None) -> int:
        with self.connect() as connection:
            cursor = connection.execute(
                "UPDATE deadlines SET status = 'overdue' WHERE status = 'open' AND due_date < ?",
                ((today or date.today()).isoformat(),),
            )
            return cursor.rowcount

    def list_deadlines(self, user_id: str, include_done: bool = False) -> list[dict[str, Any]]:
        self.mark_overdue()
        condition = "" if include_done else "AND dl.status != 'done'"
        with self.connect() as connection:
            rows = connection.execute(
                f"""SELECT dl.id, dl.document_id, dl.due_date, dl.what, dl.status
                    FROM deadlines dl JOIN documents d ON d.id = dl.document_id
                    WHERE d.user_id = ? {condition} ORDER BY dl.due_date ASC, dl.id ASC""",
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def update_deadline(self, deadline_id: int, user_id: str, status: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            cursor = connection.execute(
                """UPDATE deadlines SET status = ? WHERE id = ? AND document_id IN
                   (SELECT id FROM documents WHERE user_id = ?)""",
                (status, deadline_id, user_id),
            )
            if cursor.rowcount == 0:
                return None
            row = connection.execute(
                "SELECT id, document_id, due_date, what, status FROM deadlines WHERE id = ?",
                (deadline_id,),
            ).fetchone()
            return dict(row)

    def due_reminders(self, day: date | None = None) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT r.id, r.deadline_id, r.channel, dl.what, dl.due_date, u.email
                   FROM reminders r JOIN deadlines dl ON dl.id = r.deadline_id
                   JOIN documents d ON d.id = dl.document_id JOIN users u ON u.id = d.user_id
                   WHERE r.sent = 0 AND r.send_on <= ? AND dl.status = 'open'""",
                ((day or date.today()).isoformat(),),
            ).fetchall()
        return [dict(row) for row in rows]

    def mark_reminder_sent(self, reminder_id: int) -> None:
        with self.connect() as connection:
            connection.execute("UPDATE reminders SET sent = 1 WHERE id = ?", (reminder_id,))
