from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func, select, and_

from app.dependencies import CurrentUser, DBSession
from app.models.order import ImagingOrder, OrderStatus
from app.models.report import RadiologyReport, ReportStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", summary="Dashboard statistics")
async def dashboard_stats(db: DBSession, current_user: CurrentUser):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Unsigned reports (draft or preliminary)
    unsigned_result = await db.execute(
        select(func.count(RadiologyReport.id)).where(
            RadiologyReport.status.in_([ReportStatus.draft, ReportStatus.preliminary])
        )
    )
    unsigned_count = unsigned_result.scalar() or 0

    # Orders per day for the last 7 days
    seven_days_ago = today - timedelta(days=6)
    orders_by_day_result = await db.execute(
        select(
            func.date(ImagingOrder.created_at).label("day"),
            func.count(ImagingOrder.id).label("count"),
        )
        .where(ImagingOrder.created_at >= seven_days_ago)
        .group_by(func.date(ImagingOrder.created_at))
        .order_by(func.date(ImagingOrder.created_at))
    )
    orders_by_day = [{"date": str(row.day), "count": row.count} for row in orders_by_day_result]

    # This week vs last week order counts for trend
    week_start = today - timedelta(days=today.weekday())
    last_week_start = week_start - timedelta(days=7)

    this_week_result = await db.execute(
        select(func.count(ImagingOrder.id)).where(ImagingOrder.created_at >= week_start)
    )
    this_week_count = this_week_result.scalar() or 0

    last_week_result = await db.execute(
        select(func.count(ImagingOrder.id)).where(
            and_(
                ImagingOrder.created_at >= last_week_start,
                ImagingOrder.created_at < week_start,
            )
        )
    )
    last_week_count = last_week_result.scalar() or 0

    # Today's completed orders
    today_completed_result = await db.execute(
        select(func.count(ImagingOrder.id)).where(
            and_(
                ImagingOrder.completed_at >= today,
                ImagingOrder.status == OrderStatus.completed,
            )
        )
    )
    today_completed = today_completed_result.scalar() or 0

    return {
        "unsigned_reports": unsigned_count,
        "orders_by_day": orders_by_day,
        "this_week_orders": this_week_count,
        "last_week_orders": last_week_count,
        "today_completed": today_completed,
    }
