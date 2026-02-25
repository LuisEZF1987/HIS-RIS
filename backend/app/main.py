from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.middleware import AuditLogMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware, TimingMiddleware
import app.db.base  # noqa: F401 — registers all ORM models with SQLAlchemy mapper
from app.db.session import engine
from app.routers import admin, adt, auth, dicom, fhir, hl7, orthanc, reports, ris, schedule

settings = get_settings()
logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")

    # Start HL7 MLLP TCP listener on port 2575
    mllp_server = None
    try:
        from app.core.mllp_server import start_mllp_server
        mllp_server = await start_mllp_server(host="0.0.0.0", port=2575)
    except Exception as e:
        logger.warning(f"MLLP server could not start: {e}")

    yield

    if mllp_server:
        mllp_server.close()
        await mllp_server.wait_closed()
        logger.info("MLLP server stopped")
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Dimed HIS/RIS — Sistema de Información Hospitalaria y Radiológica integrado con PACS Orthanc, DICOM MWL, HL7 v2.x y FHIR R4",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(TimingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ─────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ── Routers ────────────────────────────────────────────────────────────────────
PREFIX = settings.api_v1_prefix

app.include_router(auth.router, prefix=PREFIX)
app.include_router(adt.router, prefix=PREFIX)
app.include_router(ris.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(schedule.router, prefix=PREFIX)
app.include_router(dicom.router, prefix=PREFIX)
app.include_router(orthanc.router, prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)
app.include_router(hl7.router, prefix=PREFIX)
# FHIR routes use their own prefix /fhir/r4
app.include_router(fhir.router)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.app_name}",
        "docs": "/docs",
        "health": "/health",
    }
