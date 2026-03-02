from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import extract, func, select, and_

from app.dependencies import CurrentUser, DBSession
from app.models.order import ImagingOrder, OrderStatus
from app.models.report import RadiologyReport
from app.models.user import User

router = APIRouter(prefix="/statistics", tags=["Statistics"])


@router.get("/orders-by-modality", summary="Monthly order count by modality")
async def orders_by_modality(
    db: DBSession,
    current_user: CurrentUser,
    months: int = Query(6, ge=1, le=24),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    result = await db.execute(
        select(
            func.to_char(ImagingOrder.created_at, "YYYY-MM").label("month"),
            ImagingOrder.modality.label("modality"),
            func.count(ImagingOrder.id).label("count"),
        )
        .where(ImagingOrder.created_at >= cutoff)
        .group_by("month", ImagingOrder.modality)
        .order_by("month")
    )
    rows = result.all()
    return [{"month": r.month, "modality": r.modality.value if hasattr(r.modality, 'value') else r.modality, "count": r.count} for r in rows]


@router.get("/turnaround-time", summary="Average turnaround time (order to completed)")
async def turnaround_time(
    db: DBSession,
    current_user: CurrentUser,
    months: int = Query(6, ge=1, le=24),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    result = await db.execute(
        select(
            func.to_char(ImagingOrder.completed_at, "YYYY-MM").label("month"),
            func.avg(
                extract("epoch", ImagingOrder.completed_at - ImagingOrder.requested_at) / 3600.0
            ).label("avg_hours"),
            func.count(ImagingOrder.id).label("count"),
        )
        .where(
            and_(
                ImagingOrder.completed_at.isnot(None),
                ImagingOrder.completed_at >= cutoff,
                ImagingOrder.status == OrderStatus.completed,
            )
        )
        .group_by("month")
        .order_by("month")
    )
    rows = result.all()
    return [{"month": r.month, "avg_hours": round(float(r.avg_hours), 1) if r.avg_hours else 0, "count": r.count} for r in rows]


@router.get("/radiologist-productivity", summary="Reports signed per radiologist per month")
async def radiologist_productivity(
    db: DBSession,
    current_user: CurrentUser,
    months: int = Query(6, ge=1, le=24),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    result = await db.execute(
        select(
            func.to_char(RadiologyReport.signed_at, "YYYY-MM").label("month"),
            RadiologyReport.signed_by.label("radiologist"),
            func.count(RadiologyReport.id).label("count"),
        )
        .where(
            and_(
                RadiologyReport.signed_at.isnot(None),
                RadiologyReport.signed_at >= cutoff,
            )
        )
        .group_by("month", RadiologyReport.signed_by)
        .order_by("month")
    )
    rows = result.all()
    return [{"month": r.month, "radiologist": r.radiologist, "count": r.count} for r in rows]
