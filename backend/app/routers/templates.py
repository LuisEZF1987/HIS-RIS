from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.exceptions import NotFoundError
from app.dependencies import CurrentUser, DBSession, require_permission
from app.models.template import ReportTemplate
from app.schemas.template import ReportTemplateCreate, ReportTemplateResponse, ReportTemplateUpdate

router = APIRouter(prefix="/templates", tags=["Report Templates"])


@router.get("", response_model=List[ReportTemplateResponse])
async def list_templates(
    db: DBSession,
    current_user: CurrentUser,
    modality: Optional[str] = Query(None),
    active_only: bool = Query(True),
):
    stmt = select(ReportTemplate).order_by(ReportTemplate.name)
    if modality:
        stmt = stmt.where(ReportTemplate.modality == modality.upper())
    if active_only:
        stmt = stmt.where(ReportTemplate.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ReportTemplateResponse, status_code=201,
             dependencies=[require_permission("admin:access")])
async def create_template(data: ReportTemplateCreate, db: DBSession, current_user: CurrentUser):
    template = ReportTemplate(**data.model_dump())
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=ReportTemplateResponse,
            dependencies=[require_permission("admin:access")])
async def update_template(template_id: int, data: ReportTemplateUpdate, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundError(f"Template {template_id} not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(template, field, value)
    await db.flush()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204,
               dependencies=[require_permission("admin:access")])
async def delete_template(template_id: int, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundError(f"Template {template_id} not found")
    await db.delete(template)
    await db.flush()
