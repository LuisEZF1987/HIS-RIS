from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: int,
        type: str,
        title: str,
        body: Optional[str] = None,
        link: Optional[str] = None,
    ) -> Notification:
        n = Notification(user_id=user_id, type=type, title=title, body=body, link=link)
        self.db.add(n)
        await self.db.flush()
        return n

    async def notify_role(
        self,
        role: UserRole,
        type: str,
        title: str,
        body: Optional[str] = None,
        link: Optional[str] = None,
    ) -> List[Notification]:
        result = await self.db.execute(
            select(User.id).where(User.role == role, User.is_active == True)
        )
        user_ids = result.scalars().all()
        notifications = []
        for uid in user_ids:
            n = Notification(user_id=uid, type=type, title=title, body=body, link=link)
            self.db.add(n)
            notifications.append(n)
        await self.db.flush()
        return notifications

    async def get_for_user(self, user_id: int, limit: int = 20) -> List[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def unread_count(self, user_id: int) -> int:
        result = await self.db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result.scalar() or 0

    async def mark_read(self, notification_id: int, user_id: int) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )

    async def mark_all_read(self, user_id: int) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
