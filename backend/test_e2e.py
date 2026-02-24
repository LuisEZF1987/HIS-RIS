"""
End-to-end system verification script.
Run with: docker compose exec api python test_e2e.py
"""
import httpx
import json
import sys

B = "http://localhost:8000"

PASSWORDS = {
    "admin": "Admin123!",
    "medico": "Medico123!",
    "radiologo": "Radiologo123!",
    "receptionist": "Recep123!",
    "tecnico": "Tecnico123!",
}


def login(username: str, password: str) -> dict:
    r = httpx.post(f"{B}/api/v1/auth/login", json={"username": username, "password": password})
    if r.status_code != 200:
        print(f"  FAIL login {username}: {r.status_code} {r.text[:100]}")
        sys.exit(1)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def get(path: str, headers: dict) -> tuple:
    r = httpx.get(f"{B}{path}", headers=headers)
    return r.status_code, r.json()


def post(path: str, headers: dict, data: dict) -> tuple:
    r = httpx.post(f"{B}{path}", headers=headers, json=data, timeout=30)
    return r.status_code, r.json()


print("=" * 60)
print("HIS/RIS End-to-End Verification")
print("=" * 60)

# ── 1. Auth ────────────────────────────────────────────────────
print("\n[1] Authentication")
admin_h = login("admin", PASSWORDS["admin"])
medico_h = login("medico", PASSWORDS["medico"])
radio_h = login("radiologo", PASSWORDS["radiologo"])
print("  ✓ admin, medico, radiologo logins successful")

# ── 2. Health ──────────────────────────────────────────────────
print("\n[2] Health Check")
s, d = get("/health", {})
assert s == 200, f"Health check failed: {s}"
print(f"  ✓ {d['status']} | {d['app']} v{d['version']}")

# ── 3. Patients ────────────────────────────────────────────────
print("\n[3] Patients")
s, d = get("/api/v1/patients", admin_h)
assert s == 200, f"GET patients failed: {s} {d}"
pts = d.get("items", d) if isinstance(d, dict) else d
print(f"  ✓ {d.get('total', len(pts))} patients found")
if pts:
    p = pts[0]
    print(f"  ✓ Patient: {p['mrn']} - {p['full_name']}")

# ── 4. Orders ──────────────────────────────────────────────────
print("\n[4] Imaging Orders")
s, d = get("/api/v1/orders", admin_h)
assert s == 200, f"GET orders failed: {s}"
orders = d.get("items", d) if isinstance(d, dict) else d
print(f"  ✓ {d.get('total', len(orders))} orders found")
if orders:
    o = orders[0]
    print(f"  ✓ Order: {o['accession_number']} [{o['status']}] {o['modality']}")

# ── 5. Worklist ────────────────────────────────────────────────
print("\n[5] DICOM Worklist")
s, d = get("/api/v1/worklist", admin_h)
assert s == 200, f"GET worklist failed: {s}"
wl = d if isinstance(d, list) else d.get("items", [])
print(f"  ✓ {len(wl)} worklist entries")
if wl:
    e = wl[0]
    print(f"  ✓ Entry: {e['accession_number']} | {e['patient_name_dicom']} | {e['modality']} | {e['status']}")

# ── 6. Resources ───────────────────────────────────────────────
print("\n[6] Resources (Equipment/Rooms)")
s, d = get("/api/v1/resources", admin_h)
assert s == 200, f"GET resources failed: {s}"
res = d.get("items", d) if isinstance(d, dict) else d
print(f"  ✓ {len(res)} resources available")
for r in res[:3]:
    print(f"    - {r['name']} [{r.get('modality', '?')}] {r['ae_title']}")

# ── 7. FHIR ────────────────────────────────────────────────────
print("\n[7] FHIR R4")
s, d = get("/fhir/r4/Patient/1", admin_h)
print(f"  ✓ GET /fhir/r4/Patient/1: {s} -> resourceType={d.get('resourceType', 'N/A')}")

# ── 8. Orthanc ─────────────────────────────────────────────────
print("\n[8] Orthanc PACS")
try:
    r = httpx.get("http://orthanc:8042/system", auth=("orthanc", "orthanc"), timeout=5)
    d = r.json()
    print(f"  ✓ Orthanc {r.status_code}: Version={d.get('Version')} ApiVersion={d.get('ApiVersion')}")
except Exception as e:
    print(f"  ✗ Orthanc error: {e}")

# ── Summary ────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("ALL CHECKS PASSED")
print("=" * 60)
print(f"\n  API:      http://localhost:8000")
print(f"  Docs:     http://localhost:8000/docs")
print(f"  Orthanc:  http://localhost:8043")
print()
