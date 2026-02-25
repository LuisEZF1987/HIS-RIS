"""
MLLP (Minimal Lower Layer Protocol) TCP server for HL7 v2.x.

Frame format:
  Start: \\x0B (VT)
  Data:  HL7 message (\\r delimited segments)
  End:   \\x1C\\x0D (FS + CR)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# MLLP frame bytes
MLLP_START = b"\x0b"
MLLP_END   = b"\x1c\x0d"


def _build_ack(msg_id: str, ack_code: str = "AA") -> bytes:
    """Build MLLP-framed HL7 ACK message."""
    now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    ack = (
        f"MSH|^~\\&|HIS_RIS||SENDER||{now}||ACK|ACK{now}|P|2.5\r"
        f"MSA|{ack_code}|{msg_id}\r"
    )
    return MLLP_START + ack.encode("latin-1") + MLLP_END


def _extract_msg_id(raw: str) -> str:
    """Extract MSH.10 (message control ID) from raw HL7 string."""
    for seg in raw.split("\r"):
        if seg.startswith("MSH"):
            fields = seg.split("|")
            return fields[9] if len(fields) > 9 else "UNKNOWN"
    return "UNKNOWN"


async def _handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    session_factory,
):
    peer = writer.get_extra_info("peername")
    logger.info(f"MLLP: new connection from {peer}")
    buf = b""

    try:
        while True:
            chunk = await asyncio.wait_for(reader.read(4096), timeout=60.0)
            if not chunk:
                break
            buf += chunk

            # Process all complete MLLP frames in buffer
            while MLLP_START in buf and MLLP_END in buf:
                start = buf.index(MLLP_START)
                end   = buf.index(MLLP_END)
                if start > end:
                    buf = buf[start:]
                    break

                frame = buf[start + 1 : end]  # strip VT and FS+CR
                buf   = buf[end + 2:]          # advance past FS+CR

                raw = frame.decode("latin-1", errors="replace")
                msg_id = _extract_msg_id(raw)

                # Store via Celery task (fire-and-forget)
                try:
                    from app.workers.hl7_tasks import process_inbound_hl7
                    process_inbound_hl7.delay(raw)
                    ack_code = "AA"
                    logger.info(f"MLLP: queued inbound HL7 msg_id={msg_id}")
                except Exception as e:
                    logger.error(f"MLLP: failed to queue HL7 task: {e}")
                    ack_code = "AE"

                writer.write(_build_ack(msg_id, ack_code))
                await writer.drain()

    except asyncio.TimeoutError:
        logger.debug(f"MLLP: connection timeout from {peer}")
    except Exception as e:
        logger.error(f"MLLP: error handling client {peer}: {e}")
    finally:
        writer.close()
        logger.info(f"MLLP: closed connection from {peer}")


async def start_mllp_server(host: str = "0.0.0.0", port: int = 2575):
    """Start the MLLP TCP server. Call from FastAPI lifespan."""
    server = await asyncio.start_server(
        lambda r, w: _handle_client(r, w, None),
        host=host,
        port=port,
    )
    addrs = ", ".join(str(s.getsockname()) for s in server.sockets)
    logger.info(f"MLLP HL7 TCP listener started on {addrs}")
    return server
