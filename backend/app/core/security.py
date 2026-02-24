from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings
from app.models.user import UserRole

settings = get_settings()

# Role permission matrix
ROLE_PERMISSIONS: dict[UserRole, list[str]] = {
    UserRole.admin: [
        "patients:read", "patients:write", "patients:delete",
        "encounters:read", "encounters:write",
        "orders:read", "orders:write", "orders:delete",
        "worklist:read", "worklist:write",
        "studies:read", "studies:write",
        "reports:read", "reports:write", "reports:sign",
        "appointments:read", "appointments:write",
        "users:read", "users:write", "users:delete",
        "admin:access",
        "hl7:read", "hl7:write",
        "fhir:read",
        "audit:read",
    ],
    UserRole.receptionist: [
        "patients:read", "patients:write",
        "encounters:read", "encounters:write",
        "appointments:read", "appointments:write",
        "orders:read",
    ],
    UserRole.technician: [
        "patients:read",
        "orders:read", "orders:write",
        "worklist:read", "worklist:write",
        "studies:read", "studies:write",
        "appointments:read",
    ],
    UserRole.radiologist: [
        "patients:read",
        "orders:read",
        "worklist:read",
        "studies:read",
        "reports:read", "reports:write", "reports:sign",
        "appointments:read",
    ],
    UserRole.physician: [
        "patients:read",
        "encounters:read", "encounters:write",
        "orders:read", "orders:write",
        "reports:read",
        "appointments:read",
        "fhir:read",
    ],
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def has_permission(role: UserRole, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, [])


def _get_key(private: bool = False) -> str:
    if settings.jwt_algorithm == "RS256":
        if private:
            key = settings.get_private_key()
        else:
            key = settings.get_public_key()
        if key:
            return key
    # Fallback to HS256 for dev
    return settings.secret_key


def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    algorithm = settings.jwt_algorithm if settings.get_private_key() else "HS256"
    key = _get_key(private=True)
    return jwt.encode(to_encode, key, algorithm=algorithm)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh", "jti": secrets.token_hex(16)})
    algorithm = settings.jwt_algorithm if settings.get_private_key() else "HS256"
    key = _get_key(private=True)
    return jwt.encode(to_encode, key, algorithm=algorithm)


def decode_token(token: str) -> dict[str, Any]:
    algorithm = settings.jwt_algorithm if settings.get_public_key() else "HS256"
    key = _get_key(private=False)
    return jwt.decode(token, key, algorithms=[algorithm])


def compute_report_signature(report_id: int, content: str, radiologist_id: int, timestamp: datetime) -> str:
    data = f"{report_id}|{content}|{radiologist_id}|{timestamp.isoformat()}"
    return hashlib.sha256(data.encode()).hexdigest()
