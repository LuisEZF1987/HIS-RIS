from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token, has_permission
from app.db.session import get_async_session
from app.models.user import User, UserRole

security = HTTPBearer(auto_error=False)

# ── DB Dependency ──────────────────────────────────────────────────────────────
DBSession = Annotated[AsyncSession, Depends(get_async_session)]


# ── Auth Dependency ────────────────────────────────────────────────────────────
async def get_current_user(
    db: DBSession,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    if not credentials:
        raise UnauthorizedError("No authentication token provided")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")

    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User not found")
    if not user.is_active:
        raise ForbiddenError("User account is disabled")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Role-based permission dependency factory ───────────────────────────────────
def require_permission(permission: str):
    async def _check(current_user: CurrentUser) -> User:
        if not has_permission(current_user.role, permission):
            raise ForbiddenError(f"Permission '{permission}' required")
        return current_user
    return Depends(_check)


def require_role(*roles: UserRole):
    async def _check(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(f"Required roles: {[r.value for r in roles]}")
        return current_user
    return Depends(_check)


# ── Optional current user (for public endpoints with optional auth) ─────────────
async def get_current_user_optional(
    db: DBSession,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[User]:
    if not credentials:
        return None
    try:
        return await get_current_user(db, credentials)
    except Exception:
        return None
