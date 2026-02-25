"""Test FHIR R4 endpoints with real data."""
import httpx

BASE = "http://localhost:8000"

r = httpx.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "Admin123!"})
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

paths = [
    "/fhir/r4/Patient/1",
    "/fhir/r4/Patient",
    "/fhir/r4/ServiceRequest/1",
    "/fhir/r4/ImagingStudy/1",
    "/fhir/r4/DiagnosticReport/2",
]

for path in paths:
    r = httpx.get(f"{BASE}{path}", headers=h)
    print(f"\n{path} -> {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  resourceType: {data.get('resourceType')}")
        print(f"  id:           {data.get('id')}")
        print(f"  status:       {data.get('status')}")
        if data.get("resourceType") == "Bundle":
            print(f"  total:        {data.get('total')}")
    else:
        print(f"  ERROR: {r.text[:300]}")
