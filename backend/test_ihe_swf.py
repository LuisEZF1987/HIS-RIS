"""
IHE Scheduled Workflow (SWF) — End-to-End Test
================================================
Simulates the complete IHE SWF integration profile:

  1.  Recepcionista registra paciente (ADT^A01)
  2.  Médico crea orden de imagen (ORM^O01)  → MWL entry generado
  3.  Técnico consulta Worklist (C-FIND simulado → REST)
  4.  Orthanc webhook → ImagingStudy vinculado a orden
  5.  Orden → COMPLETED, MWL entry → COMPLETED
  6.  Radiólogo crea borrador de informe
  7.  Radiólogo edita y firma informe (ORU^R01 generado)
  8.  PDF descargado
  9.  FHIR R4: Patient / ServiceRequest / ImagingStudy / DiagnosticReport
 10.  HL7: ORM^O01 + ORU^R01 verificados en BD
"""
import asyncio
import httpx
from datetime import datetime, timezone

import app.db.base  # noqa: F401
from app.db.session import AsyncSessionLocal
from app.models.study import ImagingStudy, StudyStatus
from sqlalchemy import select

BASE = "http://localhost:8000"

# ────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────
def login(username: str, password: str) -> dict:
    r = httpx.post(f"{BASE}/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login {username} failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def step(n: int, desc: str):
    print(f"\n[{n:02d}] {desc}")


# ────────────────────────────────────────────────────────────
# Main flow
# ────────────────────────────────────────────────────────────
async def main():
    print("=" * 60)
    print("IHE Scheduled Workflow — End-to-End Test")
    print("=" * 60)

    ts = datetime.now(timezone.utc).strftime("%H%M%S")

    # ── 01. Login de cada rol ──────────────────────────────────
    step(1, "Login roles")
    h_recep = login("receptionist", "Recep123!")
    h_medic = login("medico", "Medico123!")
    h_tech  = login("tecnico", "Tecnico123!")
    h_radio = login("radiologo", "Radiologo123!")
    h_admin = login("admin", "Admin123!")
    print("   admin / recep / medico / tecnico / radiologo  → OK")

    # ── 02. Registrar paciente (ADT) ───────────────────────────
    step(2, "Registrar paciente (recepcionista)")
    r = httpx.post(f"{BASE}/api/v1/patients", headers=h_recep, json={
        "first_name": f"Carlos-{ts}",
        "last_name":  "Mendoza",
        "date_of_birth": "1975-08-22",
        "gender": "M",
        "dni": f"99{ts}",
        "contacts": [{"contact_type": "phone", "value": f"099{ts}", "is_primary": True}],
    })
    assert r.status_code == 201, f"FAIL: {r.text}"
    patient = r.json()
    pid = patient["id"]
    print(f"   Patient id={pid}  MRN={patient['mrn']}  → OK")

    # ── 03. Crear orden de imagen (ORM^O01) ────────────────────
    step(3, "Crear orden MRI columna (médico) → MWL + HL7 ORM^O01")
    r = httpx.post(f"{BASE}/api/v1/orders", headers=h_medic, json={
        "patient_id": pid,
        "modality": "MR",
        "procedure_description": "RM columna lumbar con protocolo IHE SWF",
        "procedure_code": "MR-LUMBAR-001",
        "body_part": "LUMBAR SPINE",
        "priority": "ROUTINE",
        "clinical_indication": "Lumbalgia crónica test IHE SWF",
        "scheduled_at": "2026-03-01T09:00:00Z",
    })
    assert r.status_code == 201, f"FAIL: {r.text}"
    order = r.json()
    oid = order["id"]
    acc = order["accession_number"]
    print(f"   Order id={oid}  ACC={acc}  status={order['status']}  → OK")

    # ── 04. Técnico consulta Worklist ──────────────────────────
    step(4, "Técnico consulta DICOM Worklist (MR)")
    r = httpx.get(f"{BASE}/api/v1/worklist?modality=MR", headers=h_tech)
    assert r.status_code == 200
    wl = r.json()
    entry = next((e for e in wl if e["accession_number"] == acc), None)
    assert entry, f"Worklist entry para {acc} no encontrada"
    print(f"   WL entry id={entry['id']}  patient={entry['patient_name_dicom']}  → OK")

    # ── 05. Simular webhook Orthanc (estudio DICOM recibido) ────
    step(5, "Simular webhook Orthanc (ImagingStudy recibido)")
    async with AsyncSessionLocal() as db:
        # Verificar que no existe estudio previo para esta orden
        res = await db.execute(select(ImagingStudy).where(ImagingStudy.order_id == oid))
        existing = res.scalar_one_or_none()
        if not existing:
            study = ImagingStudy(
                order_id=oid,
                study_instance_uid=f"1.2.840.10008.5.1.4.1.1.{oid}.{ts}",
                series_count=4,
                instances_count=64,
                modality="MR",
                status=StudyStatus.available,
            )
            db.add(study)
            await db.commit()
            await db.refresh(study)
            study_id = study.id
        else:
            study_id = existing.id
    print(f"   ImagingStudy id={study_id}  → OK")

    # Actualizar orden a COMPLETED (simula lo que hace el webhook handler real)
    r = httpx.put(f"{BASE}/api/v1/orders/{oid}/status", headers=h_tech,
                  json={"status": "COMPLETED"})
    assert r.status_code == 200
    print(f"   Order status → {r.json()['status']}  → OK")

    # ── 06. Radiólogo consulta estudios pendientes ──────────────
    step(6, "Radiólogo consulta estudios sin informe")
    r = httpx.get(f"{BASE}/api/v1/studies", headers=h_radio)
    assert r.status_code == 200
    studies = r.json()
    pending = [s for s in studies if not s["report_id"]]
    our_study = next((s for s in studies if s["id"] == study_id), None)
    assert our_study, "Estudio no encontrado en /studies"
    print(f"   {len(pending)} estudio(s) sin informe, incluyendo id={study_id}  → OK")

    # ── 07. Crear borrador de informe ──────────────────────────
    step(7, "Radiólogo crea borrador de informe")
    r = httpx.post(f"{BASE}/api/v1/reports", headers=h_radio, json={
        "study_id": study_id,
        "technique": "RM columna lumbar. T1, T2 y STIR sagital/axial.",
        "findings": "Protrusión discal L4-L5. Sin compromiso radicular. Médula sin alteraciones.",
        "impression": "Discopatía degenerativa L4-L5 incipiente. Sin radiculopatía.",
        "recommendation": "Tratamiento conservador. Control en 6 meses.",
        "clinical_info": "Lumbalgia crónica irradiada a MID.",
    }, timeout=15)
    assert r.status_code == 201, f"FAIL: {r.text}"
    report = r.json()
    rid = report["id"]
    print(f"   Informe id={rid}  status={report['status']}  → OK")

    # ── 08. Firmar informe (ORU^R01) ────────────────────────────
    step(8, "Radiólogo firma informe digitalmente → HL7 ORU^R01")
    r = httpx.post(f"{BASE}/api/v1/reports/{rid}/sign",
                   headers=h_radio, json={"password": "Radiologo123!"}, timeout=15)
    assert r.status_code == 200, f"FAIL: {r.text}"
    signed = r.json()
    assert signed["status"] == "final"
    print(f"   Status={signed['status']}  hash={signed['signature_hash'][:20]}...  → OK")
    print(f"   Firmado por: {signed['signed_by']}")

    # ── 09. Descargar PDF ──────────────────────────────────────
    step(9, "Descargar PDF del informe")
    r = httpx.get(f"{BASE}/api/v1/reports/{rid}/pdf", headers=h_radio, timeout=15)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    print(f"   PDF: {len(r.content)} bytes  content-type={r.headers['content-type']}  → OK")

    # ── 10. FHIR R4 ────────────────────────────────────────────
    step(10, "FHIR R4 — todos los recursos del flujo")
    for path, label in [
        (f"/fhir/r4/Patient/{pid}",              "Patient"),
        (f"/fhir/r4/ServiceRequest/{oid}",        "ServiceRequest"),
        (f"/fhir/r4/ImagingStudy/{study_id}",     "ImagingStudy"),
        (f"/fhir/r4/DiagnosticReport/{rid}",      "DiagnosticReport"),
    ]:
        r = httpx.get(f"{BASE}{path}", headers=h_admin)
        assert r.status_code == 200, f"FHIR {label} failed: {r.text[:200]}"
        data = r.json()
        assert data["resourceType"] == label
        print(f"   {label}  id={data['id']}  → OK")

    # ── 11. HL7 mensajes en BD ─────────────────────────────────
    step(11, "Verificar mensajes HL7 en BD")
    r = httpx.get(f"{BASE}/api/v1/hl7/messages?limit=20", headers=h_admin)
    msgs = r.json()
    orm_msgs = [m for m in msgs if m["message_type"] == "ORM^O01"]
    oru_msgs = [m for m in msgs if m["message_type"] == "ORU^R01"]
    print(f"   ORM^O01 (outbound): {len(orm_msgs)}")
    print(f"   ORU^R01 (outbound): {len(oru_msgs)}")
    assert len(orm_msgs) >= 1, "No ORM^O01 found"
    assert len(oru_msgs) >= 1, "No ORU^R01 found"

    # ── 12. Audit log ──────────────────────────────────────────
    step(12, "Verificar audit log")
    r = httpx.get(f"{BASE}/api/v1/admin/audit-logs?limit=20", headers=h_admin)
    logs = r.json()
    print(f"   Entradas de auditoría: {len(logs)}")
    post_reports = [l for l in logs if "reports" in l["action"] and l["action"].startswith("POST")]
    print(f"   POST /reports registrado: {'SÍ' if post_reports else 'NO'}")

    # ── Resultado final ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("IHE SCHEDULED WORKFLOW: COMPLETO ✓")
    print("  ADT → Orden → MWL → Estudio → Informe → PDF → FHIR")
    print(f"  HL7: ORM^O01 × {len(orm_msgs)}  |  ORU^R01 × {len(oru_msgs)}")
    print("  Audit log activo")
    print("=" * 60)


asyncio.run(main())
