from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class OrthancService:
    def __init__(self):
        self.base_url = settings.orthanc_url
        self.auth = (settings.orthanc_username, settings.orthanc_password)
        self.timeout = 30.0

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            auth=self.auth,
            timeout=self.timeout,
        )

    async def get_system_info(self) -> dict[str, Any]:
        async with self._client() as client:
            resp = await client.get("/system")
            resp.raise_for_status()
            return resp.json()

    async def get_study(self, orthanc_id: str) -> dict[str, Any]:
        async with self._client() as client:
            resp = await client.get(f"/studies/{orthanc_id}")
            resp.raise_for_status()
            return resp.json()

    async def find_study_by_uid(self, study_instance_uid: str) -> Optional[str]:
        async with self._client() as client:
            resp = await client.post(
                "/tools/find",
                json={
                    "Level": "Study",
                    "Query": {"StudyInstanceUID": study_instance_uid},
                }
            )
            resp.raise_for_status()
            results = resp.json()
            return results[0] if results else None

    async def get_study_metadata(self, orthanc_id: str) -> dict[str, Any]:
        async with self._client() as client:
            resp = await client.get(f"/studies/{orthanc_id}/statistics")
            resp.raise_for_status()
            return resp.json()

    async def delete_study(self, orthanc_id: str) -> None:
        async with self._client() as client:
            resp = await client.delete(f"/studies/{orthanc_id}")
            resp.raise_for_status()

    async def get_study_preview_url(self, orthanc_id: str, instance_id: Optional[str] = None) -> str:
        return f"{self.base_url}/studies/{orthanc_id}/preview"

    async def is_healthy(self) -> bool:
        try:
            await self.get_system_info()
            return True
        except Exception:
            return False
