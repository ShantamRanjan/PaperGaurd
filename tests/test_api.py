from __future__ import annotations

from io import BytesIO

from PIL import Image


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["rules_loaded"] == 1


def test_analyze_text_persists_and_redacts(client):
    response = client.post("/api/analyze", json={
        "text": "My PAN is ABCDE1234F and account is 123456789. Check this lease.",
        "user_id": "user-1",
    })
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["saved"] is True
    assert body["document_id"] == 1
    assert body["rule_hits"][0]["rule_id"] == "IN-MTA-2021-SECURITY-DEPOSIT-01"
    assert body["deadlines"][0]["id"] == 1
    assert set(body["redactions"]) == {"PAN", "bank/account-like number"}
    sent_text = client.fake_extractor.calls[0]["text"]
    assert "ABCDE1234F" not in sent_text
    assert "123456789" not in sent_text
    documents = client.get("/api/documents", params={"user_id": "user-1"})
    assert documents.status_code == 200
    assert documents.json()[0]["flag_count"] == 1
    assert documents.json()[0]["highest_severity"] == "high"

    detail = client.get("/api/documents/1", params={"user_id": "user-1"})
    assert detail.status_code == 200
    assert detail.json()["extraction"]["amounts"][1]["value"] == "50000"
    assert detail.json()["rule_hits"][0]["quote"] == "The security deposit is INR 50,000."
    assert client.get("/api/documents/1", params={"user_id": "stranger"}).status_code == 404


def test_no_save_mode_leaves_database_empty(client):
    response = client.post(
        "/api/analyze", json={"text": "Lease text", "no_save": True, "user_id": "private"}
    )
    assert response.status_code == 201
    assert response.json()["saved"] is False
    assert response.json()["document_id"] is None
    assert client.get("/api/documents", params={"user_id": "private"}).json() == []


def test_image_upload_is_resized_and_accepted(client):
    image = Image.new("RGB", (1800, 1200), "white")
    content = BytesIO()
    image.save(content, "PNG")
    response = client.post(
        "/api/analyze",
        files={"file": ("lease.png", content.getvalue(), "image/png")},
        data={"user_id": "image-user"},
    )
    assert response.status_code == 201, response.text
    sent = client.fake_extractor.calls[-1]
    assert sent["image_media_type"] == "image/jpeg"
    resized = Image.open(BytesIO(sent["image_bytes"]))
    assert max(resized.size) <= 800


def test_rejects_missing_or_duplicate_inputs(client):
    assert client.post("/api/analyze", json={}).status_code == 400
    response = client.post(
        "/api/analyze",
        files={"file": ("lease.png", b"not-an-image", "image/png")},
        data={"text": "also text"},
    )
    assert response.status_code == 400


def test_rejects_bad_file_type(client):
    response = client.post(
        "/api/analyze", files={"file": ("lease.pdf", b"%PDF", "application/pdf")}
    )
    assert response.status_code == 415


def test_deadline_update_and_calendar(client):
    analyzed = client.post(
        "/api/analyze", json={"text": "Lease", "user_id": "calendar-user"}
    ).json()
    deadline_id = analyzed["deadlines"][0]["id"]
    calendar = client.get("/api/deadlines/calendar", params={"user_id": "calendar-user"})
    assert calendar.status_code == 200
    assert "BEGIN:VCALENDAR" in calendar.text
    assert "Renewal deadline" in calendar.text
    updated = client.patch(
        f"/api/deadlines/{deadline_id}", params={"user_id": "calendar-user"},
        json={"status": "done"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "done"
    assert client.get("/api/deadlines", params={"user_id": "calendar-user"}).json() == []


def test_cannot_update_another_users_deadline(client):
    analyzed = client.post(
        "/api/analyze", json={"text": "Lease", "user_id": "owner"}
    ).json()
    deadline_id = analyzed["deadlines"][0]["id"]
    response = client.patch(
        f"/api/deadlines/{deadline_id}", params={"user_id": "stranger"},
        json={"status": "done"},
    )
    assert response.status_code == 404

