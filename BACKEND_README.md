# PaperGuard backend

PaperGuard reads paperwork with an external vision model, validates the returned facts, checks
transparent JSON rules, stores the result in SQLite, and tracks deadlines. This repository contains
the backend only; a web frontend can connect to it later.

## What is included

- FastAPI endpoints for analysis, documents, deadlines, deadline updates, health, and `.ics` export
- Text or JPEG/PNG/WebP input, image resizing, upload limits, and sensitive-number redaction
- Strict Pydantic validation around every AI response
- A safe JSON rules engine (it never runs rule text as Python code)
- SQLite storage with automatic table creation
- Reminder records at 7, 2, and 1 days before a deadline
- An optional daily APScheduler job and SMTP email delivery
- No-save mode, rate limiting, CORS configuration, and content-safe error responses
- Automated API, storage, image, privacy, calendar, ownership, and rules tests

The included rent rule demonstrates the complete checking flow. It cites India's Model Tenancy Act
2021, which is a model/template and may not be the law in a property's state. Add production rules
only after a domain expert verifies the official source and jurisdiction.

## Start locally

1. Create and activate a Python 3.11+ virtual environment.
2. Install the project: `python -m pip install -e ".[test]"`
3. Put the server-side Groq key in your environment as `GROQ_API_KEY`.
4. Start it: `python -m uvicorn app.main:app --reload --env-file .env`
5. Open `http://127.0.0.1:8000/docs` to try the API.

The backend reads environment variables from the process. It deliberately does not ship a key to
the frontend or silently load secrets from files.

## Main API calls

For pasted text, send `POST /api/analyze` as JSON:

```json
{
  "text": "Agreement text...",
  "user_id": "demo-user",
  "no_save": false,
  "store_original": false
}
```

For an image, send `multipart/form-data` with a `file` field and optional `user_id`, `no_save`, and
`store_original` fields. Only JPEG, PNG, and WebP are accepted in this MVP.

- `GET /api/documents?user_id=demo-user`
- `GET /api/deadlines?user_id=demo-user`
- `PATCH /api/deadlines/{id}?user_id=demo-user` with `{"status":"done"}`
- `GET /api/deadlines/calendar?user_id=demo-user`
- `GET /api/health`

The temporary `user_id` parameter is an integration seam for the future frontend. Replace it with a
real authentication provider before exposing PaperGuard publicly.

## Tests and rules

Run `python -m pytest`. Tests use a fake extractor, so they never call Groq and never require an API
key.

Rules live in `rules/*.json`. Supported operators are `exists`, `missing`, `equals`, `not_equals`,
`gt`, `gte`, `lt`, `lte`, and `contains`. A rule may compare against a fixed `value` or another
extracted field via `compare_to`, with an optional numeric `multiplier`.

Never add an uncited legal threshold. PaperGuard shows a rule hit as a warning to verify, not as legal
advice.

