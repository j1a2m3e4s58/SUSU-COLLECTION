import importlib
import os
import pathlib
import sys
from concurrent.futures import ThreadPoolExecutor

import pytest


def load_app(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTAL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PORTAL_PUBLIC_URL", "https://portal.example.test")
    monkeypatch.setenv("PORTAL_DEFAULT_INITIAL_PASSWORD", "SeedPass123!")
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
    sys.modules.pop("app", None)
    return importlib.import_module("app")


def test_public_registration_disabled_by_default(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    client = app_module.app.test_client()
    response = client.post("/api/auth/register", json={
        "fullname": "Jane Staff",
        "phone": "0240000000",
        "email": "janestaff@bawjiasecommunitybank.com",
        "branch": "BAWJIASE",
        "department": "SUSU",
        "passwordHash": "StrongPass123!",
    })
    assert response.status_code == 403
    assert "sign-up is currently disabled" in response.get_json()["error"]


def test_public_registration_cannot_create_susu_agent_when_enabled(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    settings = app_module.load_portal_settings_store()
    settings["publicRegistrationEnabled"] = True
    app_module.save_portal_settings_store(settings)
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


def test_session_tokens_are_not_accepted_from_urls(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    token = app_module.issue_session(owner["id"])
    client = app_module.app.test_client()
    response = client.post(f"/api/auth/me?sessionToken={token}")
    assert response.status_code == 401


def test_security_headers_are_applied(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    response = app_module.app.test_client().get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_frontend_serves_root_and_spa_deep_links(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    frontend_dir = tmp_path / "public"
    frontend_dir.mkdir()
    (frontend_dir / "index.html").write_text("<main>SUSU portal</main>", encoding="utf-8")
    monkeypatch.setattr(app_module, "FRONTEND_PUBLIC_DIR", str(frontend_dir))
    client = app_module.app.test_client()

    for path in ("/", "/login", "/directory"):
        response = client.get(path)
        assert response.status_code == 200
        assert b"SUSU portal" in response.data


def test_audit_restore_merge_preserves_existing_history(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    existing = [{
        "id": 1,
        "actorId": "owner-admin-1",
        "actorName": "Owner",
        "action": "CURRENT_ACTION",
        "target": "current",
        "ipAddress": "127.0.0.1",
        "timestamp": 10,
    }]
    imported = [{
        "id": 1,
        "actorId": "old-user",
        "actorName": "Old User",
        "action": "IMPORTED_ACTION",
        "target": "imported",
        "ipAddress": "127.0.0.1",
        "timestamp": 5,
    }]
    merged = app_module.merge_audit_logs(existing, imported)
    assert {item["action"] for item in merged} == {"CURRENT_ACTION", "IMPORTED_ACTION"}
    assert len({item["id"] for item in merged}) == 2


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
    challenge = response.get_json()
    assert challenge["requiresMfa"] is True
    verified = client.post("/api/auth/privileged-mfa/verify", json={
        "challengeId": challenge["challengeId"],
        "code": challenge["testCode"],
    })
    assert verified.status_code == 200
    assert verified.get_json()["user"]["email"] == "jbruku@bawjiasecommunitybank.com"
    assert "sessionToken" not in verified.get_json()
    assert app_module.SESSION_COOKIE_NAME in verified.headers.get("Set-Cookie", "")


def auth_headers(app_module, user_id):
    token = app_module.issue_session(user_id)
    return {"Authorization": f"Bearer {token}"}


def unlock_portal_control(client, headers):
    challenge_response = client.post(
        "/api/portal-settings/unlock",
        json={"password": "SeedPass123!"},
        headers=headers,
    )
    assert challenge_response.status_code == 200
    challenge = challenge_response.get_json()
    assert challenge["requiresMfa"] is True
    response = client.post(
        "/api/portal-settings/unlock/verify",
        json={"challengeId": challenge["challengeId"], "code": challenge["testCode"]},
        headers=headers,
    )
    assert response.status_code == 200
    return response.get_json()["authorizationToken"]


def save_test_users(app_module, *users):
    owner = app_module.normalize_user(app_module.OWNER_ADMIN_USER)
    normalized = [owner, *[app_module.normalize_user(user) for user in users]]
    app_module.save_user_store(normalized)
    return normalized


def test_only_owner_can_create_supervisors(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    existing_supervisor = {
        "id": "existing-supervisor",
        "fullname": "Existing Supervisor",
        "phone": "0240000010",
        "email": "existing.supervisor@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "managedBranches": ["BAWJIASE"],
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, existing_supervisor)
    client = app_module.app.test_client()
    payload = {
        "fullname": "New Branch Supervisor",
        "email": "new.supervisor@bawjiasecommunitybank.com",
        "phone": "0240000011",
        "branch": "OFAAKOR",
        "temporaryPassword": "Temporary123!",
    }

    denied = client.post(
        "/api/supervisors/create",
        json=payload,
        headers=auth_headers(app_module, existing_supervisor["id"]),
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/supervisors/create",
        json=payload,
        headers=auth_headers(app_module, owner["id"]),
    )
    assert created.status_code == 200
    user = created.get_json()["user"]
    assert user["role"] == "Supervisor"
    assert user["department"] == "SUSU"
    assert user["managedBranches"] == ["OFAAKOR"]
    passwords = app_module.load_password_store()
    assert app_module.verify_password(passwords[user["email"]], "Temporary123!")


def test_owner_cleanup_permanently_normalizes_legacy_susu_departments(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    legacy_user = {
        "id": "legacy-agent",
        "fullname": "Legacy Agent",
        "phone": "0240000001",
        "email": "legacy@agents.local",
        "role": "GeneralStaff",
        "department": "SUSU AGENT",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    app_module.atomic_write_json(app_module.USERS_STORE_PATH, [legacy_user])
    owner = app_module.load_user_store()[0]
    client = app_module.app.test_client()
    headers = auth_headers(app_module, owner["id"])
    portal_authorization = unlock_portal_control(client, headers)
    backup_response = client.get("/api/backup/export", headers=headers)
    assert backup_response.status_code == 200
    response = client.post(
        "/api/maintenance/normalize-susu-departments",
        json={
            "portalAuthorization": portal_authorization,
            "backupConfirmed": True,
        },
        headers=headers,
    )
    assert response.status_code == 200
    stored = app_module.read_json_file(app_module.USERS_STORE_PATH, [])
    assert any(user.get("id") == "legacy-agent" and user.get("department") == "SUSU" for user in stored)
    assert all(user.get("department") not in {"SUSU AGENT", "SUSU SUPERVISOR"} for user in stored)


def test_portal_branch_removal_requires_backup(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    settings = app_module.load_portal_settings_store()
    client = app_module.app.test_client()
    headers = auth_headers(app_module, owner["id"])
    portal_authorization = unlock_portal_control(client, headers)
    response = client.post(
        "/api/portal-settings",
        json={
            **settings,
            "branches": settings["branches"][:-1],
            "portalAuthorization": portal_authorization,
            "backupConfirmed": False,
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert "Export a backup" in response.get_json()["error"]


def test_portal_control_requires_owner_password_and_mfa(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    client = app_module.app.test_client()
    headers = auth_headers(app_module, owner["id"])
    denied = client.post(
        "/api/portal-settings/unlock",
        json={"password": "seedpass123!"},
        headers=headers,
    )
    assert denied.status_code == 401

    challenge_response = client.post(
        "/api/portal-settings/unlock",
        json={"password": "SeedPass123!"},
        headers=headers,
    )
    assert challenge_response.status_code == 200
    challenge = challenge_response.get_json()
    assert challenge["requiresMfa"] is True

    wrong_code = client.post(
        "/api/portal-settings/unlock/verify",
        json={"challengeId": challenge["challengeId"], "code": "000000"},
        headers=headers,
    )
    assert wrong_code.status_code == 400

    verified = client.post(
        "/api/portal-settings/unlock/verify",
        json={"challengeId": challenge["challengeId"], "code": challenge["testCode"]},
        headers=headers,
    )
    assert verified.status_code == 200
    assert verified.get_json()["authorizationToken"]


def test_supervisor_is_limited_to_agents_in_managed_branch(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    supervisor = {
        "id": "supervisor-1",
        "fullname": "Branch Supervisor",
        "phone": "0240000002",
        "email": "supervisor@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "managedBranches": ["BAWJIASE"],
        "managedDepartmentsByBranch": {"BAWJIASE": ["ALL"]},
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, supervisor)
    client = app_module.app.test_client()
    headers = auth_headers(app_module, "supervisor-1")
    denied = client.post(
        "/api/agents/create",
        json={
            "fullname": "Wrong Branch Agent",
            "username": "wrongbranch",
            "phone": "0240000003",
            "temporaryPassword": "TempPass123!",
            "branch": "OFAAKOR",
        },
        headers=headers,
    )
    assert denied.status_code == 400
    allowed = client.post(
        "/api/agents/create",
        json={
            "fullname": "Own Branch Agent",
            "username": "ownbranch",
            "phone": "0240000004",
            "temporaryPassword": "TempPass123!",
            "branch": "BAWJIASE",
        },
        headers=headers,
    )
    assert allowed.status_code == 200
    assert allowed.get_json()["user"]["branch"] == "BAWJIASE"


def test_supervisor_backup_is_limited_to_managed_branch(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    supervisor = {
        "id": "supervisor-1",
        "fullname": "Branch Supervisor",
        "phone": "0240000002",
        "email": "supervisor@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "managedBranches": ["BAWJIASE"],
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, supervisor)
    app_module.save_json_list_store(app_module.CUSTOMERS_STORE_PATH, [
        {"id": "own", "account_number": "1310000100101", "branch_name": "BAWJIASE"},
        {"id": "other", "account_number": "1310000100102", "branch_name": "OFAAKOR"},
    ])
    client = app_module.app.test_client()
    response = client.get(
        "/api/backup/export",
        headers=auth_headers(app_module, "supervisor-1"),
    )
    assert response.status_code == 200
    backup = response.get_json()
    assert [item["id"] for item in backup["stores"]["customers"]] == ["own"]
    assert backup["stores"]["passwords"] == {}
    assert "BAWJIASE" in backup["metadata"]["scope"]

    owner_headers = auth_headers(app_module, app_module.OWNER_ADMIN_USER["id"])
    restore = client.post(
        "/api/backup/import",
        json={
            **backup,
            "portalAuthorization": unlock_portal_control(client, owner_headers),
        },
        headers=owner_headers,
    )
    assert restore.status_code == 400
    assert "Branch-scoped backups are export-only" in restore.get_json()["error"]


def test_staff_delete_requires_a_recent_server_recorded_backup(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    supervisor = {
        "id": "supervisor-1",
        "fullname": "Branch Supervisor",
        "phone": "0240000002",
        "email": "supervisor@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "managedBranches": ["BAWJIASE"],
        "isActive": True,
        "isVerified": True,
    }
    agent = {
        "id": "agent-delete",
        "fullname": "Agent Delete",
        "phone": "0240000003",
        "email": "agent-delete@agents.local",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, supervisor, agent)
    client = app_module.app.test_client()
    headers = auth_headers(app_module, "supervisor-1")
    denied = client.post(
        "/api/staff/agent-delete/delete",
        json={"backupConfirmed": True},
        headers=headers,
    )
    assert denied.status_code == 400
    assert "fresh backup" in denied.get_json()["error"]
    assert client.get("/api/backup/export", headers=headers).status_code == 200
    allowed = client.post(
        "/api/staff/agent-delete/delete",
        json={"backupConfirmed": True},
        headers=headers,
    )
    assert allowed.status_code == 200


def test_legacy_supervisor_inherits_saved_branch_scope(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    supervisor = app_module.normalize_user({
        "id": "legacy-supervisor",
        "fullname": "Legacy Supervisor",
        "phone": "0240000099",
        "email": "legacy-supervisor@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "managedBranches": [],
        "isActive": True,
        "isVerified": True,
    })
    assert supervisor["managedBranches"] == ["BAWJIASE"]
    assert app_module.is_assigned_supervisor(supervisor)
    assert app_module.branch_allowed_for_user(supervisor, "BAWJIASE")
    assert not app_module.branch_allowed_for_user(supervisor, "OFAAKOR")


def test_agent_cannot_add_customer_or_view_other_agents_collections(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    agent = {
        "id": "agent-1",
        "fullname": "Agent One",
        "phone": "0240000005",
        "email": "agentone@agents.local",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, agent)
    app_module.save_json_list_store(app_module.COLLECTIONS_STORE_PATH, [{
        "id": "other-collection",
        "customer_id": "customer-2",
        "account_number": "1310000100010",
        "amount": 25,
        "agent_id": "agent-2",
        "agent_name": "Agent Two",
        "branch_name": "BAWJIASE",
        "transaction_date": "2026-07-20",
        "created_date": 1,
    }])
    client = app_module.app.test_client()
    headers = auth_headers(app_module, "agent-1")
    create_response = client.post(
        "/api/customers",
        json={"account_name": "Blocked", "account_number": "1310000100011", "branch_name": "BAWJIASE"},
        headers=headers,
    )
    assert create_response.status_code == 403
    collections_response = client.get("/api/collections", headers=headers)
    assert collections_response.status_code == 200
    assert collections_response.get_json()["collections"] == []


def test_collection_enforces_branch_account_and_duplicate_protection(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    agent = {
        "id": "agent-1",
        "fullname": "Agent One",
        "phone": "0240000005",
        "email": "agentone@agents.local",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, agent)
    app_module.save_json_list_store(app_module.CUSTOMERS_STORE_PATH, [
        {
            "id": "customer-own",
            "account_name": "Own Customer",
            "account_number": "1310000100020",
            "branch_name": "BAWJIASE",
            "customer_status": "active",
            "total_deposits": 0,
        },
        {
            "id": "customer-other",
            "account_name": "Other Customer",
            "account_number": "1310000100021",
            "branch_name": "OFAAKOR",
            "customer_status": "active",
            "total_deposits": 0,
        },
        {
            "id": "customer-invalid",
            "account_name": "Invalid Customer",
            "account_number": "12345",
            "branch_name": "BAWJIASE",
            "customer_status": "active",
            "total_deposits": 0,
        },
    ])
    client = app_module.app.test_client()
    headers = auth_headers(app_module, "agent-1")
    wrong_branch = client.post("/api/collections", json={"customer_id": "customer-other", "amount": 10, "idempotency_key": "wrong-branch"}, headers=headers)
    assert wrong_branch.status_code == 403
    invalid_account = client.post("/api/collections", json={"customer_id": "customer-invalid", "amount": 10, "idempotency_key": "invalid-account"}, headers=headers)
    assert invalid_account.status_code == 409
    first = client.post("/api/collections", json={"customer_id": "customer-own", "amount": 10, "idempotency_key": "deposit-1"}, headers=headers)
    assert first.status_code == 200
    replay = client.post("/api/collections", json={"customer_id": "customer-own", "amount": 10, "idempotency_key": "deposit-1"}, headers=headers)
    assert replay.status_code == 200
    assert replay.get_json()["idempotent"] is True
    duplicate = client.post("/api/collections", json={"customer_id": "customer-own", "amount": 12, "idempotency_key": "deposit-2"}, headers=headers)
    assert duplicate.status_code == 400
    assert "already has a completed deposit" in duplicate.get_json()["error"]


def test_session_uses_short_idle_and_absolute_expiry(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    token = app_module.issue_session(owner["id"])
    sessions = app_module.load_sessions()
    session = sessions[app_module.session_token_hash(token)]
    assert session["expiresAt"] - session["lastActivityAt"] == 30 * 60
    assert session["absoluteExpiresAt"] - session["lastActivityAt"] == 12 * 60 * 60
    session["expiresAt"] = app_module.now_seconds() - 1
    app_module.save_sessions(sessions)
    response = app_module.app.test_client().post(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_owner_can_reset_directory_email_login_and_revoke_sessions(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    staff = {
        "id": "staff-email-reset",
        "fullname": "Directory Staff",
        "phone": "0240000042",
        "email": "directory.staff@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, staff)
    old_staff_token = app_module.issue_session(staff["id"])
    owner = app_module.load_user_store()[0]
    response = app_module.app.test_client().post(
        f"/api/staff/{staff['id']}/reset-email-login",
        json={"newPassword": "FreshLogin123!"},
        headers=auth_headers(app_module, owner["id"]),
    )
    assert response.status_code == 200
    passwords = app_module.load_password_store()
    assert app_module.verify_password(passwords[staff["email"]], "FreshLogin123!")
    assert app_module.session_token_hash(old_staff_token) not in app_module.load_sessions()
    assert app_module.load_audit_logs_store()[0]["action"] == "RESET_STAFF_EMAIL_LOGIN"


def test_owner_can_load_and_remove_only_marked_test_staff(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    real_staff = {
        "id": "real-staff",
        "fullname": "Existing Real Staff",
        "phone": "0240000099",
        "email": "existing.real@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    owner, _ = save_test_users(app_module, real_staff)
    client = app_module.app.test_client()
    headers = auth_headers(app_module, owner["id"])

    seeded = client.post("/api/maintenance/seed-test-staff", json={}, headers=headers)
    assert seeded.status_code == 200
    created_emails = {item["email"] for item in seeded.get_json()["users"]}
    assert "lawuah@bawjiasecommunitybank.com" in created_emails
    lawuah = next(item for item in app_module.load_user_store() if item["email"] == "lawuah@bawjiasecommunitybank.com")
    assert lawuah["isTestData"] is True
    passwords = app_module.load_password_store()
    assert app_module.verify_password(passwords[lawuah["email"]], "SeedPass123!")

    removed = client.post("/api/maintenance/remove-test-staff", json={}, headers=headers)
    assert removed.status_code == 200
    remaining_emails = {item["email"] for item in app_module.load_user_store()}
    assert "lawuah@bawjiasecommunitybank.com" not in remaining_emails
    assert real_staff["email"] in remaining_emails


@pytest.mark.parametrize("path", [
    "/api/maintenance/clear-test-data",
    "/api/maintenance/remove-test-customers",
    "/api/maintenance/seed-test-customers",
    "/api/maintenance/remove-test-staff",
    "/api/maintenance/seed-test-staff",
])
def test_live_mode_blocks_test_data_routes(monkeypatch, tmp_path, path):
    app_module = load_app(monkeypatch, tmp_path)
    settings = app_module.load_portal_settings_store()
    settings["appMode"] = "live"
    app_module.save_portal_settings_store(settings)
    owner = app_module.load_user_store()[0]
    response = app_module.app.test_client().post(
        path,
        json={"backupConfirmed": False},
        headers=auth_headers(app_module, owner["id"]),
    )
    assert response.status_code == 400
    assert "Test Mode" in response.get_json()["error"]


@pytest.mark.parametrize("path", [
    "/api/content/announcements",
    "/api/content/forms",
    "/api/content/training/videos",
])
def test_removed_legacy_content_routes_are_not_registered(monkeypatch, tmp_path, path):
    app_module = load_app(monkeypatch, tmp_path)
    response = app_module.app.test_client().post(path, json={})
    assert response.status_code == 405


def test_concurrent_deposits_allow_only_one_daily_record(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    agent = {
        "id": "agent-concurrent",
        "fullname": "Concurrent Agent",
        "phone": "0240000010",
        "email": "concurrent@agents.local",
        "role": "GeneralStaff",
        "department": "SUSU",
        "branch": "BAWJIASE",
        "isActive": True,
        "isVerified": True,
    }
    save_test_users(app_module, agent)
    app_module.save_json_list_store(app_module.CUSTOMERS_STORE_PATH, [{
        "id": "customer-concurrent",
        "account_name": "Concurrent Customer",
        "account_number": "1310000100099",
        "branch_name": "BAWJIASE",
        "customer_status": "active",
        "total_deposits": 0,
    }])
    token = app_module.issue_session(agent["id"])

    def submit(key):
        client = app_module.app.test_client()
        return client.post(
            "/api/collections",
            json={"customer_id": "customer-concurrent", "amount": 10, "idempotency_key": key},
            headers={"Authorization": f"Bearer {token}"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = sorted(executor.map(submit, ["parallel-1", "parallel-2"]))
    assert statuses == [200, 400]
    assert len(app_module.load_json_list_store(app_module.COLLECTIONS_STORE_PATH)) == 1


def test_backup_export_and_restore_round_trip(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]
    client = app_module.app.test_client()
    headers = auth_headers(app_module, owner["id"])
    authorization = unlock_portal_control(client, headers)
    original = [{"id": "before", "account_number": "1310000100088", "branch_name": "BAWJIASE"}]
    app_module.save_json_list_store(app_module.CUSTOMERS_STORE_PATH, original)
    backup = client.get("/api/backup/export", headers=headers).get_json()
    app_module.save_json_list_store(app_module.CUSTOMERS_STORE_PATH, [])
    response = client.post(
        "/api/backup/import",
        json={**backup, "portalAuthorization": authorization},
        headers=headers,
    )
    assert response.status_code == 200
    assert app_module.load_json_list_store(app_module.CUSTOMERS_STORE_PATH) == original


def test_email_and_sms_delivery_adapters(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    monkeypatch.setenv("MAIL_SERVER", "smtp.example.test")
    monkeypatch.setenv("MAIL_USERNAME", "mailer")
    monkeypatch.setenv("MAIL_PASSWORD", "secret")
    monkeypatch.setenv("MAIL_DEFAULT_SENDER", "portal@example.test")
    monkeypatch.setenv("SMS_WEBHOOK_URL", "https://sms.example.test/send")
    sent = {}

    class FakeSmtp:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def login(self, username, password):
            sent["smtpLogin"] = (username, password)
        def send_message(self, message):
            sent["subject"] = message["Subject"]

    class FakeResponse:
        status = 202
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False

    monkeypatch.setattr(app_module.smtplib, "SMTP_SSL", FakeSmtp)
    monkeypatch.setattr(app_module, "urlopen", lambda *args, **kwargs: FakeResponse())
    app_module.send_mail("staff@example.test", "Portal test", "text", "<p>text</p>")
    assert sent["subject"] == "Portal test"
    assert app_module.send_sms_token("0240000000", "123456") is True


def test_test_mode_privileged_login_does_not_wait_for_email(monkeypatch, tmp_path):
    app_module = load_app(monkeypatch, tmp_path)
    owner = app_module.load_user_store()[0]

    def unexpected_mail(*_args, **_kwargs):
        raise AssertionError("Test Mode must not contact SMTP for privileged login")

    monkeypatch.setattr(app_module, "send_mail", unexpected_mail)
    challenge = app_module.issue_privileged_mfa_challenge(owner)
    assert len(challenge["testCode"]) == 6
    assert challenge["challengeId"]


def test_privileged_login_can_trust_same_browser_for_thirty_days(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTAL_DEFAULT_INITIAL_PASSWORD", "SeedPass123!")
    app_module = load_app(monkeypatch, tmp_path)
    client = app_module.app.test_client()
    login_payload = {
        "email": "jbruku@bawjiasecommunitybank.com",
        "passwordHash": "SeedPass123!",
    }
    browser_headers = {"User-Agent": "BCB-Test-Browser/1.0"}

    challenge_response = client.post("/api/auth/login", json=login_payload, headers=browser_headers)
    challenge = challenge_response.get_json()
    assert challenge_response.status_code == 200
    assert challenge["requiresMfa"] is True

    verified = client.post(
        "/api/auth/privileged-mfa/verify",
        json={
            "challengeId": challenge["challengeId"],
            "code": challenge["testCode"],
            "trustDevice": True,
        },
        headers=browser_headers,
    )
    assert verified.status_code == 200
    assert any(
        app_module.TRUSTED_DEVICE_COOKIE_NAME in header
        for header in verified.headers.getlist("Set-Cookie")
    )

    trusted_login = client.post("/api/auth/login", json=login_payload, headers=browser_headers)
    assert trusted_login.status_code == 200
    assert trusted_login.get_json().get("requiresMfa") is not True
    assert trusted_login.get_json()["user"]["email"] == login_payload["email"]


def test_trusted_privileged_login_is_browser_bound_and_revocable(monkeypatch, tmp_path):
    monkeypatch.setenv("PORTAL_DEFAULT_INITIAL_PASSWORD", "SeedPass123!")
    app_module = load_app(monkeypatch, tmp_path)
    client = app_module.app.test_client()
    owner = app_module.load_user_store()[0]
    login_payload = {
        "email": owner["email"],
        "passwordHash": "SeedPass123!",
    }
    browser_headers = {"User-Agent": "BCB-Trusted-Browser/1.0"}
    challenge = client.post("/api/auth/login", json=login_payload, headers=browser_headers).get_json()
    client.post(
        "/api/auth/privileged-mfa/verify",
        json={"challengeId": challenge["challengeId"], "code": challenge["testCode"], "trustDevice": True},
        headers=browser_headers,
    )

    other_browser = client.post(
        "/api/auth/login",
        json=login_payload,
        headers={"User-Agent": "BCB-New-Browser/1.0"},
    )
    assert other_browser.get_json()["requiresMfa"] is True

    forgotten = client.post("/api/auth/trusted-device/forget", headers=browser_headers)
    assert forgotten.status_code == 200
    assert forgotten.get_json()["removed"] is True
    forgotten_login = client.post("/api/auth/login", json=login_payload, headers=browser_headers)
    assert forgotten_login.get_json()["requiresMfa"] is True

    challenge = forgotten_login.get_json()
    client.post(
        "/api/auth/privileged-mfa/verify",
        json={"challengeId": challenge["challengeId"], "code": challenge["testCode"], "trustDevice": True},
        headers=browser_headers,
    )
    revoked = client.post("/api/auth/sessions/revoke-all", headers=browser_headers)
    assert revoked.status_code == 200
    revoked_login = client.post("/api/auth/login", json=login_payload, headers=browser_headers)
    assert revoked_login.get_json()["requiresMfa"] is True


def test_postgresql_schema_integration_when_test_database_is_configured(monkeypatch, tmp_path):
    database_url = os.getenv("TEST_DATABASE_URL", "").strip()
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to run the PostgreSQL integration test.")
    monkeypatch.setenv("DATABASE_URL", database_url)
    app_module = load_app(monkeypatch, tmp_path)
    app_module.ensure_pg_store_table()
    with app_module.pg_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.susu_deposit_guards')")
            assert cur.fetchone()[0] == "susu_deposit_guards"
