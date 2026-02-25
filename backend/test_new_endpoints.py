import httpx

BASE = "http://localhost:8000"
token = httpx.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "Admin123!"}).json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

print("=== GET /api/v1/studies ===")
r = httpx.get(f"{BASE}/api/v1/studies", headers=h)
print(f"  status: {r.status_code}")
if r.status_code == 200:
    for s in r.json():
        print(f"  Study id={s['id']} modality={s['modality']} patient={s['patient_name']} report_id={s['report_id']} report_status={s['report_status']}")
else:
    print(f"  ERROR: {r.text[:300]}")

print("\n=== GET /api/v1/reports ===")
r = httpx.get(f"{BASE}/api/v1/reports", headers=h)
print(f"  status: {r.status_code}")
if r.status_code == 200:
    for rp in r.json():
        print(f"  Report id={rp['id']} status={rp['status']} patient={rp['patient_name']} acc={rp['accession_number']}")
else:
    print(f"  ERROR: {r.text[:300]}")
