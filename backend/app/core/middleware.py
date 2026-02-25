from __future__ import annotations

import logging
import time
import uuid
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Paths that don't need audit logging
_SKIP_AUDIT_PATHS = {"/health", "/", "/docs", "/redoc", "/openapi.json"}


def _extract_resource(path: str) -> tuple[str, Optional[str]]:
    """Parse /api/v1/<resource>/<id> → (resource_type, resource_id)."""
    parts = [p for p in path.split("/") if p]
    # /api/v1/<resource>/<id>
    if len(parts) >= 3 and parts[0] == "api":
        resource = parts[2] if len(parts) > 2 else "unknown"
        res_id = parts[3] if len(parts) > 3 else None
        return resource, res_id
    if len(parts) >= 1:
        return parts[0], parts[1] if len(parts) > 1 else None
    return "unknown", None


def _decode_user_id(auth_header: Optional[str]) -> Optional[int]:
    """Best-effort JWT decode to get user_id — never raises."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        from app.core.security import decode_token
        token = auth_header[7:]
        payload = decode_token(token)
        return int(payload.get("sub", 0)) or None
    except Exception:
        return None


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Logs POST/PUT/DELETE mutations to audit_logs table (fire-and-forget)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        method = request.method
        path = request.url.path

        # Only audit mutations on API paths
        if method not in ("POST", "PUT", "PATCH", "DELETE"):
            return response
        if path in _SKIP_AUDIT_PATHS or not path.startswith("/api/"):
            return response

        # Best-effort — never block the response
        try:
            request_id = getattr(request.state, "request_id", None)
            user_id = _decode_user_id(request.headers.get("Authorization"))
            resource_type, resource_id = _extract_resource(path)
            action = f"{method}:{path}"
            ip = request.headers.get("X-Real-IP") or request.client.host if request.client else None
            ua = request.headers.get("User-Agent", "")[:200]

            import asyncio
            asyncio.ensure_future(
                _write_audit_log(
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    ip_address=ip,
                    user_agent=ua,
                    request_id=request_id,
                    status_code=response.status_code,
                )
            )
        except Exception as e:
            logger.debug(f"Audit log skipped: {e}")

        return response


async def _write_audit_log(
    user_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str],
    ip_address: Optional[str],
    user_agent: str,
    request_id: Optional[str],
    status_code: int,
):
    """Write audit log entry to DB asynchronously."""
    try:
        from app.db.session import AsyncSessionLocal
        from app.models.audit import AuditLog
        async with AsyncSessionLocal() as db:
            log = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                ip_address=ip_address,
                user_agent=user_agent,
                request_id=request_id,
                status_code=status_code,
            )
            db.add(log)
            await db.commit()
    except Exception as e:
        logger.debug(f"Audit log write failed: {e}")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
