from __future__ import annotations

import json
import os
import secrets
import smtplib
import tempfile
import time
from email.message import EmailMessage
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
DATA_DIR = os.getenv("PORTAL_DATA_DIR", BASE_DIR).strip() or BASE_DIR
FRONTEND_PUBLIC_DIR = os.getenv("PORTAL_FRONTEND_DIR", os.path.join(BASE_DIR, "public")).strip() or os.path.join(BASE_DIR, "public")

OFFICIAL_EMAIL_DOMAIN = "@bawjiasecommunitybank.com"
PRESENCE_STORE_PATH = os.path.join(DATA_DIR, "presence_store.json")
PASSWORD_STORE_PATH = os.path.join(DATA_DIR, "password_store.json")
USERS_STORE_PATH = os.path.join(DATA_DIR, "users_store.json")
PENDING_VERIFICATIONS_PATH = os.path.join(DATA_DIR, "pending_verifications.json")
RESET_TOKENS_PATH = os.path.join(DATA_DIR, "reset_tokens.json")
SESSIONS_STORE_PATH = os.path.join(DATA_DIR, "sessions_store.json")
ANNOUNCEMENTS_STORE_PATH = os.path.join(DATA_DIR, "announcements_store.json")
FORMS_STORE_PATH = os.path.join(DATA_DIR, "forms_store.json")
TRAINING_VIDEOS_STORE_PATH = os.path.join(DATA_DIR, "training_videos_store.json")
TRAINING_DOCUMENTS_STORE_PATH = os.path.join(DATA_DIR, "training_documents_store.json")
NOTIFICATIONS_STORE_PATH = os.path.join(DATA_DIR, "notifications_store.json")
TRAINING_VIDEO_PROGRESS_STORE_PATH = os.path.join(DATA_DIR, "training_video_progress_store.json")
TRAINING_DOCUMENT_OPENS_STORE_PATH = os.path.join(DATA_DIR, "training_document_opens_store.json")
TRAINING_REMINDERS_STORE_PATH = os.path.join(DATA_DIR, "training_reminders_store.json")
AUDIT_LOGS_STORE_PATH = os.path.join(DATA_DIR, "audit_logs_store.json")
PORTAL_SETTINGS_STORE_PATH = os.path.join(DATA_DIR, "portal_settings_store.json")
CUSTOMERS_STORE_PATH = os.path.join(DATA_DIR, "customers_store.json")
COLLECTIONS_STORE_PATH = os.path.join(DATA_DIR, "collections_store.json")
DAILY_CLOSES_STORE_PATH = os.path.join(DATA_DIR, "daily_closes_store.json")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
PRESENCE_TTL_SECONDS = 20
ONLINE_WINDOW_SECONDS = 20
RESET_TOKEN_TTL_SECONDS = 30 * 60
VERIFICATION_TTL_SECONDS = 15 * 60
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
TRAINING_REMINDER_COOLDOWN_SECONDS = 24 * 60 * 60
PORTAL_CONTROL_PASSWORD = "T4n4AMEg8f52468"
DEFAULT_PORTAL_BRANCHES = [
    "HEAD OFFICE",
    "BAWJIASE",
    "ADEISO",
    "OFAAKOR",
    "KASOA NEW MARKET",
    "KASOA MAIN",
]
DEFAULT_PORTAL_DEPARTMENTS = [
    "SUSU",
    "SUSU AGENT",
]
SUSU_DEPARTMENTS = {"SUSU", "SUSU AGENT"}
DEFAULT_PORTAL_SETTINGS = {
    "bankName": "Bawjiase Community Bank PLC",
    "shortBankName": "BCB",
    "portalName": "SUSU Collection Portal",
    "emailDomain": OFFICIAL_EMAIL_DOMAIN,
    "branches": DEFAULT_PORTAL_BRANCHES,
    "departments": DEFAULT_PORTAL_DEPARTMENTS,
    "formCategories": [],
    "trainingCategories": [],
    "supportIssueCategories": [],
    "supportRequestTypes": [],
    "departmentChangeTypes": [],
    "transferLocations": [],
    "loginSubtitle": "Sign in to manage SUSU collections, customers, staff, and branch reports.",
    "loginButtonText": "Secure Login",
    "authorizedAccessText": "Authorized Access Only",
    "appMode": "test",
    "portalControlPassword": PORTAL_CONTROL_PASSWORD,
    "itAccessCode": "",
    "hrAccessCode": "",
    "sessionDays": 30,
    "verificationMinutes": 15,
    "passwordResetMinutes": 30,
    "videoUploadLimitMb": 1024,
    "documentUploadLimitMb": 100,
    "dashboardLabel": "Dashboard",
    "trainingLabel": "",
    "formsLabel": "",
    "supportLabel": "",
    "profileLabel": "Profile",
    "activeStaffLabel": "Active Staff",
    "branchCoverageLabel": "Branch Coverage",
    "openOperationsLabel": "Open Operations",
    "resolutionRateLabel": "Resolution Rate",
}


def env_secret(name: str) -> str:
    return str(os.getenv(name, "") or "").strip()


DEFAULT_INITIAL_PASSWORD = env_secret("PORTAL_DEFAULT_INITIAL_PASSWORD")
IT_ACCESS_CODE = env_secret("IT_ACCESS_CODE")
HR_ACCESS_CODE = env_secret("HR_ACCESS_CODE")
GLOBAL_MANAGER_ROLES = {"OwnerAdmin"}
OWNER_ADMIN_ROLE = "OwnerAdmin"
DISABLED_CONTENT_MODULES = {
    "announcements",
    "forms",
    "trainingVideos",
    "trainingDocuments",
    "support",
}

OWNER_ADMIN_USER = {
    "id": "owner-admin-1",
    "fullname": "Site Creator Owner",
    "phone": "0000000000",
    "email": "sitecreator@bawjiasecommunitybank.com",
    "role": OWNER_ADMIN_ROLE,
    "position": "Site Creator",
    "department": "SUSU",
    "branch": "HEAD OFFICE",
    "imageFile": None,
    "managedBranches": ["ALL"],
    "managedDepartmentsByBranch": {},
    "permissions": {
        "userManagement": True,
        "customers": True,
        "transactions": True,
        "reports": True,
        "agents": True,
        "branches": True,
        "auditLog": True,
        "backupExport": True,
    },
    "isActive": True,
    "isVerified": True,
    "lastSeen": 0,
    "registrationTime": 0,
    "isArchived": False,
}

INITIAL_USERS = [
    {
        "id": "db-user-6",
        "fullname": "Desmond Tettey Quarshie",
        "phone": "0243670230",
        "email": "dquarshie@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "SUSU AGENT",
        "branch": "BAWJIASE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1772637593885,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-9",
        "fullname": "Jane Afua Bruku",
        "phone": "0248154869",
        "email": "jbruku@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "position": "Staff",
        "department": "SUSU",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770741882598,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-5",
        "fullname": "Kwabena Asare",
        "phone": "0599779664",
        "email": "kasare@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "SUSU AGENT",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770990814598,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-8",
        "fullname": "Kwesi Adu Snr Yeenu-Prah",
        "phone": "0555443053",
        "email": "kyeenu-prah@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "SUSU AGENT",
        "branch": "HEAD OFFICE",
        "imageFile": "profile_pics/f658de3c2aa8ca6d.jpeg",
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770296150530,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-4",
        "fullname": "Ato Asiedu Mensah",
        "phone": "0247554428",
        "email": "amensah@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "position": "Staff",
        "department": "SUSU",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1770975614364,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-2",
        "fullname": "James Lincoln Awuah",
        "phone": "0536799490",
        "email": "lawuah@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "SUSU AGENT",
        "branch": "HEAD OFFICE",
        "imageFile": "profile_pics/88efb134d068db11.jpg",
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1775309044811,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-3",
        "fullname": "Nathaniel Oglie Narh",
        "phone": "0246377830",
        "email": "nnarh@bawjiasecommunitybank.com",
        "role": "Supervisor",
        "position": "Staff",
        "department": "SUSU",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1769519876185,
        "registrationTime": 0,
        "isArchived": False,
    },
    {
        "id": "db-user-7",
        "fullname": "GABRIEL OWUSU",
        "phone": "0246315586",
        "email": "gowusu@bawjiasecommunitybank.com",
        "role": "GeneralStaff",
        "position": "Staff",
        "department": "SUSU AGENT",
        "branch": "HEAD OFFICE",
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 1769689048721,
        "registrationTime": 0,
        "isArchived": False,
    },
]
app = Flask(__name__, static_folder=None)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)


@app.before_request
def block_disabled_content_modules():
    path = request.path.rstrip("/")
    disabled_prefixes = (
        "/api/content/announcements",
        "/api/content/forms",
        "/api/content/training",
        "/api/uploads/training-video",
        "/api/uploads/training-document",
        "/api/uploads/announcement-asset",
    )
    if any(path.startswith(prefix) for prefix in disabled_prefixes):
        return jsonify({"error": "This module is disabled for the SUSU collection system."}), 410
    return None


STORE_DEFAULTS: dict[str, object] = {
    PRESENCE_STORE_PATH: {},
    PASSWORD_STORE_PATH: {},
    USERS_STORE_PATH: [],
    PENDING_VERIFICATIONS_PATH: {},
    RESET_TOKENS_PATH: {},
    SESSIONS_STORE_PATH: {},
    ANNOUNCEMENTS_STORE_PATH: [],
    FORMS_STORE_PATH: [],
    TRAINING_VIDEOS_STORE_PATH: [],
    TRAINING_DOCUMENTS_STORE_PATH: [],
    NOTIFICATIONS_STORE_PATH: [],
    TRAINING_VIDEO_PROGRESS_STORE_PATH: [],
    TRAINING_DOCUMENT_OPENS_STORE_PATH: [],
    TRAINING_REMINDERS_STORE_PATH: [],
    AUDIT_LOGS_STORE_PATH: [],
    CUSTOMERS_STORE_PATH: [],
    COLLECTIONS_STORE_PATH: [],
}


def initialize_data_directory() -> None:
    for path, default in STORE_DEFAULTS.items():
        if os.path.exists(path):
            continue
        legacy_path = os.path.join(BASE_DIR, os.path.basename(path))
        if path != legacy_path and os.path.exists(legacy_path):
            try:
                os.replace(legacy_path, path)
                continue
            except OSError:
                pass
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(default, handle, ensure_ascii=True, indent=2)


initialize_data_directory()


def seed_password_store_if_needed() -> None:
    if not DEFAULT_INITIAL_PASSWORD:
        return
    existing = read_json_file(PASSWORD_STORE_PATH, {})
    passwords = existing if isinstance(existing, dict) else {}
    changed = False
    for user in [OWNER_ADMIN_USER, *INITIAL_USERS]:
        email = str(user.get("email", "")).strip().lower()
        if not email or passwords.get(email):
            continue
        passwords[email] = hash_password_for_storage(DEFAULT_INITIAL_PASSWORD)
        changed = True
    if changed:
        save_password_store(passwords)


def allowed_origins() -> set[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    return {item.strip() for item in raw.split(",") if item.strip()}


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    origins = allowed_origins()
    if "*" in origins:
        response.headers["Access-Control-Allow-Origin"] = origin or "*"
        response.headers["Vary"] = "Origin"
    elif origin and origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def require_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "JSON body required"}), 400)
    return data, None


def extract_drive_file_id(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("DRIVE:"):
        return raw[6:].strip()
    if "drive.google.com" not in raw:
        return raw
    if "/d/" in raw:
        return raw.split("/d/")[1].split("/")[0].split("?")[0].strip()
    if "id=" in raw:
        return raw.split("id=")[1].split("&")[0].strip()
    return raw


def normalize_visibility_and_department(data: dict) -> tuple[str, str | None]:
    visibility = str(data.get("visibility", "General")).strip()
    if visibility not in {"General", "Department"}:
        raise ValueError("Visibility must be General or Department")
    department = str(data.get("department", "") or "").strip().upper() or None
    if visibility == "Department" and not department:
        raise ValueError("SUSU category is required for category visibility")
    if visibility == "General":
        department = None
    return visibility, department


def normalize_scope_list(value: object, *, empty_default: list[str] | None = None) -> list[str]:
    if not isinstance(value, list):
        return list(empty_default or [])
    normalized: list[str] = []
    seen = set()
    for item in value:
        current = str(item or "").strip().upper()
        if not current:
            continue
        if current == "ALL":
            return ["ALL"]
        if current in seen:
            continue
        seen.add(current)
        normalized.append(current)
    return normalized or list(empty_default or [])


def default_permissions_for_role(role: str) -> dict[str, bool]:
    is_manager = role in GLOBAL_MANAGER_ROLES
    susu_permissions = {
        "customers": is_manager,
        "transactions": is_manager,
        "reports": is_manager,
        "agents": is_manager,
        "branches": is_manager,
        "auditLog": is_manager,
        "backupExport": is_manager,
    }
    if is_manager:
        return {
            "userManagement": True,
            **susu_permissions,
        }
    return {
        "userManagement": False,
        **susu_permissions,
    }


def normalize_user_permissions(value: object, role: str) -> dict[str, bool]:
    defaults = default_permissions_for_role(role)
    if role not in GLOBAL_MANAGER_ROLES and role != "Supervisor":
        return defaults
    if not isinstance(value, dict):
        return defaults
    normalized = dict(defaults)
    for key in defaults:
        if key in value:
            normalized[key] = bool(value.get(key))
    return normalized


def normalize_managed_departments_by_branch(value: object) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, list[str]] = {}
    for branch, departments in value.items():
        branch_key = str(branch or "").strip().upper()
        if not branch_key:
            continue
        normalized_departments = normalize_scope_list(departments, empty_default=[])
        if normalized_departments:
            normalized[branch_key] = normalized_departments
    return normalized


def validate_supervisor_configuration(user: dict) -> None:
    if str(user.get("role", "")).strip() != "Supervisor":
        return
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    if not managed_branches:
        raise ValueError("Supervisors must be assigned at least one branch.")
    for branch in managed_branches:
        if branch == "ALL":
            raise ValueError("Supervisors cannot be assigned to all branches.")


def derive_content_scope(
    data: dict,
    *,
    visibility: str,
    department: str | None,
    existing: dict | None = None,
) -> tuple[list[str], list[str]]:
    branch_scope = normalize_scope_list(
        data.get("branchScope", existing.get("branchScope") if existing else None),
        empty_default=["ALL"],
    )
    department_scope = normalize_scope_list(
        data.get("departmentScope", existing.get("departmentScope") if existing else None),
        empty_default=[],
    )
    if not department_scope:
        department_scope = [department] if visibility == "Department" and department else ["ALL"]
    return branch_scope, department_scope


def normalize_non_empty_title(value: object, label: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{label} is required")
    return normalized


def normalize_storage_type(value: object) -> str:
    normalized = str(value or "Drive").strip()
    if normalized not in {"Drive", "Local"}:
        raise ValueError("Storage type must be Drive or Local")
    return normalized


def normalize_local_filename(value: object) -> str:
    filename = secure_filename(str(value or "").strip())
    if not filename:
        raise ValueError("A valid uploaded file is required")
    if not os.path.isfile(os.path.join(UPLOADS_DIR, filename)):
        raise ValueError("Uploaded file could not be found")
    return filename


def normalize_form_file_url(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Form link is required")
    if "docs.google.com" in raw:
        return raw
    drive_id = extract_drive_file_id(raw)
    if not drive_id:
        raise ValueError("A valid Google Drive link or file ID is required")
    return drive_id


def normalize_announcement_payload(data: dict, actor: dict, existing: dict | None = None) -> dict:
    title = normalize_non_empty_title(
        data.get("title", existing.get("title") if existing else ""),
        "Announcement title",
    )
    content = str(data.get("content", existing.get("content") if existing else "")).strip()
    if not content:
        raise ValueError("Announcement content is required")
    category = str(data.get("category", existing.get("category") if existing else "")).strip() or actor["department"]
    poll = data.get("poll", existing.get("poll") if existing else None)
    if poll is not None and not isinstance(poll, dict):
        raise ValueError("Poll data is invalid")
    allow_download = bool(
        data.get("allowDownload", existing.get("allowDownload", True) if existing else True)
    )
    image_url = data.get("imageUrl", existing.get("imageUrl") if existing else None)
    file_url = data.get("fileUrl", existing.get("fileUrl") if existing else None)
    attachment_name = data.get("attachmentName", existing.get("attachmentName") if existing else None)
    visibility, department = normalize_visibility_and_department(
        {
            "visibility": data.get("visibility", existing.get("visibility") if existing else "General"),
            "department": data.get("department", existing.get("department") if existing else None),
        }
    )
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
        existing=existing,
    )
    return {
        "title": title,
        "content": content,
        "category": category,
        "imageUrl": image_url,
        "fileUrl": file_url,
        "attachmentName": attachment_name,
        "allowDownload": allow_download,
        "poll": poll if isinstance(poll, dict) else None,
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
    }


def normalize_training_video_payload(data: dict, actor: dict) -> dict:
    title = normalize_non_empty_title(data.get("title"), "Video title")
    visibility, department = normalize_visibility_and_department(data)
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
    )
    storage_type = normalize_storage_type(data.get("storageType", "Drive"))
    if storage_type == "Drive":
        drive_ref = extract_drive_file_id(data.get("driveRef") or data.get("videoUrl"))
        if not drive_ref:
            raise ValueError("A valid Google Drive file ID or link is required")
        video_url = f"DRIVE:{drive_ref}"
        local_filename = None
    else:
        local_filename = normalize_local_filename(data.get("localFilename"))
        video_url = f"LOCAL:{local_filename}"
        drive_ref = None
    return {
        "id": next_content_id(load_json_list_store(TRAINING_VIDEOS_STORE_PATH)),
        "title": title,
        "description": str(data.get("description", "")).strip(),
        "videoUrl": video_url,
        "thumbnailUrl": data.get("thumbnailUrl"),
        "duration": max(0, int(data.get("duration", 0) or 0)),
        "category": str(data.get("category", "")).strip() or (department or "General"),
        "visibleTo": [],
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
        "isMandatory": bool(data.get("isMandatory", False)),
        "allowDownload": bool(data.get("allowDownload", False)),
        "storageType": storage_type,
        "driveRef": drive_ref,
        "localFilename": local_filename,
        "uploadedBy": actor["fullname"],
        "uploadedAt": now_ms(),
        "viewCount": max(0, int(data.get("viewCount", 0) or 0)),
        "isArchived": bool(data.get("isArchived", False)),
    }


def normalize_training_document_payload(data: dict, actor: dict) -> dict:
    title = normalize_non_empty_title(data.get("title"), "Document title")
    visibility, department = normalize_visibility_and_department(data)
    branch_scope, department_scope = derive_content_scope(
        data,
        visibility=visibility,
        department=department,
    )
    storage_type = normalize_storage_type(data.get("storageType", "Drive"))
    if storage_type == "Drive":
        drive_ref = str(data.get("driveRef") or "").strip()
        file_url_raw = str(data.get("fileUrl") or "").strip()
        if "docs.google.com" in file_url_raw:
            file_url = file_url_raw
            drive_ref = file_url_raw
        else:
            drive_ref = extract_drive_file_id(drive_ref or file_url_raw)
            if not drive_ref:
                raise ValueError("A valid Google Drive document link or file ID is required")
            file_url = f"DRIVE:{drive_ref}"
        local_filename = None
    else:
        local_filename = normalize_local_filename(data.get("localFilename"))
        file_url = f"LOCAL:{local_filename}"
        drive_ref = None
    return {
        "id": next_content_id(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)),
        "title": title,
        "description": str(data.get("description", "")).strip(),
        "fileUrl": file_url,
        "fileType": str(data.get("fileType", "")).strip() or "application/octet-stream",
        "category": str(data.get("category", "")).strip() or (department or "General"),
        "visibleTo": [],
        "visibility": visibility,
        "department": department,
        "branchScope": branch_scope,
        "departmentScope": department_scope,
        "isMandatory": bool(data.get("isMandatory", False)),
        "allowDownload": bool(data.get("allowDownload", False)),
        "storageType": storage_type,
        "driveRef": drive_ref,
        "localFilename": local_filename,
        "uploadedBy": actor["fullname"],
        "uploadedAt": now_ms(),
        "downloadCount": max(0, int(data.get("downloadCount", 0) or 0)),
        "isArchived": bool(data.get("isArchived", False)),
    }


def parse_session_token() -> str:
    header = str(request.headers.get("Authorization", "")).strip()
    if header.startswith("Bearer "):
        return header[7:].strip()
    query_token = str(request.args.get("sessionToken", "")).strip()
    return query_token


def validate_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    settings = load_portal_settings_store()
    if not normalized.endswith(settings["emailDomain"]):
        raise ValueError("Only official Bawjiase email addresses are allowed")
    return normalized


VALID_CUSTOMER_STATUSES = {"active", "inactive", "suspended"}


def normalize_required_text(value: object, field_label: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{field_label} is required")
    return normalized


def normalize_phone(value: object) -> str:
    phone = str(value or "").strip()
    if not phone:
        return ""
    allowed = set("0123456789+ -()")
    if any(char not in allowed for char in phone):
        raise ValueError("Phone number can only contain numbers, spaces, +, -, and brackets")
    digits = "".join(char for char in phone if char.isdigit())
    if len(digits) < 7:
        raise ValueError("Phone number is too short")
    return phone


def normalize_account_number(value: object) -> str:
    account_number = str(value or "").strip().replace(" ", "")
    if not account_number.isdigit():
        raise ValueError("Account number must contain only digits")
    if len(account_number) != 13:
        raise ValueError("Account number must be exactly 13 digits")
    return account_number


def normalize_customer_status(value: object) -> str:
    status = str(value or "active").strip().lower()
    if status not in VALID_CUSTOMER_STATUSES:
        raise ValueError("Customer status must be active, inactive, or suspended")
    return status


def normalize_portal_branch_name(value: object) -> str:
    branch = str(value or "").strip().upper()
    if not branch:
        raise ValueError("Branch is required")
    settings = load_portal_settings_store()
    valid = {str(item).strip().upper() for item in settings.get("branches", [])}
    if valid and branch not in valid:
        raise ValueError("Branch must be selected from Portal Control")
    return branch


def normalize_portal_department_name(value: object) -> str:
    department = str(value or "").strip().upper()
    if not department:
        raise ValueError("SUSU category is required")
    if department not in SUSU_DEPARTMENTS:
        raise ValueError("SUSU category must be SUSU or SUSU AGENT")
    return department


def role_from_department(department: str) -> str:
    return "GeneralStaff"


def is_global_manager(user: dict | None) -> bool:
    return bool(user) and str(user.get("role", "")).strip() in GLOBAL_MANAGER_ROLES


def is_owner_admin(user: dict | None) -> bool:
    return bool(user) and str(user.get("role", "")).strip() == OWNER_ADMIN_ROLE


def user_has_permission(user: dict, permission_key: str) -> bool:
    if is_global_manager(user):
        return True
    permissions = user.get("permissions")
    if not isinstance(permissions, dict):
        return False
    return bool(permissions.get(permission_key, False))


def now_ms() -> int:
    return int(time.time() * 1000)


def now_seconds() -> int:
    return int(time.time())


def legacy_hash_password(password: str) -> str:
    h = 0
    for char in password:
        h = ((31 * h) + ord(char)) & 0xFFFFFFFF
        if h & 0x80000000:
            h -= 0x100000000
    return str(abs(h))


def is_secure_password_hash(value: str) -> bool:
    return value.startswith("pbkdf2:") or value.startswith("scrypt:")


def hash_password_for_storage(password: str) -> str:
    return generate_password_hash(password)


def verify_password(stored_value: str, password: str) -> bool:
    if is_secure_password_hash(stored_value):
        try:
            return check_password_hash(stored_value, password)
        except ValueError:
            return False
    return stored_value == legacy_hash_password(password)


def atomic_write_json(path: str, payload) -> None:
    directory = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(prefix="tmp-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=True, indent=2)
        last_error = None
        for attempt in range(8):
            try:
                os.replace(tmp_path, path)
                last_error = None
                break
            except PermissionError as exc:
                last_error = exc
                time.sleep(0.05 * (attempt + 1))
        if last_error:
            raise last_error
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def read_json_file(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return default


def normalize_user(raw: dict) -> dict:
    raw_email = str(raw.get("email", "")).strip().lower()
    login_username = str(raw.get("loginUsername", "") or raw.get("username", "")).strip().lower()
    if raw_email.endswith("@agents.local") or (not raw_email and login_username):
        email = raw_email or f"{login_username}@agents.local"
    else:
        email = validate_email(raw_email)
    department = str(raw.get("department", "")).strip().upper()
    if department not in SUSU_DEPARTMENTS:
        department = "SUSU AGENT"
    branch = str(raw.get("branch", "")).strip().upper()
    role = str(raw.get("role", role_from_department(department))).strip() or role_from_department(department)
    if email == "sitecreator@bawjiasecommunitybank.com" or str(raw.get("id", "")).strip() == "owner-admin-1":
        role = OWNER_ADMIN_ROLE
    return {
        "id": str(raw.get("id", "")).strip(),
        "fullname": str(raw.get("fullname", "")).strip(),
        "phone": str(raw.get("phone", "")).strip(),
        "email": email,
        "role": role,
        "position": str(raw.get("position", "")).strip() or "Staff",
        "department": department,
        "branch": branch,
        "imageFile": raw.get("imageFile"),
        "managedBranches": normalize_scope_list(
            raw.get("managedBranches"),
            empty_default=["ALL"] if role in GLOBAL_MANAGER_ROLES else [],
        ),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            raw.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(raw.get("permissions"), role),
        "isActive": bool(raw.get("isActive", True)),
        "isVerified": bool(raw.get("isVerified", True)),
        "lastSeen": normalize_last_seen_ms(raw.get("lastSeen", 0)),
        "registrationTime": int(raw.get("registrationTime", 0) or 0),
        "isArchived": bool(raw.get("isArchived", False)),
        "loginUsername": login_username,
        "createdBySupervisorId": str(raw.get("createdBySupervisorId", "") or "").strip(),
        "createdBySupervisorName": str(raw.get("createdBySupervisorName", "") or "").strip(),
        "forcePasswordChange": bool(raw.get("forcePasswordChange", False)),
        "setupComplete": bool(raw.get("setupComplete", True)),
    }


def load_user_store() -> list[dict]:
    raw = read_json_file(USERS_STORE_PATH, [])
    users_by_email = {}
    for default_user in [OWNER_ADMIN_USER, *INITIAL_USERS]:
        normalized = normalize_user(default_user)
        users_by_email[normalized["email"]] = normalized
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                try:
                    normalized = normalize_user(item)
                    users_by_email[normalized["email"]] = normalized
                except ValueError:
                    continue
    return list(users_by_email.values())


def save_user_store(users: list[dict]) -> None:
    normalized = []
    for user in users:
        try:
            normalized.append(normalize_user(user))
        except ValueError:
            continue
    atomic_write_json(USERS_STORE_PATH, normalized)


def find_user_by_email(users: list[dict], email: str):
    return next((user for user in users if user["email"] == email), None)


def find_user_by_id(users: list[dict], user_id: str):
    return next((user for user in users if user["id"] == user_id), None)


def load_presence_store() -> dict[str, int]:
    raw = read_json_file(PRESENCE_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {
        str(user_id): int(timestamp)
        for user_id, timestamp in raw.items()
        if str(user_id) and isinstance(timestamp, (int, float, str))
    }


def normalize_last_seen_ms(value: object) -> int:
    try:
        last_seen = int(value or 0)
    except (TypeError, ValueError):
        return 0
    if last_seen <= 0:
        return 0
    current = now_ms()
    if last_seen > current + 60_000:
        return 0
    return last_seen


def user_has_active_session(user_id: str) -> bool:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return False
    sessions = load_sessions()
    return any(str(session.get("userId", "")).strip() == normalized_user_id for session in sessions.values())


def presence_is_online(presence_timestamp: object, user_id: str | None = None) -> bool:
    value = normalize_presence_timestamp(int(presence_timestamp or 0))
    if value <= 0:
        return False
    return value >= now_seconds() - ONLINE_WINDOW_SECONDS


def set_user_last_seen(user_id: str, last_seen_ms: int | None) -> None:
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return
    user["lastSeen"] = normalize_last_seen_ms(last_seen_ms or 0)
    save_user_store(users)


def normalize_presence_timestamp(timestamp: int) -> int:
    value = int(timestamp or 0)
    if value <= 0:
        return 0
    # Older builds may have written milliseconds instead of seconds.
    if value > 10_000_000_000:
        value = value // 1000
    now = int(time.time())
    # Discard obviously broken future timestamps.
    if value > now + 60:
        return 0
    return value


def save_presence_store(store: dict[str, int]) -> None:
    atomic_write_json(PRESENCE_STORE_PATH, store)


def prune_presence(store: dict[str, int]) -> dict[str, int]:
    cutoff = int(time.time()) - PRESENCE_TTL_SECONDS
    return {
        str(user_id): normalize_presence_timestamp(timestamp)
        for user_id, timestamp in store.items()
        if str(user_id).strip()
        and normalize_presence_timestamp(timestamp) >= cutoff
    }


def serialize_user_with_presence(user: dict, presence: dict[str, int] | None = None) -> dict:
    presence_map = presence if presence is not None else prune_presence(load_presence_store())
    serialized = dict(user)
    user_id = str(serialized.get("id", "")).strip()
    last_seen = normalize_last_seen_ms(serialized.get("lastSeen", 0))
    serialized["lastSeen"] = last_seen
    serialized["isOnlineNow"] = presence_is_online(presence_map.get(user_id, 0), user_id)
    return serialized


def serialize_users_with_presence(users: list[dict]) -> list[dict]:
    presence = prune_presence(load_presence_store())
    save_presence_store(presence)
    return [serialize_user_with_presence(user, presence) for user in users]


def load_password_store() -> dict[str, str]:
    raw = read_json_file(PASSWORD_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {
        email.strip().lower(): password_hash
        for email, password_hash in raw.items()
        if isinstance(email, str) and isinstance(password_hash, str) and password_hash
    }


def save_password_store(store: dict[str, str]) -> None:
    normalized = {
        str(email).strip().lower(): str(password_hash).strip()
        for email, password_hash in store.items()
        if str(email).strip() and str(password_hash).strip()
    }
    atomic_write_json(PASSWORD_STORE_PATH, normalized)


seed_password_store_if_needed()


def load_pending_verifications() -> dict[str, dict]:
    raw = read_json_file(PENDING_VERIFICATIONS_PATH, {})
    if not isinstance(raw, dict):
        return {}
    pending = {}
    current = int(time.time())
    for email, item in raw.items():
        if not isinstance(item, dict):
            continue
        try:
            normalized_email = validate_email(email)
        except ValueError:
            continue
        expires_at = int(item.get("expiresAt", 0) or 0)
        if expires_at <= current:
            continue
        user = item.get("user")
        password_hash = str(item.get("passwordHash", "")).strip()
        code = "".join(ch for ch in str(item.get("code", "")) if ch.isdigit())
        if not isinstance(user, dict) or len(code) != 6 or not password_hash:
            continue
        try:
            pending[normalized_email] = {
                "user": normalize_user(user),
                "passwordHash": password_hash,
                "code": code,
                "expiresAt": expires_at,
            }
        except ValueError:
            continue
    return pending


def save_pending_verifications(store: dict[str, dict]) -> None:
    atomic_write_json(PENDING_VERIFICATIONS_PATH, store)


def load_reset_tokens() -> dict[str, dict]:
    raw = read_json_file(RESET_TOKENS_PATH, {})
    if not isinstance(raw, dict):
        return {}
    current = int(time.time())
    tokens = {}
    for token, item in raw.items():
        if not isinstance(token, str) or not isinstance(item, dict):
            continue
        expires_at = int(item.get("expiresAt", 0) or 0)
        if expires_at <= current:
            continue
        try:
            email = validate_email(str(item.get("email", "")))
        except ValueError:
            continue
        tokens[token] = {
            "email": email,
            "expiresAt": expires_at,
        }
    return tokens


def save_reset_tokens(store: dict[str, dict]) -> None:
    atomic_write_json(RESET_TOKENS_PATH, store)


def load_json_list_store(path: str) -> list[dict]:
    raw = read_json_file(path, [])
    return raw if isinstance(raw, list) else []


def save_json_list_store(path: str, items: list[dict]) -> None:
    atomic_write_json(path, items)


def normalize_portal_branches(values) -> list[str]:
    seen = set()
    branches = []
    if not isinstance(values, list):
        values = []
    for value in values:
        branch = str(value or "").strip().upper()
        if not branch or branch in seen:
            continue
        seen.add(branch)
        branches.append(branch)
    return branches or list(DEFAULT_PORTAL_BRANCHES)


def normalize_portal_list(values, fallback: list[str], uppercase: bool = False) -> list[str]:
    seen = set()
    items = []
    if not isinstance(values, list):
        values = []
    for value in values:
        item = str(value or "").strip()
        if uppercase:
            item = item.upper()
        key = item.upper()
        if not item or key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items or list(fallback)


def merge_missing_portal_defaults(values: list[str], defaults: list[str], uppercase: bool = False) -> list[str]:
    items = normalize_portal_list(values, defaults, uppercase)
    seen = {str(item).strip().upper() for item in items}
    for value in defaults:
        item = str(value or "").strip()
        if uppercase:
            item = item.upper()
        key = item.upper()
        if item and key not in seen:
            items.append(item)
            seen.add(key)
    return items


def normalize_email_domain(value) -> str:
    domain = str(value or "").strip().lower()
    if not domain:
        return OFFICIAL_EMAIL_DOMAIN
    domain = domain.replace(" ", "")
    if not domain.startswith("@"):
        domain = f"@{domain}"
    return domain


def normalize_positive_number(value, fallback: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return fallback
    return number if number > 0 else fallback


def load_portal_settings_store() -> dict:
    raw = read_json_file(PORTAL_SETTINGS_STORE_PATH, {})
    if not isinstance(raw, dict):
        raw = {}
    return {
        "bankName": str(raw.get("bankName") or DEFAULT_PORTAL_SETTINGS["bankName"]).strip(),
        "shortBankName": str(raw.get("shortBankName") or DEFAULT_PORTAL_SETTINGS["shortBankName"]).strip(),
        "portalName": str(raw.get("portalName") or DEFAULT_PORTAL_SETTINGS["portalName"]).strip(),
        "emailDomain": normalize_email_domain(raw.get("emailDomain")),
        "branches": normalize_portal_branches(raw.get("branches")),
        "departments": DEFAULT_PORTAL_DEPARTMENTS,
        "formCategories": [],
        "trainingCategories": [],
        "supportIssueCategories": [],
        "supportRequestTypes": [],
        "departmentChangeTypes": [],
        "transferLocations": [],
        "loginSubtitle": str(raw.get("loginSubtitle") or DEFAULT_PORTAL_SETTINGS["loginSubtitle"]),
        "loginButtonText": str(raw.get("loginButtonText") or DEFAULT_PORTAL_SETTINGS["loginButtonText"]),
        "authorizedAccessText": str(raw.get("authorizedAccessText") or DEFAULT_PORTAL_SETTINGS["authorizedAccessText"]),
        "portalControlPassword": str(raw.get("portalControlPassword") or DEFAULT_PORTAL_SETTINGS["portalControlPassword"]),
        "itAccessCode": str(raw.get("itAccessCode") or DEFAULT_PORTAL_SETTINGS["itAccessCode"]),
        "hrAccessCode": str(raw.get("hrAccessCode") or DEFAULT_PORTAL_SETTINGS["hrAccessCode"]),
        "sessionDays": normalize_positive_number(raw.get("sessionDays"), DEFAULT_PORTAL_SETTINGS["sessionDays"]),
        "verificationMinutes": normalize_positive_number(raw.get("verificationMinutes"), DEFAULT_PORTAL_SETTINGS["verificationMinutes"]),
        "passwordResetMinutes": normalize_positive_number(raw.get("passwordResetMinutes"), DEFAULT_PORTAL_SETTINGS["passwordResetMinutes"]),
        "videoUploadLimitMb": normalize_positive_number(raw.get("videoUploadLimitMb"), DEFAULT_PORTAL_SETTINGS["videoUploadLimitMb"]),
        "documentUploadLimitMb": normalize_positive_number(raw.get("documentUploadLimitMb"), DEFAULT_PORTAL_SETTINGS["documentUploadLimitMb"]),
        "dashboardLabel": str(raw.get("dashboardLabel") or DEFAULT_PORTAL_SETTINGS["dashboardLabel"]),
        "trainingLabel": str(raw.get("trainingLabel") or DEFAULT_PORTAL_SETTINGS["trainingLabel"]),
        "formsLabel": str(raw.get("formsLabel") or DEFAULT_PORTAL_SETTINGS["formsLabel"]),
        "supportLabel": str(raw.get("supportLabel") or DEFAULT_PORTAL_SETTINGS["supportLabel"]),
        "appMode": "live" if str(raw.get("appMode", DEFAULT_PORTAL_SETTINGS["appMode"])).strip().lower() == "live" else "test",
        "profileLabel": str(raw.get("profileLabel") or DEFAULT_PORTAL_SETTINGS["profileLabel"]),
        "activeStaffLabel": str(raw.get("activeStaffLabel") or DEFAULT_PORTAL_SETTINGS["activeStaffLabel"]),
        "branchCoverageLabel": str(raw.get("branchCoverageLabel") or DEFAULT_PORTAL_SETTINGS["branchCoverageLabel"]),
        "openOperationsLabel": str(raw.get("openOperationsLabel") or DEFAULT_PORTAL_SETTINGS["openOperationsLabel"]),
        "resolutionRateLabel": str(raw.get("resolutionRateLabel") or DEFAULT_PORTAL_SETTINGS["resolutionRateLabel"]),
        "updatedAt": int(raw.get("updatedAt", 0) or 0),
        "updatedBy": raw.get("updatedBy") if isinstance(raw.get("updatedBy"), dict) else None,
    }


def save_portal_settings_store(settings: dict) -> None:
    atomic_write_json(PORTAL_SETTINGS_STORE_PATH, settings)


def next_content_id(items: list[dict], floor: int = 1000) -> int:
    current = floor - 1
    for item in items:
        try:
            current = max(current, int(item.get("id", 0) or 0))
        except Exception:
            continue
    return current + 1


def request_ip_address() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"
    return str(request.remote_addr or "unknown")


def load_audit_logs_store() -> list[dict]:
    items = load_json_list_store(AUDIT_LOGS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "id": int(item.get("id", 0) or 0),
                    "actorId": str(item.get("actorId", "") or "system"),
                    "actorName": str(item.get("actorName", "") or "System"),
                    "action": str(item.get("action", "")).strip(),
                    "target": str(item.get("target", "")).strip(),
                    "ipAddress": str(item.get("ipAddress", "") or "unknown"),
                    "timestamp": int(item.get("timestamp", 0) or 0),
                }
            )
        except Exception:
            continue
    return [
        item
        for item in normalized
        if item["id"] > 0 and item["action"] and item["target"] and item["timestamp"] > 0
    ]


def save_audit_logs_store(items: list[dict]) -> None:
    save_json_list_store(AUDIT_LOGS_STORE_PATH, items[:1000])


def record_audit_log(
    actor: dict | None,
    action: str,
    target: object,
    ip_address: str | None = None,
) -> dict:
    logs = load_audit_logs_store()
    target_text = (
        target
        if isinstance(target, str)
        else json.dumps(target, ensure_ascii=True, sort_keys=True)
    )
    entry = {
        "id": next_content_id(logs, floor=1),
        "actorId": str(actor.get("id", "system") if actor else "system"),
        "actorName": str(actor.get("fullname", "System") if actor else "System"),
        "action": str(action or "").strip().upper(),
        "target": str(target_text or "").strip(),
        "ipAddress": ip_address or request_ip_address(),
        "timestamp": now_ms(),
    }
    logs.insert(0, entry)
    save_audit_logs_store(logs)
    return entry


def record_content_audit(actor: dict, action: str, module: str, item: dict | None) -> None:
    if not item:
        return
    record_audit_log(
        actor,
        action,
        {
            "module": module,
            "id": int(item.get("id", 0) or 0),
            "title": str(item.get("title", "")).strip(),
            "branchScope": item_branch_scope(item),
            "departmentScope": item_department_scope(item),
        },
    )


def staff_audit_target(user: dict, extra: dict | None = None) -> dict:
    target = {
        "staffId": str(user.get("id", "")),
        "staffName": str(user.get("fullname", "")),
        "email": str(user.get("email", "")),
        "role": str(user.get("role", "")),
        "department": str(user.get("department", "")),
        "branch": str(user.get("branch", "")),
    }
    if extra:
        target.update(extra)
    return target


def load_training_video_progress_store() -> list[dict]:
    items = load_json_list_store(TRAINING_VIDEO_PROGRESS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "userId": str(item.get("userId", "")).strip(),
                    "videoId": int(item.get("videoId", 0) or 0),
                    "progressPercent": max(0, min(100, int(item.get("progressPercent", 0) or 0))),
                    "isComplete": bool(item.get("isComplete", False)),
                    "lastWatched": int(item.get("lastWatched", 0) or 0),
                }
            )
        except Exception:
            continue
    return [item for item in normalized if item["userId"] and item["videoId"] > 0]


def save_training_video_progress_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_VIDEO_PROGRESS_STORE_PATH, items)


def load_training_document_opens_store() -> list[dict]:
    items = load_json_list_store(TRAINING_DOCUMENT_OPENS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "userId": str(item.get("userId", "")).strip(),
                    "documentId": int(item.get("documentId", 0) or 0),
                    "openedAt": int(item.get("openedAt", 0) or 0),
                }
            )
        except Exception:
            continue
    return [item for item in normalized if item["userId"] and item["documentId"] > 0]


def save_training_document_opens_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_DOCUMENT_OPENS_STORE_PATH, items)


def load_training_reminders_store() -> list[dict]:
    items = load_json_list_store(TRAINING_REMINDERS_STORE_PATH)
    normalized = []
    for item in items:
        try:
            normalized.append(
                {
                    "kind": str(item.get("kind", "")).strip(),
                    "itemId": int(item.get("itemId", 0) or 0),
                    "userId": str(item.get("userId", "")).strip(),
                    "sentAt": int(item.get("sentAt", 0) or 0),
                }
            )
        except Exception:
            continue
    return [
        item
        for item in normalized
        if item["kind"] and item["itemId"] > 0 and item["userId"] and item["sentAt"] > 0
    ]


def save_training_reminders_store(items: list[dict]) -> None:
    atomic_write_json(TRAINING_REMINDERS_STORE_PATH, items)


def load_sessions() -> dict[str, dict]:
    raw = read_json_file(SESSIONS_STORE_PATH, {})
    if not isinstance(raw, dict):
        return {}
    current = now_seconds()
    sessions = {}
    for token, item in raw.items():
        if not isinstance(token, str) or not isinstance(item, dict):
            continue
        user_id = str(item.get("userId", "")).strip()
        expires_at = int(item.get("expiresAt", 0) or 0)
        if not user_id or expires_at <= current:
            continue
        sessions[token] = {
            "userId": user_id,
            "expiresAt": expires_at,
        }
    return sessions


def save_sessions(store: dict[str, dict]) -> None:
    atomic_write_json(SESSIONS_STORE_PATH, store)


def issue_session(user_id: str) -> str:
    sessions = load_sessions()
    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "userId": user_id,
        "expiresAt": now_seconds() + int(load_portal_settings_store()["sessionDays"]) * 24 * 60 * 60,
    }
    save_sessions(sessions)
    return token


def revoke_session(token: str) -> None:
    sessions = load_sessions()
    if token in sessions:
        sessions.pop(token, None)
        save_sessions(sessions)


def revoke_user_sessions(user_id: str) -> None:
    sessions = load_sessions()
    filtered = {
        token: session
        for token, session in sessions.items()
        if session.get("userId") != user_id
    }
    if filtered != sessions:
        save_sessions(filtered)

def require_authenticated_user():
    token = parse_session_token()
    if not token:
        return None, None, (jsonify({"error": "Authentication required"}), 401)
    sessions = load_sessions()
    session = sessions.get(token)
    if not session:
        return None, None, (jsonify({"error": "Invalid or expired session"}), 401)
    users = load_user_store()
    user = find_user_by_id(users, session["userId"])
    if not user or user["isArchived"] or not user["isActive"] or not user["isVerified"]:
        revoke_session(token)
        return None, None, (jsonify({"error": "Invalid or expired session"}), 401)
    return token, user, None


def require_staff_manager():
    token, user, error = require_authenticated_user()
    if error:
        return token, user, error
    if not is_owner_admin(user):
        return token, user, (jsonify({"error": "Admin access required"}), 403)
    return token, user, None


def require_owner_admin():
    token, user, error = require_authenticated_user()
    if error:
        return token, user, error
    if not is_owner_admin(user):
        return token, user, (jsonify({"error": "Owner admin access required"}), 403)
    return token, user, None


def require_module_manager(permission_key: str):
    token, user, error = require_authenticated_user()
    if error:
        return token, user, error
    if permission_key in DISABLED_CONTENT_MODULES:
        return token, user, (jsonify({"error": "This module is disabled for the SUSU collection system."}), 410)
    if not user_has_permission(user, permission_key):
        return token, user, (jsonify({"error": "Admin access required"}), 403)
    return token, user, None


def generate_verification_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def build_reset_url(base_url: str, token: str) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("A valid reset page URL is required")
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["token"] = token
    return urlunparse(parsed._replace(query=urlencode(query)))


def mail_config() -> dict[str, str | int]:
    required = {
        "MAIL_SERVER": os.getenv("MAIL_SERVER", ""),
        "MAIL_USERNAME": os.getenv("MAIL_USERNAME", ""),
        "MAIL_PASSWORD": os.getenv("MAIL_PASSWORD", ""),
        "MAIL_DEFAULT_SENDER": os.getenv("MAIL_DEFAULT_SENDER", ""),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing mail configuration: {', '.join(missing)}")
    return {
        **required,
        "MAIL_PORT": int(os.getenv("MAIL_PORT", "465")),
    }


def send_mail(to_email: str, subject: str, text_body: str, html_body: str):
    cfg = mail_config()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = str(cfg["MAIL_DEFAULT_SENDER"])
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP_SSL(str(cfg["MAIL_SERVER"]), int(cfg["MAIL_PORT"]), timeout=30) as smtp:
        smtp.login(str(cfg["MAIL_USERNAME"]), str(cfg["MAIL_PASSWORD"]))
        smtp.send_message(msg)


def send_verification_code_email(email: str, code: str) -> None:
    text_body = (
        "Dear Staff,\n\n"
        f"Your Bawjiase SUSU Collection Portal verification code is: {code}\n\n"
        "This code expires in 15 minutes.\n\n"
        "Thank you.\nBawjiase Community Bank PLC"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">Email Verification</h2>
          <p>Dear Staff,</p>
          <p>Use this code to verify your email address for the <strong>Bawjiase SUSU Collection Portal</strong>:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; border: 2px solid #15803d; color: #15803d; padding: 14px 28px; font-size: 24px; font-weight: 700; border-radius: 8px; letter-spacing: 5px;">{code}</span>
          </div>
          <p>This code expires in 15 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(email, "Bawjiase SUSU Collection Portal - Email Verification Code", text_body, html_body)


def send_password_reset_link_email(email: str, reset_url: str) -> None:
    text_body = (
        "Dear Staff,\n\n"
        "Use the link below to reset your Bawjiase SUSU Collection Portal password:\n"
        f"{reset_url}\n\n"
        "This link expires in 30 minutes.\n\n"
        "Bawjiase Community Bank PLC"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">Password Reset</h2>
          <p>Dear Staff,</p>
          <p>Use the button below to reset your Bawjiase SUSU Collection Portal password.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="{reset_url}" style="background: #15803d; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700;">Reset Password</a>
          </p>
          <p>This link expires in 30 minutes.</p>
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(email, "Bawjiase SUSU Collection Portal - Password Reset", text_body, html_body)


def portal_public_url() -> str:
    return os.getenv("PORTAL_PUBLIC_URL", "").strip().rstrip("/")


def build_portal_link(path: str) -> str | None:
    base = portal_public_url()
    if not base:
        return None
    return f"{base}{path if path.startswith('/') else f'/{path}'}"


def eligible_users_for_visibility(visibility: str, department: str | None = None) -> list[dict]:
    normalized_visibility = str(visibility or "General").strip()
    normalized_department = str(department or "").strip().upper()
    users = load_user_store()
    eligible = [
        user
        for user in users
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    if normalized_visibility == "Department" and normalized_department:
        return [
            user
            for user in eligible
            if str(user.get("department", "")).strip().upper() == normalized_department
        ]
    return eligible


def item_branch_scope(item: dict) -> list[str]:
    return normalize_scope_list(item.get("branchScope"), empty_default=["ALL"])


def item_department_scope(item: dict) -> list[str]:
    derived_department = str(item.get("department", "")).strip().upper()
    empty_default = [derived_department] if derived_department and str(item.get("visibility", "General")).strip() == "Department" else ["ALL"]
    return normalize_scope_list(item.get("departmentScope"), empty_default=empty_default)


def value_in_scope(scope: list[str], current_value: str) -> bool:
    if "ALL" in scope:
        return True
    return str(current_value or "").strip().upper() in scope


def branch_allowed_for_user(user: dict, branch: str) -> bool:
    if is_global_manager(user):
        return True
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    return value_in_scope(managed_branches, branch)


def department_allowed_for_user(user: dict, branch: str, department: str) -> bool:
    if is_global_manager(user):
        return True
    managed = normalize_managed_departments_by_branch(user.get("managedDepartmentsByBranch"))
    branch_departments = managed.get(str(branch or "").strip().upper())
    if not branch_departments:
        return False
    return value_in_scope(branch_departments, department)


def can_manage_scope(user: dict, branch_scope: list[str], department_scope: list[str]) -> bool:
    if is_global_manager(user):
        return True
    if "ALL" in branch_scope:
        return False
    normalized_departments = department_scope if department_scope else ["ALL"]
    managed_departments = normalize_managed_departments_by_branch(
        user.get("managedDepartmentsByBranch")
    )
    for branch in [item for item in branch_scope if item != "ALL"]:
        if not branch_allowed_for_user(user, branch):
            return False
        branch_managed_departments = managed_departments.get(branch, [])
        for department in normalized_departments:
            if department == "ALL":
                if "ALL" not in branch_managed_departments:
                    return False
            elif not department_allowed_for_user(user, branch, department):
                return False
    return True


def is_assigned_supervisor(user: dict | None) -> bool:
    if not user or str(user.get("role", "")).strip() != "Supervisor":
        return False
    return bool(normalize_scope_list(user.get("managedBranches"), empty_default=[]))


def is_susu_agent(user: dict | None) -> bool:
    return bool(user) and str(user.get("department", "")).strip().upper() == "SUSU AGENT"


def can_manage_agents_and_customers(user: dict | None) -> bool:
    return is_global_manager(user) or is_assigned_supervisor(user)


def managed_branch_for_user(user: dict, requested_branch: object = None) -> str:
    requested = str(requested_branch or "").strip().upper()
    if is_global_manager(user):
        return normalize_portal_branch_name(requested or user.get("branch"))
    managed = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    branch = requested or str(user.get("branch") or "").strip().upper()
    if not branch and managed:
        branch = managed[0]
    branch = normalize_portal_branch_name(branch)
    if not branch_allowed_for_user(user, branch):
        raise ValueError("You can only manage records for your assigned branch.")
    return branch


def normalize_agent_username(value: object) -> str:
    username = str(value or "").strip().lower()
    if len(username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789._-")
    if any(char not in allowed for char in username):
        raise ValueError("Username can only contain letters, numbers, dot, dash, and underscore.")
    return username


def agent_password_key(username: str) -> str:
    return f"username:{normalize_agent_username(username)}"


def find_user_by_username(users: list[dict], username: str):
    normalized = normalize_agent_username(username)
    return next((user for user in users if str(user.get("loginUsername", "")).strip().lower() == normalized), None)


def find_user_by_username_safe(users: list[dict], username: object):
    try:
        return find_user_by_username(users, normalize_agent_username(username))
    except ValueError:
        return None


def can_view_operational_record(user: dict, item: dict) -> bool:
    if is_global_manager(user) or user_has_permission(user, "userManagement"):
        return True
    branch = str(item.get("branch_name") or item.get("branch_id") or item.get("branch") or "").strip().upper()
    if is_assigned_supervisor(user):
        return branch_allowed_for_user(user, branch)
    is_customer_record = "account_number" in item and "amount" not in item and "agent_id" not in item
    if is_susu_agent(user) and is_customer_record:
        return branch == str(user.get("branch") or "").strip().upper()
    owner_ids = {
        str(item.get("createdById", "") or ""),
        str(item.get("agent_id", "") or ""),
        str(item.get("recordedById", "") or ""),
    }
    owner_emails = {
        str(item.get("createdByEmail", "") or "").strip().lower(),
        str(item.get("agent_email", "") or "").strip().lower(),
        str(item.get("recordedByEmail", "") or "").strip().lower(),
    }
    owner_names = {
        str(item.get("createdBy", "") or "").strip().lower(),
        str(item.get("agent_name", "") or "").strip().lower(),
        str(item.get("recorded_by", "") or "").strip().lower(),
    }
    return (
        str(user.get("id", "")) in owner_ids
        or str(user.get("email", "")).strip().lower() in owner_emails
        or str(user.get("fullname", "")).strip().lower() in owner_names
    )


def can_view_staff_record(viewer: dict, staff_user: dict) -> bool:
    if is_global_manager(viewer) or user_has_permission(viewer, "userManagement"):
        return True
    if str(viewer.get("id")) == str(staff_user.get("id")):
        return True
    if not is_assigned_supervisor(viewer):
        return False
    return branch_allowed_for_user(viewer, staff_user.get("branch", ""))


def manageable_scope_message(user: dict) -> str:
    if is_global_manager(user):
        return "You can manage all branches and SUSU categories."
    managed_branches = normalize_scope_list(user.get("managedBranches"), empty_default=[])
    managed_departments = normalize_managed_departments_by_branch(
        user.get("managedDepartmentsByBranch")
    )
    if not managed_branches:
        return "No supervisor branch scope is assigned to your account."
    parts = []
    for branch in managed_branches:
        departments = managed_departments.get(branch, [])
        label = "all SUSU categories" if "ALL" in departments else ", ".join(departments)
        parts.append(f"{branch} > {label or 'no SUSU category'}")
    return f"You can only manage: {'; '.join(parts)}."


def ensure_content_management_access(
    user: dict,
    *,
    permission_key: str,
    branch_scope: list[str],
    department_scope: list[str],
) -> tuple[bool, tuple]:
    if not user_has_permission(user, permission_key):
        return False, (jsonify({"error": "You do not have permission to manage this module"}), 403)
    if not can_manage_scope(user, branch_scope, department_scope):
        return False, (
            jsonify({"error": manageable_scope_message(user)}),
            403,
        )
    return True, ()


def scoped_access_denial(user: dict):
    return jsonify({"error": manageable_scope_message(user)}), 403


def eligible_users_for_item(item: dict) -> list[dict]:
    users = load_user_store()
    eligible = [
        user
        for user in users
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    branch_scope = item_branch_scope(item)
    department_scope = item_department_scope(item)
    return [
        user
        for user in eligible
        if value_in_scope(branch_scope, str(user.get("branch", "")))
        and value_in_scope(department_scope, str(user.get("department", "")))
    ]


def user_can_access_item(user: dict, item: dict) -> bool:
    if bool(item.get("isArchived", False)):
        return False
    return value_in_scope(item_branch_scope(item), str(user.get("branch", ""))) and value_in_scope(
        item_department_scope(item), str(user.get("department", ""))
    )


def filter_items_for_user(items: list[dict], user: dict) -> list[dict]:
    return [item for item in items if user_can_access_item(user, item)]


def user_can_manage_item(user: dict, item: dict, permission_key: str) -> bool:
    if is_global_manager(user):
        return True
    if not user_has_permission(user, permission_key):
        return False
    return can_manage_scope(user, item_branch_scope(item), item_department_scope(item))


def create_notifications_for_users(
    users: list[dict],
    *,
    kind: str,
    title: str,
    message: str,
    link_to: str | None,
) -> int:
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    created_at = now_ms()
    count = 0
    for user in users:
        items.insert(
            0,
            {
                "id": next_content_id(items, floor=1),
                "userId": user["id"],
                "kind": kind,
                "title": title,
                "message": message,
                "linkTo": link_to,
                "isRead": False,
                "createdAt": created_at,
            },
        )
        count += 1
    save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return count


def notify_active_managers(*, kind: str, title: str, message: str, link_to: str | None) -> int:
    users = [
        user
        for user in load_user_store()
        if user.get("isActive")
        and user.get("isVerified")
        and not user.get("isArchived")
        and (
            str(user.get("role")) in GLOBAL_MANAGER_ROLES
            or user_has_permission(user, "userManagement")
        )
    ]
    return create_notifications_for_users(
        users,
        kind=kind,
        title=title,
        message=message,
        link_to=link_to,
    )


def send_content_notification_email(
    *,
    to_email: str,
    subject: str,
    headline: str,
    intro: str,
    item_title: str,
    link_to: str | None,
) -> None:
    action_line = f"Open the portal here: {link_to}" if link_to else "Open the SUSU collection portal to view the new item."
    text_body = (
        "Dear Staff,\n\n"
        f"{intro}\n\n"
        f"Item: {item_title}\n"
        f"{action_line}\n\n"
        "Bawjiase Community Bank PLC"
    )
    action_html = (
        f'<p style="text-align: center; margin: 28px 0;">'
        f'<a href="{link_to}" style="background: #15803d; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 700;">Open Portal</a>'
        f"</p>"
        if link_to
        else "<p>Open the SUSU collection portal to view the new item.</p>"
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #15803d; text-align: center;">{headline}</h2>
          <p>Dear Staff,</p>
          <p>{intro}</p>
          <div style="margin: 18px 0; padding: 16px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
            <strong>{item_title}</strong>
          </div>
          {action_html}
          <p style="font-weight: 700; color: #4b5563;">Bawjiase Community Bank PLC</p>
        </div>
      </body>
    </html>
    """
    send_mail(to_email, subject, text_body, html_body)


def fanout_content_notification(
    *,
    kind: str,
    title: str,
    message: str,
    email_subject: str,
    email_headline: str,
    email_intro: str,
    item_title: str,
    visibility: str,
    department: str | None,
    link_to: str | None,
    branch_scope: list[str] | None = None,
    department_scope: list[str] | None = None,
    send_external_emails: bool = False,
) -> dict[str, int]:
    users = eligible_users_for_item(
        {
            "visibility": visibility,
            "department": department,
            "branchScope": branch_scope or ["ALL"],
            "departmentScope": department_scope or ([department] if department else ["ALL"]),
        }
    )
    notification_count = create_notifications_for_users(
        users,
        kind=kind,
        title=title,
        message=message,
        link_to=link_to,
    )
    email_count = 0
    if send_external_emails:
        for user in users:
            email = str(user.get("email", "")).strip().lower()
            if not email:
                continue
            try:
                send_content_notification_email(
                    to_email=email,
                    subject=email_subject,
                    headline=email_headline,
                    intro=email_intro,
                    item_title=item_title,
                    link_to=build_portal_link(link_to) if link_to else None,
                )
                email_count += 1
            except Exception:
                app.logger.exception("Failed sending content notification email", extra={"email": email})
    return {
        "notifications": notification_count,
        "emails": email_count,
    }


def serialize_video_progress(item: dict) -> dict:
    return {
        "videoId": int(item.get("videoId", 0) or 0),
        "progressPercent": int(item.get("progressPercent", 0) or 0),
        "isComplete": bool(item.get("isComplete", False)),
        "lastWatched": int(item.get("lastWatched", 0) or 0),
    }


def serialize_document_open_state(item: dict | None) -> dict:
    opened_at = int(item.get("openedAt", 0) or 0) if item else 0
    return {
        "isOpened": opened_at > 0,
        "openedAt": opened_at or None,
    }


def get_video_watched_user_ids(video_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_video_progress_store()
        if int(item.get("videoId", 0) or 0) == video_id and int(item.get("progressPercent", 0) or 0) > 0
    }


def get_video_completed_user_ids(video_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_video_progress_store()
        if int(item.get("videoId", 0) or 0) == video_id and bool(item.get("isComplete", False))
    }


def get_document_opened_user_ids(document_id: int) -> set[str]:
    return {
        item["userId"]
        for item in load_training_document_opens_store()
        if int(item.get("documentId", 0) or 0) == document_id and int(item.get("openedAt", 0) or 0) > 0
    }


def refresh_training_video_counts(items: list[dict]) -> list[dict]:
    watched_by_video: dict[int, set[str]] = {}
    for entry in load_training_video_progress_store():
        if int(entry.get("progressPercent", 0) or 0) <= 0:
            continue
        video_id = int(entry.get("videoId", 0) or 0)
        watched_by_video.setdefault(video_id, set()).add(entry["userId"])
    changed = False
    for item in items:
        video_id = int(item.get("id", 0) or 0)
        count = len(watched_by_video.get(video_id, set()))
        if int(item.get("viewCount", 0) or 0) != count:
            item["viewCount"] = count
            changed = True
    if changed:
        save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    return items


def refresh_training_document_counts(items: list[dict]) -> list[dict]:
    opened_by_document: dict[int, set[str]] = {}
    for entry in load_training_document_opens_store():
        if int(entry.get("openedAt", 0) or 0) <= 0:
            continue
        document_id = int(entry.get("documentId", 0) or 0)
        opened_by_document.setdefault(document_id, set()).add(entry["userId"])
    changed = False
    for item in items:
        document_id = int(item.get("id", 0) or 0)
        count = len(opened_by_document.get(document_id, set()))
        if int(item.get("downloadCount", 0) or 0) != count:
            item["downloadCount"] = count
            changed = True
    if changed:
        save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    return items


def get_training_video_by_id(item_id: int) -> dict | None:
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)


def get_training_document_by_id(item_id: int) -> dict | None:
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)


def reminder_link_for_kind(kind: str, item_id: int) -> str:
    if kind == "video":
        return f"/training/video/{item_id}"
    return f"/training/document/{item_id}"


def find_video_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if str(item.get("storageType", "")).strip() == "Local"
            and str(item.get("localFilename", "")).strip() == filename
        ),
        None,
    )


def find_document_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if str(item.get("storageType", "")).strip() == "Local"
            and str(item.get("localFilename", "")).strip() == filename
        ),
        None,
    )


def is_local_upload_ref(value: object, filename: str) -> bool:
    return str(value or "").strip() == f"LOCAL:{filename}"


def find_announcement_by_local_filename(filename: str) -> dict | None:
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    return next(
        (
            item
            for item in items
            if is_local_upload_ref(item.get("imageUrl"), filename)
            or is_local_upload_ref(item.get("fileUrl"), filename)
        ),
        None,
    )


def find_user_by_local_image(filename: str) -> dict | None:
    users = load_user_store()
    return next(
        (
            user
            for user in users
            if is_local_upload_ref(user.get("imageFile"), filename)
        ),
        None,
    )


def local_filename_from_ref(value: object) -> str:
    raw = str(value or "").strip()
    if not raw.startswith("LOCAL:"):
        return ""
    return raw.replace("LOCAL:", "", 1).strip()


def cleanup_local_announcement_assets(item: dict) -> None:
    for key in ("imageUrl", "fileUrl"):
        filename = local_filename_from_ref(item.get(key))
        if filename:
            remove_uploaded_file_if_unused(filename)


def remove_uploaded_file_if_unused(filename: str) -> None:
    if not filename:
        return
    video_match = find_video_by_local_filename(filename)
    document_match = find_document_by_local_filename(filename)
    announcement_match = find_announcement_by_local_filename(filename)
    profile_match = find_user_by_local_image(filename)
    if video_match or document_match or announcement_match or profile_match:
        return
    file_path = os.path.join(UPLOADS_DIR, filename)
    if os.path.isfile(file_path):
        os.remove(file_path)


def send_training_reminders(kind: str, item_id: int) -> dict[str, int]:
    kind_key = "video" if kind == "video" else "document"
    item = get_training_video_by_id(item_id) if kind_key == "video" else get_training_document_by_id(item_id)
    if not item or item.get("isArchived"):
        raise ValueError("Training item not found")
    eligible = eligible_users_for_item(item)
    completed_or_opened = (
        get_video_completed_user_ids(item_id)
        if kind_key == "video"
        else get_document_opened_user_ids(item_id)
    )
    target_users = [user for user in eligible if user["id"] not in completed_or_opened]
    if not target_users:
        return {"notifications": 0, "emails": 0}

    reminders = load_training_reminders_store()
    cutoff = now_seconds() - TRAINING_REMINDER_COOLDOWN_SECONDS
    reminders = [entry for entry in reminders if int(entry.get("sentAt", 0) or 0) >= cutoff]
    recent_pairs = {
        (entry["kind"], int(entry["itemId"]), entry["userId"])
        for entry in reminders
    }
    pending_users = [
        user
        for user in target_users
        if (kind_key, item_id, user["id"]) not in recent_pairs
    ]
    if not pending_users:
        save_training_reminders_store(reminders)
        return {"notifications": 0, "emails": 0}

    title = "Mandatory Training Reminder"
    item_name = str(item.get("title", "")).strip()
    message = (
        f'Please complete "{item_name}" in the training portal.'
        if kind_key == "video"
        else f'Please open and review "{item_name}" in the training portal.'
    )
    link_to = reminder_link_for_kind(kind_key, item_id)
    notification_count = create_notifications_for_users(
        pending_users,
        kind="training",
        title=title,
        message=message,
        link_to=link_to,
    )
    email_count = 0
    for user in pending_users:
        email = str(user.get("email", "")).strip().lower()
        if not email:
            continue
        try:
            send_content_notification_email(
                to_email=email,
                subject="Bawjiase SUSU Collection Portal - Mandatory Training Reminder",
                headline=title,
                intro=message,
                item_title=item_name,
                link_to=build_portal_link(link_to),
            )
            email_count += 1
        except Exception:
            app.logger.exception("Failed sending training reminder email", extra={"email": email})
        reminders.append(
            {
                "kind": kind_key,
                "itemId": item_id,
                "userId": user["id"],
                "sentAt": now_seconds(),
            }
        )
    save_training_reminders_store(reminders)
    return {"notifications": notification_count, "emails": email_count}


def handle_options():
    if request.method == "OPTIONS":
        return ("", 204)
    return None


def upload_public_url(filename: str) -> str:
    return f"/uploads/{filename}"


def save_uploaded_media(file_storage, kind: str) -> dict:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("A file is required")
    original_name = secure_filename(str(file_storage.filename))
    if not original_name:
        raise ValueError("Invalid file name")
    ext = os.path.splitext(original_name)[1].lower()
    if kind == "video":
        allowed = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    elif kind == "profile":
        allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    elif kind == "announcement":
        allowed = {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif",
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".ppt",
            ".pptx",
        }
    else:
        allowed = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
    if ext not in allowed:
        raise ValueError("Unsupported file type")
    filename = f"{kind}-{secrets.token_hex(8)}{ext}"
    target_path = os.path.join(UPLOADS_DIR, filename)
    file_storage.save(target_path)
    return {
        "filename": filename,
        "url": upload_public_url(filename),
        "contentType": str(getattr(file_storage, "mimetype", "") or "application/octet-stream"),
    }


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/uploads/<path:filename>", methods=["GET"])
def get_uploaded_media(filename: str):
    safe_name = secure_filename(filename)
    if not safe_name or safe_name != filename:
        return jsonify({"error": "Invalid file name"}), 400
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    training_item = find_video_by_local_filename(safe_name) or find_document_by_local_filename(safe_name)
    if training_item:
        if not user_can_access_item(auth_user, training_item):
            return jsonify({"error": "Access denied"}), 403
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    if find_announcement_by_local_filename(safe_name):
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    if find_user_by_local_image(safe_name):
        return send_from_directory(UPLOADS_DIR, safe_name, conditional=True)
    return jsonify({"error": "File not found"}), 404


@app.route("/mail-api/uploads/<path:filename>", methods=["GET"])
def get_uploaded_media_legacy(filename: str):
    return get_uploaded_media(filename)


@app.route("/mail-api/api/<path:path>", methods=["GET", "POST", "OPTIONS"])
def legacy_mail_api(path: str):
    destination = f"/api/{path}"
    query = request.query_string.decode("utf-8", errors="ignore").strip()
    if query:
        destination = f"{destination}?{query}"
    return redirect(destination, code=307)


@app.route("/api/presence", methods=["GET"])
def get_presence():
    _, _, error = require_authenticated_user()
    if error:
        return error
    store = prune_presence(load_presence_store())
    save_presence_store(store)
    return jsonify({"presence": store})


@app.route("/api/presence/ping", methods=["POST", "OPTIONS"])
def ping_presence():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    user_id = str(data.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId is required"}), 400
    if auth_user["id"] != user_id:
        return jsonify({"error": "Cannot update another user's presence"}), 403
    current_ms = now_ms()
    set_user_last_seen(user_id, current_ms)
    store = prune_presence(load_presence_store())
    store[user_id] = int(time.time())
    save_presence_store(store)
    return jsonify({"ok": True, "lastSeen": current_ms})


@app.route("/api/presence/logout", methods=["POST", "OPTIONS"])
def logout_presence():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    user_id = str(data.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId is required"}), 400
    if auth_user["id"] != user_id:
        return jsonify({"error": "Cannot update another user's presence"}), 403
    set_user_last_seen(user_id, now_ms())
    store = prune_presence(load_presence_store())
    store.pop(user_id, None)
    save_presence_store(store)
    return jsonify({"ok": True})


@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    user_items = [
        item
        for item in items
        if str(item.get("userId", "")).strip() == auth_user["id"]
    ]
    user_items.sort(key=lambda item: int(item.get("createdAt", 0) or 0), reverse=True)
    return jsonify({"notifications": user_items})


@app.route("/api/notifications/unread-count", methods=["GET"])
def get_unread_notification_count():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    count = sum(
        1
        for item in items
        if str(item.get("userId", "")).strip() == auth_user["id"]
        and not bool(item.get("isRead", False))
    )
    return jsonify({"count": count})


@app.route("/api/notifications/<int:item_id>/read", methods=["POST", "OPTIONS"])
def mark_notification_read(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    notification = next(
        (
            item
            for item in items
            if int(item.get("id", 0) or 0) == item_id
            and str(item.get("userId", "")).strip() == auth_user["id"]
        ),
        None,
    )
    if not notification:
        return jsonify({"error": "Notification not found"}), 404
    notification["isRead"] = True
    save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return jsonify({"ok": True})


@app.route("/api/notifications/read-all", methods=["POST", "OPTIONS"])
def mark_all_notifications_read():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    changed = False
    for item in items:
        if str(item.get("userId", "")).strip() == auth_user["id"] and not bool(item.get("isRead", False)):
            item["isRead"] = True
            changed = True
    if changed:
        save_json_list_store(NOTIFICATIONS_STORE_PATH, items)
    return jsonify({"ok": True})


@app.route("/api/notifications/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_notification(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = load_json_list_store(NOTIFICATIONS_STORE_PATH)
    filtered = [
        item
        for item in items
        if not (
            int(item.get("id", 0) or 0) == item_id
            and str(item.get("userId", "")).strip() == auth_user["id"]
        )
    ]
    if len(filtered) == len(items):
        return jsonify({"error": "Notification not found"}), 404
    save_json_list_store(NOTIFICATIONS_STORE_PATH, filtered)
    record_audit_log(
        auth_user,
        "DELETE_NOTIFICATION",
        {"notificationId": item_id},
    )
    return jsonify({"ok": True})


@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    _, _, error = require_owner_admin()
    if error:
        return error
    logs = sorted(load_audit_logs_store(), key=lambda item: int(item["timestamp"]), reverse=True)
    return jsonify({"logs": logs})


@app.route("/api/audit-logs", methods=["POST", "OPTIONS"])
def create_audit_log():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    action = str(data.get("action", "")).strip().upper()
    target = str(data.get("target", "")).strip()
    if not action or not target:
        return jsonify({"error": "Action and target are required"}), 400
    entry = record_audit_log(
        auth_user,
        action,
        target,
        str(data.get("ipAddress", "") or request_ip_address()),
    )
    return jsonify({"ok": True, "log": entry})


@app.route("/api/audit-logs/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_audit_log(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_owner_admin()
    if error:
        return error
    logs = load_audit_logs_store()
    filtered = [item for item in logs if int(item.get("id", 0) or 0) != item_id]
    if len(filtered) == len(logs):
        return jsonify({"error": "Log entry not found"}), 404
    save_audit_logs_store(filtered)
    return jsonify({"ok": True})


@app.route("/api/audit-logs/delete", methods=["POST", "OPTIONS"])
def delete_audit_logs():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_owner_admin()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    ids = {
        int(item)
        for item in data.get("ids", [])
        if isinstance(item, (int, float, str)) and str(item).strip().isdigit()
    }
    if not ids:
        return jsonify({"ok": True})
    logs = load_audit_logs_store()
    save_audit_logs_store(
        [item for item in logs if int(item.get("id", 0) or 0) not in ids]
    )
    return jsonify({"ok": True})


@app.route("/api/portal-settings", methods=["GET"])
def get_portal_settings():
    return jsonify({"settings": load_portal_settings_store()})


@app.route("/api/portal-settings", methods=["POST", "OPTIONS"])
def update_portal_settings():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    password = str(data.get("password", "") or "")
    if password.upper() != str(load_portal_settings_store()["portalControlPassword"]).upper():
        return jsonify({"error": "Portal control password is incorrect"}), 403
    branches = normalize_portal_branches(data.get("branches"))
    settings = {
        "bankName": str(data.get("bankName") or DEFAULT_PORTAL_SETTINGS["bankName"]).strip(),
        "shortBankName": str(data.get("shortBankName") or DEFAULT_PORTAL_SETTINGS["shortBankName"]).strip(),
        "portalName": str(data.get("portalName") or DEFAULT_PORTAL_SETTINGS["portalName"]).strip(),
        "emailDomain": normalize_email_domain(data.get("emailDomain")),
        "branches": branches,
        "departments": DEFAULT_PORTAL_DEPARTMENTS,
        "formCategories": [],
        "trainingCategories": [],
        "supportIssueCategories": [],
        "supportRequestTypes": [],
        "departmentChangeTypes": [],
        "transferLocations": [],
        "loginSubtitle": str(data.get("loginSubtitle") or DEFAULT_PORTAL_SETTINGS["loginSubtitle"]),
        "loginButtonText": str(data.get("loginButtonText") or DEFAULT_PORTAL_SETTINGS["loginButtonText"]),
        "authorizedAccessText": str(data.get("authorizedAccessText") or DEFAULT_PORTAL_SETTINGS["authorizedAccessText"]),
        "portalControlPassword": str(data.get("portalControlPassword") or DEFAULT_PORTAL_SETTINGS["portalControlPassword"]),
        "itAccessCode": str(data.get("itAccessCode") or ""),
        "hrAccessCode": str(data.get("hrAccessCode") or ""),
        "sessionDays": normalize_positive_number(data.get("sessionDays"), DEFAULT_PORTAL_SETTINGS["sessionDays"]),
        "verificationMinutes": normalize_positive_number(data.get("verificationMinutes"), DEFAULT_PORTAL_SETTINGS["verificationMinutes"]),
        "passwordResetMinutes": normalize_positive_number(data.get("passwordResetMinutes"), DEFAULT_PORTAL_SETTINGS["passwordResetMinutes"]),
        "videoUploadLimitMb": normalize_positive_number(data.get("videoUploadLimitMb"), DEFAULT_PORTAL_SETTINGS["videoUploadLimitMb"]),
        "documentUploadLimitMb": normalize_positive_number(data.get("documentUploadLimitMb"), DEFAULT_PORTAL_SETTINGS["documentUploadLimitMb"]),
        "dashboardLabel": str(data.get("dashboardLabel") or DEFAULT_PORTAL_SETTINGS["dashboardLabel"]),
        "trainingLabel": str(data.get("trainingLabel") or DEFAULT_PORTAL_SETTINGS["trainingLabel"]),
        "formsLabel": str(data.get("formsLabel") or DEFAULT_PORTAL_SETTINGS["formsLabel"]),
        "supportLabel": str(data.get("supportLabel") or DEFAULT_PORTAL_SETTINGS["supportLabel"]),
        "appMode": "live" if str(data.get("appMode", "test")).strip().lower() == "live" else "test",
        "profileLabel": str(data.get("profileLabel") or DEFAULT_PORTAL_SETTINGS["profileLabel"]),
        "activeStaffLabel": str(data.get("activeStaffLabel") or DEFAULT_PORTAL_SETTINGS["activeStaffLabel"]),
        "branchCoverageLabel": str(data.get("branchCoverageLabel") or DEFAULT_PORTAL_SETTINGS["branchCoverageLabel"]),
        "openOperationsLabel": str(data.get("openOperationsLabel") or DEFAULT_PORTAL_SETTINGS["openOperationsLabel"]),
        "resolutionRateLabel": str(data.get("resolutionRateLabel") or DEFAULT_PORTAL_SETTINGS["resolutionRateLabel"]),
        "updatedAt": now_ms(),
        "updatedBy": {
            "id": auth_user["id"],
            "fullname": auth_user["fullname"],
            "email": auth_user["email"],
        },
    }
    save_portal_settings_store(settings)
    record_audit_log(
        auth_user,
        "UPDATE_PORTAL_SETTINGS",
        {
            "branches": branches,
            "departments": settings["departments"],
            "emailDomain": settings["emailDomain"],
            "appMode": settings["appMode"],
            "updatedAt": settings["updatedAt"],
        },
    )
    notify_active_managers(
        kind="portal_control",
        title="Portal settings updated",
        message=f"{auth_user['fullname']} updated portal branches, SUSU categories, labels, or access settings.",
        link_to="/portal-control",
    )
    return jsonify({"ok": True, "settings": settings})


@app.route("/api/backup/export", methods=["GET"])
def export_production_backup():
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    backup = {
        "metadata": {
            "app": "bawjiase-staff-portal",
            "generatedAt": now_ms(),
            "generatedBy": {
                "id": auth_user["id"],
                "fullname": auth_user["fullname"],
                "email": auth_user["email"],
                "role": auth_user["role"],
            },
            "dataDir": DATA_DIR,
            "schemaVersion": 1,
        },
        "stores": {
            "users": load_user_store(),
            "sessions": load_sessions(),
            "presence": load_presence_store(),
            "announcements": load_json_list_store(ANNOUNCEMENTS_STORE_PATH),
            "forms": load_json_list_store(FORMS_STORE_PATH),
            "trainingVideos": load_json_list_store(TRAINING_VIDEOS_STORE_PATH),
            "trainingDocuments": load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH),
            "notifications": load_json_list_store(NOTIFICATIONS_STORE_PATH),
            "trainingVideoProgress": load_training_video_progress_store(),
            "trainingDocumentOpens": load_training_document_opens_store(),
            "trainingReminders": load_training_reminders_store(),
            "auditLogs": load_audit_logs_store(),
            "portalSettings": load_portal_settings_store(),
            "customers": load_json_list_store(CUSTOMERS_STORE_PATH),
            "collections": load_json_list_store(COLLECTIONS_STORE_PATH),
            "dailyCloses": load_json_list_store(DAILY_CLOSES_STORE_PATH),
        },
    }
    response = jsonify(backup)
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    response.headers["Content-Disposition"] = (
        f'attachment; filename="bawjiase-portal-backup-{stamp}.json"'
    )
    response.headers["X-Backup-Filename"] = f"bawjiase-portal-backup-{stamp}.json"
    record_audit_log(
        auth_user,
        "EXPORT_PRODUCTION_BACKUP",
        {
            "stores": list(backup["stores"].keys()),
            "generatedAt": backup["metadata"]["generatedAt"],
        },
    )
    return response


@app.route("/api/backup/import", methods=["POST", "OPTIONS"])
def import_production_backup():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    password = str(data.get("password", "") or "")
    if password.upper() != str(load_portal_settings_store()["portalControlPassword"]).upper():
        return jsonify({"error": "Portal control password is incorrect"}), 403
    stores = data.get("stores") if isinstance(data.get("stores"), dict) else None
    if not stores:
        return jsonify({"error": "Backup file is missing stores data."}), 400

    current_backup = {
        "users": load_user_store(),
        "sessions": load_sessions(),
        "presence": load_presence_store(),
        "notifications": load_json_list_store(NOTIFICATIONS_STORE_PATH),
        "auditLogs": load_audit_logs_store(),
        "portalSettings": load_portal_settings_store(),
        "customers": load_json_list_store(CUSTOMERS_STORE_PATH),
        "collections": load_json_list_store(COLLECTIONS_STORE_PATH),
        "dailyCloses": load_json_list_store(DAILY_CLOSES_STORE_PATH),
    }

    try:
        if "users" in stores:
            save_user_store([normalize_user(item) for item in stores.get("users", []) if isinstance(item, dict)])
        if "sessions" in stores and isinstance(stores.get("sessions"), dict):
            save_sessions(stores.get("sessions") or {})
        if "presence" in stores and isinstance(stores.get("presence"), dict):
            save_presence_store(stores.get("presence") or {})
        if "notifications" in stores:
            save_json_list_store(NOTIFICATIONS_STORE_PATH, stores.get("notifications") or [])
        if "auditLogs" in stores:
            save_audit_logs_store(stores.get("auditLogs") or [])
        if "portalSettings" in stores and isinstance(stores.get("portalSettings"), dict):
            imported_settings = {**DEFAULT_PORTAL_SETTINGS, **stores.get("portalSettings")}
            imported_settings["departments"] = DEFAULT_PORTAL_DEPARTMENTS
            save_portal_settings_store(imported_settings)
        if "customers" in stores:
            save_json_list_store(CUSTOMERS_STORE_PATH, stores.get("customers") or [])
        if "collections" in stores:
            save_json_list_store(COLLECTIONS_STORE_PATH, stores.get("collections") or [])
        if "dailyCloses" in stores:
            save_json_list_store(DAILY_CLOSES_STORE_PATH, stores.get("dailyCloses") or [])
    except Exception as exc:
        save_user_store(current_backup["users"])
        save_sessions(current_backup["sessions"])
        save_presence_store(current_backup["presence"])
        save_json_list_store(NOTIFICATIONS_STORE_PATH, current_backup["notifications"])
        save_audit_logs_store(current_backup["auditLogs"])
        save_portal_settings_store(current_backup["portalSettings"])
        save_json_list_store(CUSTOMERS_STORE_PATH, current_backup["customers"])
        save_json_list_store(COLLECTIONS_STORE_PATH, current_backup["collections"])
        save_json_list_store(DAILY_CLOSES_STORE_PATH, current_backup["dailyCloses"])
        return jsonify({"error": f"Backup import failed and current data was restored: {exc}"}), 400

    record_audit_log(auth_user, "IMPORT_BACKUP", {"stores": list(stores.keys())})
    return jsonify({"ok": True, "settings": load_portal_settings_store()})


@app.route("/api/maintenance/clear-test-data", methods=["POST", "OPTIONS"])
def clear_test_data():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    if not data.get("backupConfirmed"):
        return jsonify({"error": "Export a backup before clearing test data."}), 400
    settings = load_portal_settings_store()
    if str(settings.get("appMode", "test")).lower() != "test":
        return jsonify({"error": "Switch the portal to Test Mode before clearing test data."}), 400
    save_json_list_store(CUSTOMERS_STORE_PATH, [])
    save_json_list_store(COLLECTIONS_STORE_PATH, [])
    save_json_list_store(NOTIFICATIONS_STORE_PATH, [])
    save_json_list_store(DAILY_CLOSES_STORE_PATH, [])
    save_audit_logs_store([])
    record_audit_log(auth_user, "CLEAR_TEST_DATA", {"cleared": ["customers", "collections", "notifications", "dailyCloses", "auditLogs"]})
    return jsonify({"ok": True})


@app.route("/api/daily-close", methods=["GET"])
def get_daily_close():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    date_key = str(request.args.get("date") or time.strftime("%Y-%m-%d")).strip()
    agent_id = str(request.args.get("agentId") or auth_user["id"]).strip()
    closes = load_json_list_store(DAILY_CLOSES_STORE_PATH)
    item = next((entry for entry in closes if str(entry.get("agentId")) == agent_id and str(entry.get("date")) == date_key), None)
    return jsonify({"closed": bool(item), "close": item})


@app.route("/api/daily-close", methods=["POST", "OPTIONS"])
def close_daily_collections():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not is_susu_agent(auth_user):
        return jsonify({"error": "Only SUSU AGENT users can close a collection day."}), 403
    data, error = require_json()
    if error:
        return error
    date_key = str(data.get("date") or time.strftime("%Y-%m-%d")).strip()
    collections = [
        item for item in load_json_list_store(COLLECTIONS_STORE_PATH)
        if str(item.get("agent_id")) == auth_user["id"] and str(item.get("transaction_date")) == date_key and str(item.get("status")) != "reversed"
    ]
    closes = load_json_list_store(DAILY_CLOSES_STORE_PATH)
    existing = next((entry for entry in closes if str(entry.get("agentId")) == auth_user["id"] and str(entry.get("date")) == date_key), None)
    if existing:
        return jsonify({"ok": True, "close": existing})
    close = {
        "id": f"close-{now_ms()}-{secrets.token_hex(3)}",
        "date": date_key,
        "agentId": auth_user["id"],
        "agentName": auth_user["fullname"],
        "branch": auth_user.get("branch", ""),
        "transactionCount": len(collections),
        "totalAmount": sum(float(item.get("amount") or 0) for item in collections),
        "closedAt": now_ms(),
    }
    closes.append(close)
    save_json_list_store(DAILY_CLOSES_STORE_PATH, closes)
    record_audit_log(auth_user, "CLOSE_DAILY_COLLECTIONS", close)
    notify_active_managers(
        kind="daily_close",
        title="Daily collections closed",
        message=f"{auth_user['fullname']} closed {date_key} with GHS {close['totalAmount']:,.2f}.",
        link_to="/reports",
    )
    return jsonify({"ok": True, "close": close})


@app.route("/api/customers", methods=["GET"])
def get_customers():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    customers = load_json_list_store(CUSTOMERS_STORE_PATH)
    customers = [item for item in customers if can_view_operational_record(auth_user, item)]
    customers.sort(key=lambda item: int(item.get("createdAt", 0) or 0), reverse=True)
    return jsonify({"customers": customers})


@app.route("/api/customers", methods=["POST", "OPTIONS"])
def create_customer():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can add customers."}), 403
    customers = load_json_list_store(CUSTOMERS_STORE_PATH)
    try:
        account_name = normalize_required_text(data.get("account_name"), "Account name")
        account_number = normalize_account_number(data.get("account_number"))
        phone = normalize_phone(data.get("phone"))
        requested_branch = normalize_portal_branch_name(
            data.get("branch_name") or data.get("branch") or auth_user.get("branch")
        )
        customer_status = normalize_customer_status(data.get("customer_status"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if any(str(item.get("account_number", "")).strip() == account_number for item in customers):
        return jsonify({"error": "Customer account number already exists"}), 400
    try:
        branch_name = managed_branch_for_user(auth_user, requested_branch)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 403
    customer = {
        "id": f"cust-{now_ms()}-{secrets.token_hex(3)}",
        "account_name": account_name,
        "account_number": account_number,
        "phone": phone,
        "branch_id": branch_name,
        "branch_name": branch_name,
        "customer_status": customer_status,
        "address": str(data.get("address") or "").strip(),
        "total_deposits": 0,
        "last_deposit_date": None,
        "createdAt": now_ms(),
        "createdBy": auth_user["fullname"],
        "createdById": auth_user["id"],
        "createdByEmail": auth_user["email"],
    }
    customers.append(customer)
    save_json_list_store(CUSTOMERS_STORE_PATH, customers)
    record_audit_log(auth_user, "CREATE_CUSTOMER", {"customerId": customer["id"], "accountName": customer["account_name"]})
    notify_active_managers(
        kind="customer",
        title="New customer added",
        message=f"{auth_user['fullname']} added {customer['account_name']} at {customer['branch_name']}.",
        link_to="/customers",
    )
    return jsonify({"ok": True, "customer": customer})


@app.route("/api/customers/<customer_id>", methods=["POST", "OPTIONS"])
def update_customer(customer_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    customers = load_json_list_store(CUSTOMERS_STORE_PATH)
    customer = next((item for item in customers if str(item.get("id")) == customer_id), None)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    if not can_view_operational_record(auth_user, customer):
        return jsonify({"error": "Access denied"}), 403
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can edit customers."}), 403
    before = dict(customer)
    try:
        if "account_name" in data:
            customer["account_name"] = normalize_required_text(data.get("account_name"), "Account name")
        if "account_number" in data:
            account_number = normalize_account_number(data.get("account_number"))
            duplicate = next(
                (
                    item
                    for item in customers
                    if str(item.get("id")) != customer_id
                    and str(item.get("account_number", "")).strip() == account_number
                ),
                None,
            )
            if duplicate:
                return jsonify({"error": "Another customer already uses this account number"}), 400
            customer["account_number"] = account_number
        if "phone" in data:
            customer["phone"] = normalize_phone(data.get("phone"))
        if "customer_status" in data:
            customer["customer_status"] = normalize_customer_status(data.get("customer_status"))
        if "branch_name" in data or "branch" in data:
            customer["branch_name"] = normalize_portal_branch_name(data.get("branch_name") or data.get("branch"))
        if "address" in data:
            customer["address"] = str(data.get("address") or "").strip()
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    customer["branch_id"] = customer.get("branch_name", "")
    if is_assigned_supervisor(auth_user) and not branch_allowed_for_user(auth_user, customer["branch_name"]):
        return jsonify({"error": "You can only manage customers in your assigned branch."}), 403
    customer["updatedAt"] = now_ms()
    save_json_list_store(CUSTOMERS_STORE_PATH, customers)
    if before.get("customer_status") != customer.get("customer_status"):
        record_audit_log(
            auth_user,
            "CUSTOMER_STATUS_CHANGE",
            {
                "customerId": customer["id"],
                "accountNumber": customer.get("account_number"),
                "before": before.get("customer_status"),
                "after": customer.get("customer_status"),
            },
        )
    record_audit_log(
        auth_user,
        "UPDATE_CUSTOMER",
        {
            "customerId": customer["id"],
            "accountNumber": customer.get("account_number"),
            "before": before,
            "after": customer,
        },
    )
    notify_active_managers(
        kind="customer",
        title="Customer updated",
        message=f"{auth_user['fullname']} updated {customer.get('account_name')}.",
        link_to="/customers",
    )
    return jsonify({"ok": True, "customer": customer})


@app.route("/api/customers/import", methods=["POST", "OPTIONS"])
def import_customers():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can import customers."}), 403
    data, error = require_json()
    if error:
        return error
    rows = data.get("customers")
    if not isinstance(rows, list) or not rows:
        return jsonify({"error": "Upload must contain at least one customer row."}), 400
    try:
        import_branch = managed_branch_for_user(auth_user, data.get("branch"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 403
    customers = load_json_list_store(CUSTOMERS_STORE_PATH)
    existing_numbers = {str(item.get("account_number", "")).strip() for item in customers}
    created = []
    skipped = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            skipped.append({"row": index, "reason": "Invalid row"})
            continue
        try:
            account_name = normalize_required_text(
                row.get("account_name") or row.get("Account Name") or row.get("name"),
                "Account name",
            )
            account_number = normalize_account_number(
                row.get("account_number") or row.get("Account Number") or row.get("account"),
            )
            branch_name = managed_branch_for_user(
                auth_user,
                row.get("branch") or row.get("Branch") or import_branch,
            )
        except ValueError as exc:
            skipped.append({"row": index, "reason": str(exc)})
            continue
        if account_number in existing_numbers:
            skipped.append({"row": index, "reason": "Duplicate account number"})
            continue
        customer = {
            "id": f"cust-{now_ms()}-{secrets.token_hex(3)}",
            "account_name": account_name,
            "account_number": account_number,
            "phone": "",
            "branch_id": branch_name,
            "branch_name": branch_name,
            "customer_status": "active",
            "address": "",
            "total_deposits": 0,
            "last_deposit_date": None,
            "createdAt": now_ms(),
            "createdBy": auth_user["fullname"],
            "createdById": auth_user["id"],
            "createdByEmail": auth_user["email"],
            "importedBy": auth_user["fullname"],
        }
        customers.append(customer)
        existing_numbers.add(account_number)
        created.append(customer)
    if created:
        save_json_list_store(CUSTOMERS_STORE_PATH, customers)
        record_audit_log(
            auth_user,
            "IMPORT_CUSTOMERS",
            {"branch": import_branch, "created": len(created), "skipped": len(skipped)},
        )
    return jsonify({"ok": True, "created": created, "createdCount": len(created), "skipped": skipped})


@app.route("/api/collections", methods=["GET"])
def get_collections():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    collections = load_json_list_store(COLLECTIONS_STORE_PATH)
    collections = [item for item in collections if can_view_operational_record(auth_user, item)]
    collections.sort(key=lambda item: int(item.get("created_date", 0) or 0), reverse=True)
    return jsonify({"collections": collections})


@app.route("/api/collections", methods=["POST", "OPTIONS"])
def create_collection():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not is_susu_agent(auth_user):
        return jsonify({"error": "Only SUSU AGENT users can record deposits."}), 403
    data, error = require_json()
    if error:
        return error
    transaction_date = str(data.get("transaction_date") or time.strftime("%Y-%m-%d")).strip()
    closes = load_json_list_store(DAILY_CLOSES_STORE_PATH)
    if any(str(entry.get("agentId")) == auth_user["id"] and str(entry.get("date")) == transaction_date for entry in closes):
        return jsonify({"error": "This collection day is closed. Reopen through owner support before recording more deposits."}), 400
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Amount must be a valid number"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400
    today = time.strftime("%Y-%m-%d")
    current_time = time.strftime("%H:%M")
    collections = load_json_list_store(COLLECTIONS_STORE_PATH)
    customers = load_json_list_store(CUSTOMERS_STORE_PATH)
    customer_id = str(data.get("customer_id") or "").strip()
    customer = next((item for item in customers if item.get("id") == customer_id), None)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    if str(customer.get("customer_status", "active")).lower() != "active":
        return jsonify({"error": "Only active customers can receive deposits."}), 400
    if not can_view_operational_record(auth_user, customer):
        return jsonify({"error": "You can only record deposits for customers assigned to you."}), 403
    branch_name = str((customer or {}).get("branch_name") or auth_user.get("branch") or "").strip().upper()
    transaction_reference = str(data.get("transaction_reference") or f"TXN-{now_ms()}").strip()
    if any(str(item.get("transaction_reference", "")).strip() == transaction_reference for item in collections):
        return jsonify({"error": "This transaction reference has already been recorded"}), 400
    collection = {
        "id": f"col-{now_ms()}-{secrets.token_hex(3)}",
        "customer_id": customer_id,
        "account_name": str(data.get("account_name") or (customer or {}).get("account_name") or "").strip(),
        "account_number": str(data.get("account_number") or (customer or {}).get("account_number") or "").strip(),
        "amount": amount,
        "agent_name": str(data.get("agent_name") or auth_user["fullname"]),
        "agent_id": auth_user["id"],
        "agent_email": auth_user["email"],
        "branch_id": branch_name,
        "branch_name": branch_name,
        "transaction_date": transaction_date or today,
        "transaction_time": str(data.get("transaction_time") or current_time),
        "transaction_reference": transaction_reference,
        "status": str(data.get("status") or "completed"),
        "supervisor_review_status": str(data.get("supervisor_review_status") or "pending"),
        "notes": str(data.get("notes") or "").strip(),
        "recorded_by": auth_user["fullname"],
        "recordedById": auth_user["id"],
        "recordedByEmail": auth_user["email"],
        "created_date": now_ms(),
    }
    collections.append(collection)
    save_json_list_store(COLLECTIONS_STORE_PATH, collections)
    if customer:
        customer["total_deposits"] = float(customer.get("total_deposits") or 0) + amount
        customer["last_deposit_date"] = collection["transaction_date"]
        save_json_list_store(CUSTOMERS_STORE_PATH, customers)
    record_audit_log(auth_user, "CREATE_COLLECTION", {"collectionId": collection["id"], "amount": amount, "customer": collection["account_name"]})
    notify_active_managers(
        kind="collection",
        title="New deposit recorded",
        message=f"{auth_user['fullname']} recorded GHS {amount:,.2f} for {collection['account_name']}.",
        link_to="/transactions",
    )
    return jsonify({"ok": True, "collection": collection})


@app.route("/api/collections/<collection_id>/review", methods=["POST", "OPTIONS"])
def review_collection(collection_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if auth_user.get("role") not in {"OwnerAdmin", "Supervisor"}:
        return jsonify({"error": "Only supervisors or owner admin can review transactions."}), 403
    data, error = require_json()
    if error:
        return error
    status = str(data.get("supervisor_review_status") or "").strip().lower()
    if status not in {"pending", "approved", "queried", "rejected"}:
        return jsonify({"error": "Review status must be pending, approved, queried, or rejected."}), 400
    collections = load_json_list_store(COLLECTIONS_STORE_PATH)
    item = next((entry for entry in collections if str(entry.get("id")) == str(collection_id)), None)
    if not item:
        return jsonify({"error": "Transaction not found"}), 404
    if not can_view_operational_record(auth_user, item):
        return scoped_access_denial(auth_user)
    note = str(data.get("correction_note") or "").strip()
    if status == "queried" and not note:
        return jsonify({"error": "Enter a correction note before querying a transaction."}), 400
    before = {
        "supervisor_review_status": item.get("supervisor_review_status"),
        "correction_note": item.get("correction_note"),
    }
    item["supervisor_review_status"] = status
    item["reviewed_by"] = auth_user["fullname"]
    item["reviewed_by_id"] = auth_user["id"]
    item["reviewed_at"] = now_ms()
    if status in {"queried", "rejected"}:
        item["correction_note"] = note
    elif status == "approved":
        item["correction_note"] = ""
    save_json_list_store(COLLECTIONS_STORE_PATH, collections)
    record_audit_log(
        auth_user,
        "REVIEW_COLLECTION",
        {
            "collectionId": item["id"],
            "accountName": item.get("account_name"),
            "before": before,
            "after": {
                "supervisor_review_status": item.get("supervisor_review_status"),
                "correction_note": item.get("correction_note"),
            },
        },
    )
    if status == "queried" and item.get("agent_id"):
        create_notifications_for_users(
            [str(item.get("agent_id"))],
            kind="correction",
            title="Correction requested",
            message=f"{auth_user['fullname']} requested a correction for {item.get('account_name', 'a transaction')}: {note}",
            link_to="/transactions",
        )
    return jsonify({"ok": True, "collection": item})


@app.route("/api/users", methods=["GET"])
def list_users():
    _, _, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"users": serialize_users_with_presence(load_user_store())})


@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id: str):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if auth_user["id"] != user_id and not is_global_manager(auth_user):
        return jsonify({"error": "Access denied"}), 403
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    presence = prune_presence(load_presence_store())
    save_presence_store(presence)
    return jsonify({"user": serialize_user_with_presence(user, presence)})


@app.route("/api/users/<user_id>/profile", methods=["POST", "OPTIONS"])
def update_profile(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if auth_user["id"] != user_id and not is_global_manager(auth_user):
        return jsonify({"error": "Access denied"}), 403
    data, error = require_json()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    can_manage_org_fields = is_owner_admin(auth_user)
    before_profile = {
        "fullname": user.get("fullname"),
        "phone": user.get("phone"),
        "position": user.get("position"),
        "department": user.get("department"),
        "branch": user.get("branch"),
    }
    previous_image = str(user.get("imageFile") or "").strip()
    try:
        requested_department = normalize_portal_department_name(data.get("department", user["department"]))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if "fullname" in data:
        try:
            user["fullname"] = normalize_required_text(data.get("fullname"), "Full name")
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if "phone" in data:
        try:
            user["phone"] = normalize_phone(data.get("phone")) or user["phone"]
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if "position" in data:
        user["position"] = str(data.get("position", "")).strip() or user["position"]
    if "department" in data and can_manage_org_fields and requested_department:
        user["department"] = requested_department
        if user.get("role") != "Supervisor":
            user["role"] = role_from_department(requested_department)
        user["permissions"] = normalize_user_permissions(user.get("permissions"), user["role"])
        user["managedBranches"] = normalize_scope_list(
            user.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in GLOBAL_MANAGER_ROLES else [],
        )
        if user["role"] != "Supervisor":
            user["managedDepartmentsByBranch"] = {}
    if "branch" in data and can_manage_org_fields:
        try:
            user["branch"] = normalize_portal_branch_name(data.get("branch"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if "imageFile" in data:
        image_file = data.get("imageFile")
        user["imageFile"] = str(image_file) if image_file else None
        if previous_image.startswith("LOCAL:") and previous_image != user["imageFile"]:
            remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    save_user_store(users)
    after_profile = {
        "fullname": user.get("fullname"),
        "phone": user.get("phone"),
        "position": user.get("position"),
        "department": user.get("department"),
        "branch": user.get("branch"),
    }
    if after_profile != before_profile:
        record_audit_log(
            auth_user,
            "UPDATE_PROFILE",
            staff_audit_target(
                user,
                {
                    "changedBySelf": auth_user["id"] == user["id"],
                    "before": before_profile,
                    "after": after_profile,
                },
            ),
        )
    current_image = str(user.get("imageFile") or "").strip()
    if "imageFile" in data and current_image != previous_image:
        if previous_image and current_image:
            action = "CHANGE_PROFILE_PHOTO"
        elif current_image:
            action = "ADD_PROFILE_PHOTO"
        else:
            action = "REMOVE_PROFILE_PHOTO"
        record_audit_log(
            auth_user,
            action,
            staff_audit_target(
                user,
                {"changedBySelf": auth_user["id"] == user["id"]},
            ),
        )
    return jsonify({"ok": True, "user": user})


@app.route("/api/staff/active", methods=["GET"])
def get_active_staff():
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    active_users = [
        user for user in users
        if user["isActive"]
        and not user["isArchived"]
        and user["fullname"] not in {"MASTER ADMIN", "System Admin"}
        and user["role"] != OWNER_ADMIN_ROLE
    ]
    return jsonify({"users": serialize_users_with_presence(active_users)})


@app.route("/api/staff/archived", methods=["GET"])
def get_archived_staff():
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    users = load_user_store()
    return jsonify({"users": [user for user in users if user["isArchived"] and can_view_staff_record(auth_user, user)]})


@app.route("/api/staff/stats", methods=["GET"])
def get_staff_stats():
    _, _, error = require_staff_manager()
    if error:
        return error
    users = load_user_store()
    active = [user for user in users if user["isActive"] and not user["isArchived"]]
    by_department = {}
    by_branch = {}
    by_role = {}
    for user in active:
        by_department[user["department"]] = by_department.get(user["department"], 0) + 1
        by_branch[user["branch"]] = by_branch.get(user["branch"], 0) + 1
        by_role[user["role"]] = by_role.get(user["role"], 0) + 1
    return jsonify({
        "total": len(users),
        "active": len(active),
        "archived": len([user for user in users if user["isArchived"]]),
        "byDepartment": by_department,
        "byBranch": by_branch,
        "byRole": by_role,
    })


@app.route("/api/staff/<user_id>", methods=["GET"])
def get_staff_member(user_id: str):
    _, _, error = require_authenticated_user()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    return jsonify({"user": user})


@app.route("/api/staff/<user_id>/update", methods=["POST", "OPTIONS"])
def update_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    owner_actor = is_owner_admin(auth_user)
    if not owner_actor and not (can_manage_agents_and_customers(auth_user) and is_susu_agent(user)):
        return jsonify({"error": "Only owner admin can edit this staff member."}), 403
    if not can_view_staff_record(auth_user, user):
        return scoped_access_denial(auth_user)
    previous_active = bool(user.get("isActive", False))
    previous_supervisor_access = {
        "role": str(user.get("role", "")),
        "managedBranches": normalize_scope_list(user.get("managedBranches"), empty_default=[]),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            user.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(user.get("permissions"), str(user.get("role", ""))),
    }

    try:
        requested_department = normalize_portal_department_name(data.get("department", user["department"]))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    before_staff = dict(user)
    if "fullname" in data:
        try:
            user["fullname"] = normalize_required_text(data.get("fullname"), "Full name")
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if "phone" in data:
        try:
            user["phone"] = normalize_phone(data.get("phone")) or user["phone"]
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if "position" in data:
        user["position"] = str(data.get("position", "")).strip() or user["position"]
    if "department" in data and requested_department and owner_actor:
        user["department"] = requested_department
        if user.get("role") != "Supervisor":
            user["role"] = role_from_department(requested_department)
    if "branch" in data:
        try:
            user["branch"] = normalize_portal_branch_name(data.get("branch"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if not owner_actor and not branch_allowed_for_user(auth_user, user["branch"]):
            return jsonify({"error": "You can only assign agents inside your branch scope."}), 403
    if "role" in data and owner_actor:
        requested_role = str(data.get("role", "")).strip()
        if requested_role in {"GeneralStaff", "Supervisor"}:
            user["role"] = requested_role
    if "managedBranches" in data and owner_actor:
        user["managedBranches"] = normalize_scope_list(
            data.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in GLOBAL_MANAGER_ROLES else [],
        )
    if "managedDepartmentsByBranch" in data and owner_actor:
        user["managedDepartmentsByBranch"] = normalize_managed_departments_by_branch(
            data.get("managedDepartmentsByBranch")
        )
    if owner_actor and user["role"] != "Supervisor":
        user["managedBranches"] = normalize_scope_list(
            user.get("managedBranches"),
            empty_default=["ALL"] if user["role"] in GLOBAL_MANAGER_ROLES else [],
        )
        user["managedDepartmentsByBranch"] = {}
    if "permissions" in data and owner_actor:
        user["permissions"] = normalize_user_permissions(data.get("permissions"), user["role"])
    else:
        user["permissions"] = normalize_user_permissions(user.get("permissions"), user["role"])
    try:
        validate_supervisor_configuration(user)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if "imageFile" in data:
        previous_image = str(user.get("imageFile") or "").strip()
        image_file = data.get("imageFile")
        user["imageFile"] = str(image_file) if image_file else None
        if previous_image.startswith("LOCAL:") and previous_image != user["imageFile"]:
            remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    if "isActive" in data:
        user["isActive"] = bool(data.get("isActive"))
    save_user_store(users)
    if dict(user) != before_staff:
        record_audit_log(
            auth_user,
            "UPDATE_STAFF",
            staff_audit_target(
                user,
                {
                    "before": {
                        key: before_staff.get(key)
                        for key in ["fullname", "phone", "position", "department", "branch", "role", "isActive"]
                    },
                    "after": {
                        key: user.get(key)
                        for key in ["fullname", "phone", "position", "department", "branch", "role", "isActive"]
                    },
                },
            ),
        )
    if "isActive" in data and bool(user.get("isActive", False)) != previous_active:
        record_audit_log(
            auth_user,
            "ACTIVATE_STAFF" if bool(user.get("isActive", False)) else "DEACTIVATE_STAFF",
            staff_audit_target(
                user,
                {
                    "before": {"isActive": previous_active},
                    "after": {"isActive": bool(user.get("isActive", False))},
                },
            ),
        )
    current_supervisor_access = {
        "role": str(user.get("role", "")),
        "managedBranches": normalize_scope_list(user.get("managedBranches"), empty_default=[]),
        "managedDepartmentsByBranch": normalize_managed_departments_by_branch(
            user.get("managedDepartmentsByBranch")
        ),
        "permissions": normalize_user_permissions(user.get("permissions"), str(user.get("role", ""))),
    }
    if current_supervisor_access != previous_supervisor_access:
        record_audit_log(
            auth_user,
            "SUPERVISOR_ACCESS_UPDATE",
            {
                "staffId": user["id"],
                "staffName": user["fullname"],
                "before": previous_supervisor_access,
                "after": current_supervisor_access,
            },
        )
    return jsonify({"ok": True, "user": user})


@app.route("/api/staff/<user_id>/archive", methods=["POST", "OPTIONS"])
def archive_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    if user_id == auth_user["id"]:
        return jsonify({"error": "You cannot remove your own account"}), 400
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    if not can_view_staff_record(auth_user, user):
        return scoped_access_denial(auth_user)
    if user["role"] in {"OwnerAdmin", "SuperAdmin"}:
        return jsonify({"error": "Cannot archive Owner or Super Admin."}), 400
    user["isArchived"] = True
    user["isActive"] = False
    save_user_store(users)
    revoke_user_sessions(user_id)
    record_audit_log(auth_user, "ARCHIVE_STAFF", staff_audit_target(user))
    notify_active_managers(
        kind="staff",
        title="Staff archived",
        message=f"{auth_user['fullname']} archived {user['fullname']}.",
        link_to="/past-staff",
    )
    return jsonify({"ok": True})


@app.route("/api/staff/<user_id>/restore", methods=["POST", "OPTIONS"])
def restore_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_owner_admin()
    if error:
        return error
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    if not can_view_staff_record(auth_user, user):
        return scoped_access_denial(auth_user)
    user["isArchived"] = False
    user["isActive"] = True
    save_user_store(users)
    record_audit_log(auth_user, "RESTORE_STAFF", staff_audit_target(user))
    notify_active_managers(
        kind="staff",
        title="Staff restored",
        message=f"{auth_user['fullname']} restored {user['fullname']} to the active directory.",
        link_to="/directory",
    )
    return jsonify({"ok": True})


@app.route("/api/staff/<user_id>/delete", methods=["POST", "OPTIONS"])
def delete_staff(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can remove agents."}), 403
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user:
        return jsonify({"error": "Staff member not found"}), 404
    if user_id == auth_user["id"]:
        return jsonify({"error": "You cannot permanently remove your own account"}), 400
    if not can_view_staff_record(auth_user, user):
        return scoped_access_denial(auth_user)
    if user["role"] in {"OwnerAdmin", "SuperAdmin"}:
        return jsonify({"error": "Cannot permanently remove Owner or Super Admin."}), 400
    if not is_global_manager(auth_user) and not is_susu_agent(user):
        return jsonify({"error": "Supervisors can only remove SUSU agents."}), 403
    users = [item for item in users if item["id"] != user_id]
    passwords = load_password_store()
    passwords.pop(user["email"], None)
    username = str(user.get("loginUsername") or "").strip()
    if username:
        passwords.pop(agent_password_key(username), None)
    pending = load_pending_verifications()
    pending.pop(user["email"], None)
    save_user_store(users)
    save_password_store(passwords)
    save_pending_verifications(pending)
    revoke_user_sessions(user_id)
    record_audit_log(auth_user, "DELETE_STAFF", staff_audit_target(user))
    notify_active_managers(
        kind="staff",
        title="Staff removed",
        message=f"{auth_user['fullname']} permanently removed {user['fullname']}.",
        link_to="/directory",
    )
    return jsonify({"ok": True})


@app.route("/api/agents/create", methods=["POST", "OPTIONS"])
def create_agent_account():
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can add agents."}), 403
    data, error = require_json()
    if error:
        return error
    try:
        username = normalize_agent_username(data.get("username"))
        temp_password = str(data.get("temporaryPassword") or "").strip()
        phone = normalize_phone(data.get("phone"))
        branch = managed_branch_for_user(auth_user, data.get("branch"))
        fullname = str(data.get("fullname") or username).strip()
        if len(temp_password) < 6:
            return jsonify({"error": "Temporary password must be at least 6 characters."}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    users = load_user_store()
    if find_user_by_username(users, username):
        return jsonify({"error": "Username already exists."}), 400
    synthetic_email = f"{username}@agents.local"
    if find_user_by_email(users, synthetic_email):
        return jsonify({"error": "Agent already exists."}), 400
    user = normalize_user({
        "id": f"agent-{now_ms()}-{secrets.token_hex(3)}",
        "fullname": fullname,
        "phone": phone,
        "email": synthetic_email,
        "role": "GeneralStaff",
        "position": "SUSU Agent",
        "department": "SUSU AGENT",
        "branch": branch,
        "imageFile": None,
        "isActive": True,
        "isVerified": True,
        "lastSeen": 0,
        "registrationTime": now_ms(),
        "isArchived": False,
        "loginUsername": username,
        "createdBySupervisorId": auth_user["id"],
        "createdBySupervisorName": auth_user["fullname"],
        "forcePasswordChange": True,
        "setupComplete": False,
    })
    users.append(user)
    passwords = load_password_store()
    passwords[agent_password_key(username)] = hash_password_for_storage(temp_password)
    save_user_store(users)
    save_password_store(passwords)
    record_audit_log(auth_user, "CREATE_AGENT_ACCOUNT", staff_audit_target(user, {"username": username}))
    return jsonify({"ok": True, "user": user})


@app.route("/api/agents/<user_id>/reset-password", methods=["POST", "OPTIONS"])
def reset_agent_password(user_id: str):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not can_manage_agents_and_customers(auth_user):
        return jsonify({"error": "Only supervisors or owner admin can reset agent passwords."}), 403
    data, error = require_json()
    if error:
        return error
    requested_username = str(data.get("temporaryUsername") or "").strip()
    try:
        next_username = normalize_agent_username(requested_username) if requested_username else ""
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    temp_password = str(data.get("temporaryPassword") or "").strip()
    if len(temp_password) < 6:
        return jsonify({"error": "Temporary password must be at least 6 characters."}), 400
    users = load_user_store()
    user = find_user_by_id(users, user_id)
    if not user or not is_susu_agent(user):
        return jsonify({"error": "Agent not found."}), 404
    if not can_view_staff_record(auth_user, user):
        return scoped_access_denial(auth_user)
    username = str(user.get("loginUsername") or "").strip().lower()
    if not username:
        return jsonify({"error": "This agent does not have a username login."}), 400
    if next_username and next_username != username:
        existing = find_user_by_username_safe(users, next_username)
        if existing and existing.get("id") != user.get("id"):
            return jsonify({"error": "That username is already assigned to another agent."}), 400
    user["forcePasswordChange"] = True
    user["setupComplete"] = False
    if next_username:
        user["loginUsername"] = next_username
    passwords = load_password_store()
    if next_username and next_username != username:
        passwords.pop(agent_password_key(username), None)
    active_username = next_username or username
    passwords[agent_password_key(active_username)] = hash_password_for_storage(temp_password)
    save_user_store(users)
    save_password_store(passwords)
    revoke_user_sessions(user_id)
    record_audit_log(
        auth_user,
        "RESET_AGENT_LOGIN",
        staff_audit_target(user, {"previousUsername": username, "temporaryUsername": active_username}),
    )
    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/register", methods=["POST", "OPTIONS"])
def auth_register():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        password = str(data.get("passwordHash", ""))
        department = normalize_portal_department_name(data.get("department"))
        branch = normalize_portal_branch_name(data.get("branch"))
        if not password:
            return jsonify({"error": "Password is required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        if not department or not branch:
            return jsonify({"error": "SUSU category and branch are required"}), 400
        users = load_user_store()
        existing = find_user_by_email(users, email)
        if existing and existing["isVerified"]:
            return jsonify({"error": "Email already registered"}), 400

        pending = load_pending_verifications()
        new_user = normalize_user({
            "id": existing["id"] if existing else f"user-{int(time.time() * 1000)}",
            "fullname": str(data.get("fullname", "")).strip(),
            "phone": str(data.get("phone", "")).strip(),
            "email": email,
            "role": role_from_department(department),
            "position": str(data.get("position", "Staff")).strip() or "Staff",
            "department": department,
            "branch": branch,
            "imageFile": None,
            "isActive": True,
            "isVerified": False,
            "lastSeen": now_ms(),
            "registrationTime": now_ms(),
            "isArchived": False,
        })
        code = generate_verification_code()
        pending[email] = {
            "user": new_user,
            "passwordHash": hash_password_for_storage(password),
            "code": code,
            "expiresAt": int(time.time()) + int(load_portal_settings_store()["verificationMinutes"]) * 60,
        }
        save_pending_verifications(pending)
        send_verification_code_email(email, code)
        record_audit_log(None, "REGISTRATION_STARTED", staff_audit_target(new_user))
        return jsonify({"ok": True, "user": new_user})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Registration failed")
        return jsonify({"error": f"Registration failed: {exc}"}), 500


@app.route("/api/auth/verify-email", methods=["POST", "OPTIONS"])
def auth_verify_email():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        code = "".join(ch for ch in str(data.get("code", "")) if ch.isdigit())
        if len(code) != 6:
            return jsonify({"error": "A 6-digit verification code is required"}), 400

        pending = load_pending_verifications()
        entry = pending.get(email)
        if not entry:
            record_audit_log(
                None,
                "VERIFY_EMAIL_FAILED",
                {"email": email, "reason": "no_pending_verification"},
            )
            return jsonify({"error": "No pending verification for this email"}), 404
        if entry["code"] != code:
            record_audit_log(
                None,
                "VERIFY_EMAIL_FAILED",
                {"email": email, "reason": "incorrect_code"},
            )
            return jsonify({"error": "Incorrect verification code"}), 400

        user = entry["user"]
        user["isVerified"] = True

        users = load_user_store()
        existing = find_user_by_email(users, email)
        if existing:
            existing.update(user)
        else:
            users.append(user)

        passwords = load_password_store()
        passwords[email] = entry["passwordHash"]

        pending.pop(email, None)
        save_user_store(users)
        save_password_store(passwords)
        save_pending_verifications(pending)
        record_audit_log(user, "REGISTRATION_VERIFIED", staff_audit_target(user))
        return jsonify({"ok": True, "user": user})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/resend-verification", methods=["POST", "OPTIONS"])
def auth_resend_verification():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        pending = load_pending_verifications()
        entry = pending.get(email)
        if not entry:
            return jsonify({"error": "Email not found"}), 404
        entry["code"] = generate_verification_code()
        entry["expiresAt"] = int(time.time()) + int(load_portal_settings_store()["verificationMinutes"]) * 60
        pending[email] = entry
        save_pending_verifications(pending)
        send_verification_code_email(email, entry["code"])
        return jsonify({"ok": True})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Verification email failed")
        return jsonify({"error": f"Email could not be sent: {exc}"}), 500


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        password = str(data.get("passwordHash", ""))
        if not password:
            return jsonify({"error": "Password is required"}), 400

        passwords = load_password_store()
        stored_password = passwords.get(email)
        if not stored_password or not verify_password(stored_password, password):
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "invalid_credentials"},
            )
            return jsonify({"error": "Invalid email or password"}), 401

        users = load_user_store()
        user = find_user_by_email(users, email)
        if not user or user["isArchived"] or not user["isActive"]:
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "inactive_or_missing_account"},
            )
            return jsonify({"error": "Invalid email or password"}), 401
        if not user["isVerified"]:
            record_audit_log(
                None,
                "LOGIN_FAILED",
                {"email": email, "reason": "email_not_verified"},
            )
            return jsonify({"error": "Email not verified"}), 403

        if not is_secure_password_hash(stored_password):
            passwords[email] = hash_password_for_storage(password)
            save_password_store(passwords)

        user["lastSeen"] = now_ms()
        save_user_store(users)
        session_token = issue_session(user["id"])
        record_audit_log(user, "LOGIN", staff_audit_target(user))
        return jsonify({"ok": True, "user": user, "sessionToken": session_token})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/agent-login", methods=["POST", "OPTIONS"])
def auth_agent_login():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        username = normalize_agent_username(data.get("username"))
        password = str(data.get("passwordHash", ""))
        if not password:
            return jsonify({"error": "Password is required"}), 400
        users = load_user_store()
        user = find_user_by_username(users, username)
        passwords = load_password_store()
        stored_password = passwords.get(agent_password_key(username))
        if not user or not stored_password or not verify_password(stored_password, password):
            record_audit_log(None, "AGENT_LOGIN_FAILED", {"username": username, "reason": "invalid_credentials"})
            return jsonify({"error": "Invalid username or password"}), 401
        if user["isArchived"] or not user["isActive"]:
            record_audit_log(None, "AGENT_LOGIN_FAILED", {"username": username, "reason": "inactive_or_missing_account"})
            return jsonify({"error": "Invalid username or password"}), 401
        if bool(user.get("forcePasswordChange", False)) or not bool(user.get("setupComplete", True)):
            return jsonify({
                "ok": True,
                "requiresSetup": True,
                "username": username,
                "message": "First login requires phone verification and password reset.",
            })
        user["lastSeen"] = now_ms()
        save_user_store(users)
        session_token = issue_session(user["id"])
        record_audit_log(user, "AGENT_LOGIN", staff_audit_target(user, {"username": username}))
        return jsonify({"ok": True, "user": user, "sessionToken": session_token})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/agent-verify-phone", methods=["POST", "OPTIONS"])
def auth_agent_verify_phone():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        username = normalize_agent_username(data.get("username"))
        temp_password = str(data.get("temporaryPassword") or "")
        phone = normalize_phone(data.get("phone"))
        users = load_user_store()
        user = find_user_by_username(users, username)
        passwords = load_password_store()
        stored_password = passwords.get(agent_password_key(username))
        if not user or not stored_password or not verify_password(stored_password, temp_password):
            return jsonify({"error": "Invalid username or temporary password."}), 401
        if user["isArchived"] or not user["isActive"]:
            return jsonify({"error": "Invalid username or password"}), 401
        if "".join(ch for ch in str(user.get("phone") or "") if ch.isdigit()) != "".join(ch for ch in phone if ch.isdigit()):
            return jsonify({"error": "Phone number does not match the supervisor record."}), 400
        return jsonify({"ok": True, "message": "Verification token ready."})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/agent-complete-setup", methods=["POST", "OPTIONS"])
def auth_agent_complete_setup():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        username = normalize_agent_username(data.get("username"))
        new_username = normalize_agent_username(data.get("newUsername") or username)
        temp_password = str(data.get("temporaryPassword") or "")
        new_password = str(data.get("newPasswordHash") or "")
        phone = normalize_phone(data.get("phone"))
        token_code = "".join(ch for ch in str(data.get("token") or "") if ch.isdigit())
        if token_code != "1234":
            return jsonify({"error": "Invalid verification token."}), 400
        if len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters."}), 400
        users = load_user_store()
        user = find_user_by_username(users, username)
        passwords = load_password_store()
        stored_password = passwords.get(agent_password_key(username))
        if not user or not stored_password or not verify_password(stored_password, temp_password):
            return jsonify({"error": "Invalid username or temporary password."}), 401
        existing_username = find_user_by_username_safe(users, new_username)
        if existing_username and existing_username.get("id") != user.get("id"):
            return jsonify({"error": "That permanent username is already used by another agent."}), 400
        if "".join(ch for ch in str(user.get("phone") or "") if ch.isdigit()) != "".join(ch for ch in phone if ch.isdigit()):
            return jsonify({"error": "Phone number does not match the supervisor record."}), 400
        if new_username != username:
            passwords.pop(agent_password_key(username), None)
            user["loginUsername"] = new_username
        user["forcePasswordChange"] = False
        user["setupComplete"] = True
        user["lastSeen"] = now_ms()
        passwords[agent_password_key(new_username)] = hash_password_for_storage(new_password)
        save_user_store(users)
        save_password_store(passwords)
        session_token = issue_session(user["id"])
        record_audit_log(
            user,
            "AGENT_SETUP_COMPLETED",
            staff_audit_target(user, {"temporaryUsername": username, "permanentUsername": new_username}),
        )
        return jsonify({"ok": True, "user": user, "sessionToken": session_token})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def auth_logout():
    preflight = handle_options()
    if preflight:
        return preflight
    token, auth_user, error = require_authenticated_user()
    if error:
        return error
    set_user_last_seen(auth_user["id"], now_ms())
    store = prune_presence(load_presence_store())
    store.pop(auth_user["id"], None)
    save_presence_store(store)
    revoke_session(token)
    record_audit_log(auth_user, "LOGOUT", staff_audit_target(auth_user))
    return jsonify({"ok": True})


@app.route("/api/auth/request-password-reset", methods=["POST", "OPTIONS"])
def auth_request_password_reset():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    try:
        email = validate_email(str(data.get("email", "")))
        reset_page_url = str(data.get("resetPageUrl", "")).strip()

        users = load_user_store()
        user = find_user_by_email(users, email)
        if not user:
            return jsonify({"error": "Email not found"}), 404

        token = secrets.token_urlsafe(32)
        reset_url = build_reset_url(reset_page_url, token)
        tokens = load_reset_tokens()
        tokens[token] = {
            "email": email,
            "expiresAt": int(time.time()) + int(load_portal_settings_store()["passwordResetMinutes"]) * 60,
        }
        save_reset_tokens(tokens)
        send_password_reset_link_email(email, reset_url)
        record_audit_log(None, "REQUEST_PASSWORD_RESET", staff_audit_target(user))
        return jsonify({"ok": True})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Password reset email failed")
        return jsonify({"error": f"Email could not be sent: {exc}"}), 500


@app.route("/api/auth/password-reset", methods=["POST", "OPTIONS"])
def auth_password_reset():
    preflight = handle_options()
    if preflight:
        return preflight
    data, error = require_json()
    if error:
        return error
    token = str(data.get("token", "")).strip()
    new_password = str(data.get("newPasswordHash", ""))
    if not token:
        return jsonify({"error": "token is required"}), 400
    if not new_password:
        return jsonify({"error": "Password is required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    tokens = load_reset_tokens()
    entry = tokens.get(token)
    if not entry:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    email = entry["email"]
    users = load_user_store()
    if not find_user_by_email(users, email):
        return jsonify({"error": "Invalid or expired reset token"}), 400

    passwords = load_password_store()
    passwords[email] = hash_password_for_storage(new_password)
    tokens.pop(token, None)
    save_password_store(passwords)
    save_reset_tokens(tokens)
    user = find_user_by_email(users, email)
    if user:
        revoke_user_sessions(user["id"])
        record_audit_log(None, "COMPLETE_PASSWORD_RESET", staff_audit_target(user))
    return jsonify({"ok": True})


@app.route("/api/content/announcements", methods=["GET"])
def get_shared_announcements():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"announcements": filter_items_for_user(load_json_list_store(ANNOUNCEMENTS_STORE_PATH), auth_user)})


@app.route("/api/content/announcements", methods=["POST", "OPTIONS"])
def create_shared_announcement():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    try:
        payload = normalize_announcement_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="announcements",
        branch_scope=item_branch_scope(payload),
        department_scope=item_department_scope(payload),
    )
    if not allowed:
        return denial
    announcement = {
        "id": next_content_id(items),
        **payload,
        "authorId": actor["id"],
        "authorName": actor["fullname"],
        "createdAt": now_ms(),
        "updatedAt": now_ms(),
        "isDismissed": False,
        "isTrashed": False,
    }
    items.insert(0, announcement)
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True, "announcement": announcement})


@app.route("/api/content/announcements/<int:item_id>/update", methods=["POST", "OPTIONS"])
def update_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    try:
        payload = normalize_announcement_payload(data, actor, announcement)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="announcements",
        branch_scope=item_branch_scope(payload),
        department_scope=item_department_scope(payload),
    )
    if not allowed:
        return denial
    previous_image = str(announcement.get("imageUrl") or "").strip()
    previous_file = str(announcement.get("fileUrl") or "").strip()
    announcement.update(payload)
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "UPDATE_ANNOUNCEMENT", "announcement", announcement)
    if previous_image.startswith("LOCAL:") and previous_image != str(announcement.get("imageUrl") or "").strip():
        remove_uploaded_file_if_unused(previous_image.replace("LOCAL:", "", 1).strip())
    if previous_file.startswith("LOCAL:") and previous_file != str(announcement.get("fileUrl") or "").strip():
        remove_uploaded_file_if_unused(previous_file.replace("LOCAL:", "", 1).strip())
    return jsonify({"ok": True, "announcement": announcement})


@app.route("/api/content/announcements/<int:item_id>/trash", methods=["POST", "OPTIONS"])
def trash_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    announcement["isTrashed"] = True
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "TRASH_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/<int:item_id>/restore", methods=["POST", "OPTIONS"])
def restore_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    announcement = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, announcement, "announcements"):
        return scoped_access_denial(actor)
    announcement["isTrashed"] = False
    announcement["updatedAt"] = now_ms()
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, items)
    record_content_audit(actor, "RESTORE_ANNOUNCEMENT", "announcement", announcement)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_announcement(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("announcements")
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Announcement not found"}), 404
    if not user_can_manage_item(actor, target, "announcements"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(ANNOUNCEMENTS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_ANNOUNCEMENT", "announcement", target)
    cleanup_local_announcement_assets(target)
    return jsonify({"ok": True})


@app.route("/api/content/announcements/empty-trash", methods=["POST", "OPTIONS"])
def empty_shared_announcement_trash():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_staff_manager()
    if error:
        return error
    items = load_json_list_store(ANNOUNCEMENTS_STORE_PATH)
    trashed_items = [item for item in items if bool(item.get("isTrashed", False))]
    save_json_list_store(
        ANNOUNCEMENTS_STORE_PATH,
        [item for item in items if not bool(item.get("isTrashed", False))],
    )
    for item in trashed_items:
        cleanup_local_announcement_assets(item)
    record_audit_log(
        actor,
        "EMPTY_ANNOUNCEMENT_TRASH",
        {"module": "announcement", "deletedCount": len(trashed_items)},
    )
    return jsonify({"ok": True})


@app.route("/api/content/forms", methods=["GET"])
def get_shared_forms():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    return jsonify({"forms": filter_items_for_user(load_json_list_store(FORMS_STORE_PATH), auth_user)})


@app.route("/api/uploads/training-video", methods=["POST", "OPTIONS"])
def upload_training_video_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("trainingVideos")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "video")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/training-document", methods=["POST", "OPTIONS"])
def upload_training_document_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("trainingDocuments")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "document")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/announcement-asset", methods=["POST", "OPTIONS"])
def upload_announcement_asset_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_module_manager("announcements")
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "announcement")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/uploads/profile-photo", methods=["POST", "OPTIONS"])
def upload_profile_photo_file():
    preflight = handle_options()
    if preflight:
        return preflight
    _, _, error = require_authenticated_user()
    if error:
        return error
    try:
        saved = save_uploaded_media(request.files.get("file"), "profile")
        return jsonify({"ok": True, **saved})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/api/content/forms", methods=["POST", "OPTIONS"])
def create_shared_form():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(FORMS_STORE_PATH)
    try:
        visibility, department = normalize_visibility_and_department(data)
        branch_scope, department_scope = derive_content_scope(
            data,
            visibility=visibility,
            department=department,
        )
        form = {
            "id": next_content_id(items),
            "title": normalize_non_empty_title(data.get("title"), "Form title"),
            "description": str(data.get("description", "")).strip(),
            "fileUrl": normalize_form_file_url(data.get("fileUrl")),
            "category": str(data.get("category", "")).strip() or actor["department"],
            "visibleTo": [],
            "visibility": visibility,
            "department": department,
            "branchScope": branch_scope,
            "departmentScope": department_scope,
            "createdAt": now_ms(),
            "updatedAt": now_ms(),
        }
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="forms",
        branch_scope=branch_scope,
        department_scope=department_scope,
    )
    if not allowed:
        return denial
    items.insert(0, form)
    save_json_list_store(FORMS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_FORM", "form", form)
    delivery = fanout_content_notification(
        kind="system",
        title="New Form Available",
        message=f"{form['title']} has been added to the forms centre.",
        email_subject="Bawjiase SUSU Collection Portal - New Form Available",
        email_headline="New Form Available",
        email_intro="A new form has been added to the Bawjiase SUSU Collection Portal for eligible staff.",
        item_title=form["title"],
        visibility=form["visibility"],
        department=form.get("department"),
        branch_scope=form.get("branchScope"),
        department_scope=form.get("departmentScope"),
        link_to="/forms",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "form": form, "delivery": delivery})


@app.route("/api/content/forms/<int:item_id>/update", methods=["POST", "OPTIONS"])
def update_shared_form(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    items = load_json_list_store(FORMS_STORE_PATH)
    form = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not form:
        return jsonify({"error": "Form not found"}), 404
    if not user_can_manage_item(actor, form, "forms"):
        return scoped_access_denial(actor)
    try:
        if "title" in data:
            form["title"] = normalize_non_empty_title(data.get("title"), "Form title")
        if "description" in data:
            form["description"] = str(data.get("description", "")).strip()
        if "fileUrl" in data:
            form["fileUrl"] = normalize_form_file_url(data.get("fileUrl"))
        if "category" in data:
            form["category"] = str(data.get("category", "")).strip() or form["category"]
        if (
            "visibility" in data
            or "department" in data
            or "branchScope" in data
            or "departmentScope" in data
        ):
            merged = {
                "visibility": data.get("visibility", form.get("visibility")),
                "department": data.get("department", form.get("department")),
                "branchScope": data.get("branchScope", form.get("branchScope")),
                "departmentScope": data.get("departmentScope", form.get("departmentScope")),
            }
            visibility, department = normalize_visibility_and_department(merged)
            branch_scope, department_scope = derive_content_scope(
                merged,
                visibility=visibility,
                department=department,
                existing=form,
            )
            form["visibility"] = visibility
            form["department"] = department
            form["branchScope"] = branch_scope
            form["departmentScope"] = department_scope
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="forms",
        branch_scope=item_branch_scope(form),
        department_scope=item_department_scope(form),
    )
    if not allowed:
        return denial
    form["updatedAt"] = now_ms()
    save_json_list_store(FORMS_STORE_PATH, items)
    record_content_audit(actor, "UPDATE_FORM", "form", form)
    return jsonify({"ok": True, "form": form})


@app.route("/api/content/forms/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_form(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("forms")
    if error:
        return error
    items = load_json_list_store(FORMS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Form not found"}), 404
    if not user_can_manage_item(actor, target, "forms"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(FORMS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_FORM", "form", target)
    return jsonify({"ok": True})


@app.route("/api/content/training/videos", methods=["GET"])
def get_shared_training_videos():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return jsonify({"videos": filter_items_for_user(items, auth_user)})


@app.route("/api/content/training/videos", methods=["POST", "OPTIONS"])
def create_shared_training_video():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    try:
        video = normalize_training_video_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="trainingVideos",
        branch_scope=item_branch_scope(video),
        department_scope=item_department_scope(video),
    )
    if not allowed:
        return denial
    items.insert(0, video)
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_TRAINING_VIDEO", "trainingVideo", video)
    video_subject = (
        "Bawjiase SUSU Collection Portal - Mandatory Training Assigned"
        if video["isMandatory"]
        else "Bawjiase SUSU Collection Portal - New Training Video"
    )
    video_title = (
        "Mandatory Training Assigned"
        if video["isMandatory"]
        else "New Training Video"
    )
    video_intro = (
        "A mandatory training video has been assigned to eligible staff."
        if video["isMandatory"]
        else "A new training video has been uploaded for eligible staff."
    )
    delivery = fanout_content_notification(
        kind="training",
        title=video_title,
        message=f"{video['title']} is now available in the training portal.",
        email_subject=video_subject,
        email_headline=video_title,
        email_intro=video_intro,
        item_title=video["title"],
        visibility=video["visibility"],
        department=video.get("department"),
        branch_scope=video.get("branchScope"),
        department_scope=video.get("departmentScope"),
        link_to="/training",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "video": video, "delivery": delivery})


@app.route("/api/content/training/videos/<int:item_id>/progress", methods=["GET"])
def get_my_training_video_progress(item_id: int):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video or bool(video.get("isArchived", False)):
        return jsonify({"error": "Video not found"}), 404
    if not user_can_access_item(auth_user, video):
        return jsonify({"error": "Access denied"}), 403
    progress_items = load_training_video_progress_store()
    item = next(
        (
            entry
            for entry in progress_items
            if entry["userId"] == auth_user["id"] and int(entry["videoId"]) == item_id
        ),
        None,
    )
    return jsonify({"progress": serialize_video_progress(item or {"videoId": item_id}) if item else None})


@app.route("/api/content/training/videos/<int:item_id>/progress", methods=["POST", "OPTIONS"])
def update_my_training_video_progress(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video or bool(video.get("isArchived", False)):
        return jsonify({"error": "Video not found"}), 404
    if not user_can_access_item(auth_user, video):
        return jsonify({"error": "Access denied"}), 403
    progress_percent = max(0, min(100, int(data.get("progressPercent", 0) or 0)))
    progress_items = load_training_video_progress_store()
    entry = next(
        (
            item
            for item in progress_items
            if item["userId"] == auth_user["id"] and int(item["videoId"]) == item_id
        ),
        None,
    )
    payload = {
        "userId": auth_user["id"],
        "videoId": item_id,
        "progressPercent": progress_percent,
        "isComplete": progress_percent >= 98,
        "lastWatched": now_ms(),
    }
    previous_percent = int(entry.get("progressPercent", 0) or 0) if entry else 0
    is_local_video = str(video.get("storageType", "")).strip() == "Local"
    if is_local_video:
        if progress_percent < previous_percent:
            progress_percent = previous_percent
        elif progress_percent > previous_percent + 20:
            return jsonify({"error": "Invalid progress update"}), 400
        if progress_percent >= 98 and previous_percent < 80:
            return jsonify({"error": "Progress jumped too far ahead"}), 400
        payload["progressPercent"] = progress_percent
        payload["isComplete"] = progress_percent >= 98
    if entry:
        entry.update(payload)
    else:
        progress_items.append(payload)
    save_training_video_progress_store(progress_items)
    refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    return jsonify({"ok": True, "progress": serialize_video_progress(payload)})


@app.route("/api/content/training/videos/stats", methods=["GET"])
def get_training_video_stats():
    _, auth_user, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    progress_items = load_training_video_progress_store()
    stats = []
    for video in items:
        if bool(video.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, video, "trainingVideos"):
            continue
        video_id = int(video.get("id", 0) or 0)
        watched_count = len(
            {
                entry["userId"]
                for entry in progress_items
                if int(entry["videoId"]) == video_id and int(entry["progressPercent"]) > 0
            }
        )
        completed_count = len(
            {
                entry["userId"]
                for entry in progress_items
                if int(entry["videoId"]) == video_id and bool(entry["isComplete"])
            }
        )
        stats.append(
            {
                "videoId": video_id,
                "title": str(video.get("title", "")),
                "totalWatched": watched_count,
                "completedCount": completed_count,
            }
        )
    return jsonify({"stats": stats})


@app.route("/api/content/training/videos/<int:item_id>/archive", methods=["POST", "OPTIONS"])
def archive_shared_training_video(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    video = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not video:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(actor, video, "trainingVideos"):
        return scoped_access_denial(actor)
    video["isArchived"] = True
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, items)
    record_content_audit(actor, "ARCHIVE_TRAINING_VIDEO", "trainingVideo", video)
    return jsonify({"ok": True})


@app.route("/api/content/training/videos/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_training_video(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingVideos")
    if error:
        return error
    items = load_json_list_store(TRAINING_VIDEOS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(actor, target, "trainingVideos"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(TRAINING_VIDEOS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_TRAINING_VIDEO", "trainingVideo", target)
    if target and str(target.get("storageType", "")).strip() == "Local":
        remove_uploaded_file_if_unused(str(target.get("localFilename", "")).strip())
    return jsonify({"ok": True})


@app.route("/api/content/training/documents", methods=["GET"])
def get_shared_training_documents():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return jsonify({"documents": filter_items_for_user(items, auth_user)})


@app.route("/api/content/training/documents", methods=["POST", "OPTIONS"])
def create_shared_training_document():
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    data, error = require_json()
    if error:
        return error
    send_external_emails = bool(data.get("sendExternalEmails", False))
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    try:
        document = normalize_training_document_payload(data, actor)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    allowed, denial = ensure_content_management_access(
        actor,
        permission_key="trainingDocuments",
        branch_scope=item_branch_scope(document),
        department_scope=item_department_scope(document),
    )
    if not allowed:
        return denial
    items.insert(0, document)
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    record_content_audit(actor, "CREATE_TRAINING_DOCUMENT", "trainingDocument", document)
    document_subject = (
        "Bawjiase SUSU Collection Portal - Mandatory Training Document"
        if document["isMandatory"]
        else "Bawjiase SUSU Collection Portal - New Training Document"
    )
    document_title = (
        "Mandatory Training Document"
        if document["isMandatory"]
        else "New Training Document"
    )
    document_intro = (
        "A mandatory training document has been shared with eligible staff."
        if document["isMandatory"]
        else "A new training document has been uploaded for eligible staff."
    )
    delivery = fanout_content_notification(
        kind="training",
        title=document_title,
        message=f"{document['title']} is now available in the training portal.",
        email_subject=document_subject,
        email_headline=document_title,
        email_intro=document_intro,
        item_title=document["title"],
        visibility=document["visibility"],
        department=document.get("department"),
        branch_scope=document.get("branchScope"),
        department_scope=document.get("departmentScope"),
        link_to="/training",
        send_external_emails=send_external_emails,
    )
    return jsonify({"ok": True, "document": document, "delivery": delivery})


@app.route("/api/content/training/documents/<int:item_id>/open-state", methods=["GET"])
def get_my_training_document_open_state(item_id: int):
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document or bool(document.get("isArchived", False)):
        return jsonify({"error": "Document not found"}), 404
    if not user_can_access_item(auth_user, document):
        return jsonify({"error": "Access denied"}), 403
    open_items = load_training_document_opens_store()
    item = next(
        (
            entry
            for entry in open_items
            if entry["userId"] == auth_user["id"] and int(entry["documentId"]) == item_id
        ),
        None,
    )
    return jsonify({"state": serialize_document_open_state(item)})


@app.route("/api/content/training/documents/<int:item_id>/open", methods=["POST", "OPTIONS"])
def mark_training_document_opened(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document or bool(document.get("isArchived", False)):
        return jsonify({"error": "Document not found"}), 404
    if not user_can_access_item(auth_user, document):
        return jsonify({"error": "Access denied"}), 403
    open_items = load_training_document_opens_store()
    entry = next(
        (
            item
            for item in open_items
            if item["userId"] == auth_user["id"] and int(item["documentId"]) == item_id
        ),
        None,
    )
    payload = {
        "userId": auth_user["id"],
        "documentId": item_id,
        "openedAt": now_ms(),
    }
    if entry:
        entry.update(payload)
    else:
        open_items.append(payload)
    save_training_document_opens_store(open_items)
    refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    return jsonify({"ok": True, "state": serialize_document_open_state(payload)})


@app.route("/api/content/training/documents/stats", methods=["GET"])
def get_training_document_stats():
    _, auth_user, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    open_items = load_training_document_opens_store()
    stats = []
    for document in items:
        if bool(document.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, document, "trainingDocuments"):
            continue
        document_id = int(document.get("id", 0) or 0)
        opened_count = len(
            {
                entry["userId"]
                for entry in open_items
                if int(entry["documentId"]) == document_id and int(entry["openedAt"]) > 0
            }
        )
        stats.append(
            {
                "docId": document_id,
                "title": str(document.get("title", "")),
                "openedCount": opened_count,
            }
        )
    return jsonify({"stats": stats})


@app.route("/api/content/training/documents/<int:item_id>/archive", methods=["POST", "OPTIONS"])
def archive_shared_training_document(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    document = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not document:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(actor, document, "trainingDocuments"):
        return scoped_access_denial(actor)
    document["isArchived"] = True
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, items)
    record_content_audit(actor, "ARCHIVE_TRAINING_DOCUMENT", "trainingDocument", document)
    return jsonify({"ok": True})


@app.route("/api/content/training/documents/<int:item_id>/delete", methods=["POST", "OPTIONS"])
def delete_shared_training_document(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, actor, error = require_module_manager("trainingDocuments")
    if error:
        return error
    items = load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH)
    target = next((item for item in items if int(item.get("id", 0) or 0) == item_id), None)
    if not target:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(actor, target, "trainingDocuments"):
        return scoped_access_denial(actor)
    filtered = [item for item in items if int(item.get("id", 0) or 0) != item_id]
    save_json_list_store(TRAINING_DOCUMENTS_STORE_PATH, filtered)
    record_content_audit(actor, "DELETE_TRAINING_DOCUMENT", "trainingDocument", target)
    if target and str(target.get("storageType", "")).strip() == "Local":
        remove_uploaded_file_if_unused(str(target.get("localFilename", "")).strip())
    return jsonify({"ok": True})


@app.route("/api/content/training/admin-overview", methods=["GET"])
def get_admin_training_overview():
    _, auth_user, error = require_authenticated_user()
    if error:
        return error
    if not (
        user_has_permission(auth_user, "trainingVideos")
        or user_has_permission(auth_user, "trainingDocuments")
    ):
        return jsonify({"error": "Admin access required"}), 403
    videos = refresh_training_video_counts(load_json_list_store(TRAINING_VIDEOS_STORE_PATH))
    documents = refresh_training_document_counts(load_json_list_store(TRAINING_DOCUMENTS_STORE_PATH))
    users = [
        user
        for user in load_user_store()
        if user["isActive"] and user["isVerified"] and not user["isArchived"]
    ]
    progress_items = load_training_video_progress_store()
    open_items = load_training_document_opens_store()
    video_stats = []
    for video in videos:
        if bool(video.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, video, "trainingVideos"):
            continue
        video_id = int(video.get("id", 0) or 0)
        eligible_users = eligible_users_for_item(video)
        watched_user_ids = {
            entry["userId"]
            for entry in progress_items
            if int(entry["videoId"]) == video_id and int(entry["progressPercent"]) > 0
        }
        completed_user_ids = {
            entry["userId"]
            for entry in progress_items
            if int(entry["videoId"]) == video_id and bool(entry["isComplete"])
        }
        eligible_count = len(eligible_users)
        incomplete_users = [
            user["fullname"] for user in eligible_users if user["id"] not in completed_user_ids
        ]
        video_stats.append(
            {
                "id": video_id,
                "title": str(video.get("title", "")),
                "eligibleCount": eligible_count,
                "watchedCount": len(watched_user_ids),
                "completionPct": round((len(completed_user_ids) / eligible_count) * 100) if eligible_count else 0,
                "isMandatory": bool(video.get("isMandatory", False)),
                "branchScope": item_branch_scope(video),
                "departmentScope": item_department_scope(video),
                "incompleteCount": len(incomplete_users),
                "incompleteUsers": incomplete_users[:100],
            }
        )
    document_stats = []
    for document in documents:
        if bool(document.get("isArchived", False)):
            continue
        if not user_can_manage_item(auth_user, document, "trainingDocuments"):
            continue
        document_id = int(document.get("id", 0) or 0)
        eligible_users = eligible_users_for_item(document)
        opened_user_ids = {
            entry["userId"]
            for entry in open_items
            if int(entry["documentId"]) == document_id and int(entry["openedAt"]) > 0
        }
        eligible_count = len(eligible_users)
        incomplete_users = [
            user["fullname"] for user in eligible_users if user["id"] not in opened_user_ids
        ]
        document_stats.append(
            {
                "id": document_id,
                "title": str(document.get("title", "")),
                "eligibleCount": eligible_count,
                "openedCount": len(opened_user_ids),
                "openedPct": round((len(opened_user_ids) / eligible_count) * 100) if eligible_count else 0,
                "isMandatory": bool(document.get("isMandatory", False)),
                "branchScope": item_branch_scope(document),
                "departmentScope": item_department_scope(document),
                "incompleteCount": len(incomplete_users),
                "incompleteUsers": incomplete_users[:100],
            }
        )
    return jsonify(
        {
            "overview": {
                "totalVideos": len([item for item in videos if not bool(item.get("isArchived", False))]),
                "totalDocuments": len([item for item in documents if not bool(item.get("isArchived", False))]),
                "totalStaff": len(users),
                "videoStats": video_stats,
                "docStats": document_stats,
            }
        }
    )


@app.route("/api/content/training/videos/<int:item_id>/remind", methods=["POST", "OPTIONS"])
def send_video_training_reminder(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_module_manager("trainingVideos")
    if error:
        return error
    video = get_training_video_by_id(item_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404
    if not user_can_manage_item(auth_user, video, "trainingVideos"):
        return scoped_access_denial(auth_user)
    try:
        delivery = send_training_reminders("video", item_id)
    except ValueError:
        return jsonify({"error": "Video not found"}), 404
    return jsonify({"ok": True, "delivery": delivery})


@app.route("/api/content/training/documents/<int:item_id>/remind", methods=["POST", "OPTIONS"])
def send_document_training_reminder(item_id: int):
    preflight = handle_options()
    if preflight:
        return preflight
    _, auth_user, error = require_module_manager("trainingDocuments")
    if error:
        return error
    document = get_training_document_by_id(item_id)
    if not document:
        return jsonify({"error": "Document not found"}), 404
    if not user_can_manage_item(auth_user, document, "trainingDocuments"):
        return scoped_access_denial(auth_user)
    try:
        delivery = send_training_reminders("document", item_id)
    except ValueError:
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"ok": True, "delivery": delivery})


@app.route("/", defaults={"path": ""}, methods=["GET"])
@app.route("/<path:path>", methods=["GET"])
def serve_frontend(path: str):
    requested = str(path or "").strip().lstrip("/")
    if not os.path.isdir(FRONTEND_PUBLIC_DIR):
        return jsonify({"error": "Frontend build is not installed on this server."}), 404

    if requested:
        candidate = os.path.join(FRONTEND_PUBLIC_DIR, requested)
        if os.path.isfile(candidate):
            return send_from_directory(FRONTEND_PUBLIC_DIR, requested, conditional=True)

    index_path = os.path.join(FRONTEND_PUBLIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return send_from_directory(FRONTEND_PUBLIC_DIR, "index.html", conditional=True)

    return jsonify({"error": "Frontend entry point not found."}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4185")))

