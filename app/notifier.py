from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.config import Settings
from app.database import Database


class EmailNotifier:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.smtp_host and self.settings.smtp_from)

    def send_deadline(self, recipient: str, what: str, due_date: str) -> bool:
        if not self.configured or not recipient:
            return False
        message = EmailMessage()
        message["Subject"] = f"PaperGuard reminder: {what}"
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message.set_content(
            f"Reminder: {what} is due on {due_date}.\n\n"
            "Open PaperGuard to review the original document."
        )
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
            if self.settings.smtp_use_tls:
                smtp.starttls()
            if self.settings.smtp_username and self.settings.smtp_password:
                smtp.login(self.settings.smtp_username, self.settings.smtp_password)
            smtp.send_message(message)
        return True


def process_daily_jobs(database: Database, notifier: EmailNotifier) -> None:
    database.mark_overdue()
    for reminder in database.due_reminders():
        if notifier.send_deadline(reminder["email"], reminder["what"], reminder["due_date"]):
            database.mark_reminder_sent(reminder["id"])

