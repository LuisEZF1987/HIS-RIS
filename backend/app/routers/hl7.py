from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.dependencies import CurrentUser, DBSession, require_role
from app.models.hl7_message import HL7Message
from app.models.user import UserRole

router = APIRouter(prefix="/hl7", tags=["HL7 Messages"])


@router.get("/messages", summary="List HL7 messages",
            dependencies=[require_role(UserRole.admin)])
async def list_hl7_messages(
    db: DBSession,
    message_type: str = None,
    direction: str = None,
    limit: int = 50,
):
    stmt = select(HL7Message).order_by(HL7Message.created_at.desc()).limit(limit)
    if message_type:
        stmt = stmt.where(HL7Message.message_type == message_type)
    if direction:
        stmt = stmt.where(HL7Message.direction == direction)
    result = await db.execute(stmt)
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "message_type": m.message_type,
            "direction": m.direction,
            "status": m.status,
            "created_at": m.created_at,
        }
        for m in msgs
    ]


@router.get("/messages/{msg_id}/raw", summary="Get raw HL7 message",
            dependencies=[require_role(UserRole.admin)])
async def get_hl7_raw(msg_id: int, db: DBSession):
    result = await db.execute(select(HL7Message).where(HL7Message.id == msg_id))
    msg = result.scalar_one_or_none()
    if not msg:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"HL7 message {msg_id} not found")
    return {"raw": msg.raw_message, "type": msg.message_type}
