"""Test audit log middleware."""
import httpx, time

BASE = "http://localhost:8000"

# Login como admin
r = httpx.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "Admin123!"})
admin_token = r.json()["access_token"]
ha = {"Authorization": f"Bearer {admin_token}"}

# Login como médico (genera un POST en audit)
r = httpx.post(f"{BASE}/api/v1/auth/login", json={"username": "medico", "password": "Medico123!"})
med_token = r.json()["access_token"]
hm = {"Authorization": f"Bearer {med_token}"}

# Hacer un PUT de orden para generar otro audit entry
r = httpx.put(f"{BASE}/api/v1/orders/1/status", headers=hm,
              json={"status": "IN_PROGRESS"})
print(f"PUT /orders/1/status -> {r.status_code}")

time.sleep(0.5)  # wait for async write

# Consultar audit logs
r = httpx.get(f"{BASE}/api/v1/admin/audit-logs?limit=10", headers=ha)
print(f"\nGET /admin/audit-logs -> {r.status_code}")
if r.status_code == 200:
    logs = r.json()
    print(f"  Total entries: {len(logs)}")
    for log in logs[:5]:
        print(f"  [{log['id']}] user={log['user_id']} action={log['action'][:50]} status={log['status_code']}")
else:
    print(f"  ERROR: {r.text[:200]}")
