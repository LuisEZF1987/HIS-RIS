from __future__ import annotations

from typing import List

from fastapi import APIRouter

from app.dependencies import CurrentUser, DBSession
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", summary="List notifications for current user")
async def list_notifications(db: DBSession, current_user: CurrentUser):
    svc = NotificationService(db)
    notifications = await svc.get_for_user(current_user.id)
    return [
        {
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@router.get("/unread-count", summary="Unread notification count")
async def unread_count(db: DBSession, current_user: CurrentUser):
    svc = NotificationService(db)
    count = await svc.unread_count(current_user.id)
    return {"count": count}


@router.put("/{notification_id}/read", summary="Mark notification as read")
async def mark_read(notification_id: int, db: DBSession, current_user: CurrentUser):
    svc = NotificationService(db)
    await svc.mark_read(notification_id, current_user.id)
    return {"message": "ok"}


@router.put("/read-all", summary="Mark all notifications as read")
async def mark_all_read(db: DBSession, current_user: CurrentUser):
    svc = NotificationService(db)
    await svc.mark_all_read(current_user.id)
    return {"message": "ok"}
