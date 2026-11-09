from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import Extraction


class FakeExtractor:
    def __init__(self, extraction: Extraction):
        self.extraction = extraction
        self.calls = []

    async def extract(self, **kwargs):
        self.calls.append(kwargs)
        return self.extraction


@pytest.fixture
def sample_extraction() -> Extraction:
    return Extraction.model_validate({
        "doc_type": "rent_agreement",
        "summary": "A residential rent agreement with a deposit and a renewal date.",
        "parties": ["Tenant", "Landlord"],
        "amounts": [
            {"label": "Monthly rent", "value": 20000, "currency": "INR"},
            {"label": "Security deposit", "value": 50000, "currency": "INR"},
        ],
        "dates": [{"label": "Renewal deadline", "date": "2099-06-30"}],
        "clauses": [{
            "topic": "Security deposit", "value": "INR 50,000",
            "quote": "The security deposit is INR 50,000.",
        }],
        "reply": "Dear [Landlord], please confirm [detail].",
    })


@pytest.fixture
def client(tmp_path: Path, sample_extraction: Extraction):
    settings = Settings(
        app_name="PaperGuard Test API", database_path=tmp_path / "test.db",
        rules_directory=Path(__file__).parents[1] / "rules", groq_api_key=None,
        groq_model="test-model", groq_base_url="https://example.invalid",
        max_upload_bytes=1024 * 1024, max_image_dimension=800,
        analyze_rate_limit_per_minute=100,
        allowed_origins=("http://localhost:5173",), enable_scheduler=False,
        smtp_host=None, smtp_port=587, smtp_username=None, smtp_password=None,
        smtp_from=None, smtp_use_tls=True,
    )
    app = create_app(settings)
    fake = FakeExtractor(sample_extraction)
    app.state.extractor = fake
    with TestClient(app) as test_client:
        test_client.fake_extractor = fake
        yield test_client

