from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────────────────
    app_name: str = "Dimed HIS/RIS"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # ── Database ───────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://his_ris_user:his_ris_password@postgres:5432/his_ris"

    # ── Redis / Celery ─────────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    # ── JWT ────────────────────────────────────────────────────────────
    jwt_algorithm: str = "RS256"
    jwt_private_key_path: str = "./keys/private_key.pem"
    jwt_public_key_path: str = "./keys/public_key.pem"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # Fallback for HS256 (dev only)
    secret_key: str = "dev-secret-key-change-in-production"

    # ── Orthanc ────────────────────────────────────────────────────────
    orthanc_url: str = "http://orthanc:8042"
    orthanc_username: str = "orthanc"
    orthanc_password: str = "orthanc"
    orthanc_dicom_port: int = 4242
    orthanc_ae_title: str = "ORTHANC"

    # ── DICOM / Worklist ───────────────────────────────────────────────
    worklist_dir: str = "/var/lib/orthanc/worklists"
    institution_name: str = "Hospital General"
    institution_ae_title: str = "HIS_RIS_SCP"

    # ── HL7 ────────────────────────────────────────────────────────────
    hl7_listener_host: str = "0.0.0.0"
    hl7_listener_port: int = 2575
    hl7_sending_facility: str = "HIS_RIS"
    hl7_receiving_facility: str = "PACS"

    # ── CORS ───────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:3000,http://localhost:80"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    def get_private_key(self) -> Optional[str]:
        path = Path(self.jwt_private_key_path)
        if path.exists():
            return path.read_text()
        # Try /app/keys/ path (Docker)
        alt = Path("/app/keys/private_key.pem")
        if alt.exists():
            return alt.read_text()
        return None

    def get_public_key(self) -> Optional[str]:
        path = Path(self.jwt_public_key_path)
        if path.exists():
            return path.read_text()
        alt = Path("/app/keys/public_key.pem")
        if alt.exists():
            return alt.read_text()
        return None


@lru_cache()
def get_settings() -> Settings:
    return Settings()
