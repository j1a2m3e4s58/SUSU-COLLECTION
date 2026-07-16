import importlib
import os
import pathlib
import sys


def load_app(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTAL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PORTAL_PUBLIC_URL", "https://portal.example.test")
    monkeypatch.setenv("PORTAL_CONTROL_PASSWORD", "SecretPortalPassword123")
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
    sys.modules.pop("app", None)
    return importlib.import_module("app")


def test_public_registration_cannot_create_susu_agent(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    client = app_module.app.test_client()
    response = client.post("/api/auth/register", json={
        "fullname": "Bad Agent",
        "phone": "0240000000",
        "email": "badagent@bawjiasecommunitybank.com",
        "branch": "BAWJIASE",
        "department": "SUSU AGENT",
        "passwordHash": "StrongPass123!",
    })
    assert response.status_code == 403
    assert "created by a supervisor" in response.get_json()["error"]


def test_reset_url_uses_trusted_public_url(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    reset_url = app_module.build_reset_url("https://evil.example/reset", "abc123")
    assert reset_url.startswith("https://portal.example.test/reset-password")
    assert "evil.example" not in reset_url
    assert "token=abc123" in reset_url


def test_sessions_are_saved_hashed(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    token = app_module.issue_session("user-1")
    sessions = app_module.read_json_file(app_module.SESSIONS_STORE_PATH, {})
    assert token not in sessions
    assert app_module.session_token_hash(token) in sessions


def test_field_collection_does_not_send_protected_deposit_fields():
    source = pathlib.Path(__file__).resolve().parents[2] / "src" / "pages" / "FieldCollection.jsx"
    text = source.read_text(encoding="utf-8")
    submit_block = text.split("await createCollection({", 1)[1].split("});", 1)[0]
    forbidden = [
        "transaction_reference",
        "account_name",
        "account_number",
        "agent_id",
        "agent_name",
        "branch_id",
        "branch_name",
        "transaction_date",
        "transaction_time",
        "status",
        "supervisor_review_status",
    ]
    for field in forbidden:
        assert field not in submit_block

def test_default_password_seeds_initial_staff(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTAL_DEFAULT_INITIAL_PASSWORD", "SeedPass123!")
    app_module = load_app(monkeypatch, tmp_path)
    passwords = app_module.load_password_store()
    assert "jbruku@bawjiasecommunitybank.com" in passwords
    assert app_module.verify_password(passwords["jbruku@bawjiasecommunitybank.com"], "SeedPass123!")
    client = app_module.app.test_client()
    response = client.post("/api/auth/login", json={
        "email": "jbruku@bawjiasecommunitybank.com",
        "passwordHash": "SeedPass123!",
    })
    assert response.status_code == 200
    assert response.get_json()["user"]["email"] == "jbruku@bawjiasecommunitybank.com"
