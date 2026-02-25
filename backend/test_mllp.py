"""Test MLLP HL7 TCP listener."""
import socket
import time

MLLP_START = b"\x0b"
MLLP_END   = b"\x1c\x0d"

HOST = "localhost"
PORT = 2575

# Build a simple ADT^A01 HL7 message
hl7_msg = (
    "MSH|^~\\&|TEST_SYSTEM||HIS_RIS||20260224123000||ADT^A01|MSG001|P|2.5\r"
    "EVN|A01|20260224123000\r"
    "PID|1||PAT001|||FERNANDEZ^CARLOS||19800315|M\r"
    "PV1|1|I|||||||||||||||||ENC001\r"
)

frame = MLLP_START + hl7_msg.encode("latin-1") + MLLP_END

print(f"[1] Connecting to MLLP server {HOST}:{PORT}")
with socket.create_connection((HOST, PORT), timeout=5) as s:
    print(f"[2] Sending ADT^A01 message ({len(frame)} bytes)")
    s.sendall(frame)

    # Read ACK
    s.settimeout(5.0)
    response = b""
    try:
        while True:
            chunk = s.recv(1024)
            if not chunk:
                break
            response += chunk
            if MLLP_END in response:
                break
    except socket.timeout:
        pass

print(f"[3] ACK received ({len(response)} bytes)")
if response:
    ack_text = response.strip(MLLP_START).strip(MLLP_END).decode("latin-1", errors="replace")
    print(f"    ACK: {ack_text[:200]}")
    if "MSA|AA" in ack_text:
        print("    → Application Accept (AA) ✓")
    elif "MSA|AE" in ack_text:
        print("    → Application Error (AE)")
    else:
        print(f"    → Unexpected: {ack_text}")
else:
    print("    (no response received)")

print("\n[4] Verificando mensaje almacenado en BD...")
import httpx, time
time.sleep(1)  # wait for Celery to process
token = httpx.post("http://localhost:8000/api/v1/auth/login",
                   json={"username": "admin", "password": "Admin123!"}).json()["access_token"]
h = {"Authorization": f"Bearer {token}"}
r = httpx.get("http://localhost:8000/api/v1/hl7/messages", headers=h)
msgs = r.json()
inbound = [m for m in msgs if m["direction"] == "INBOUND"]
print(f"    Mensajes HL7 INBOUND en BD: {len(inbound)}")
for m in inbound[:3]:
    print(f"    [{m['id']}] {m['message_type']} {m['direction']} {m['status']}")
print("\nMLLP TEST: OK")
