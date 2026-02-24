from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, enum_values


class HL7Direction(str, enum.Enum):
    inbound = "INBOUND"
    outbound = "OUTBOUND"


class HL7MessageType(str, enum.Enum):
    adt_a01 = "ADT^A01"   # Admit/Visit Notification
    adt_a03 = "ADT^A03"   # Discharge/End Visit
    adt_a08 = "ADT^A08"   # Update Patient Information
    orm_o01 = "ORM^O01"   # Order Message
    oru_r01 = "ORU^R01"   # Observation Result
    ack = "ACK"            # General Acknowledgment


class HL7Status(str, enum.Enum):
    pending = "PENDING"
    sent = "SENT"
    received = "RECEIVED"
    acked = "ACKED"
    error = "ERROR"
    rejected = "REJECTED"


class HL7Message(Base):
    __tablename__ = "hl7_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    direction: Mapped[HL7Direction] = mapped_column(Enum(HL7Direction, values_callable=enum_values), nullable=False, index=True)
    sending_facility: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    receiving_facility: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    message_control_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    raw_message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[HL7Status] = mapped_column(Enum(HL7Status, values_callable=enum_values), nullable=False, default=HL7Status.pending, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    patient_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    order_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<HL7Message id={self.id} type={self.message_type} direction={self.direction}>"
