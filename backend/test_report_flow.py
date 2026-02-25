"""
Simula el flujo completo de informe radiológico:
  1. Orthanc webhook → crea ImagingStudy vinculado a orden
  2. Radiólogo crea informe borrador
  3. Radiólogo edita hallazgos e impresión
  4. Radiólogo firma digitalmente
  5. Descarga PDF
"""
import asyncio
import httpx
import app.db.base  # noqa: F401 — registra todos los modelos ORM
from app.db.session import AsyncSessionLocal
from app.models.study import ImagingStudy, StudyStatus
from sqlalchemy import text

BASE = "http://localhost:8000"


async def create_test_study(order_id: int) -> int:
    """Simula lo que hace el webhook de Orthanc al recibir un estudio DICOM."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        # Reutilizar si ya existe para order_id
        result = await db.execute(select(ImagingStudy).where(ImagingStudy.order_id == order_id))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"   (Ya existía) StudyInstanceUID: {existing.study_instance_uid}")
            print(f"   Series: {existing.series_count}  Instances: {existing.instances_count}")
            return existing.id
        study = ImagingStudy(
            order_id=order_id,
            study_instance_uid=f"1.2.840.10008.5.1.4.1.1.{order_id}.20260224",
            series_count=3,
            instances_count=48,
            status=StudyStatus.available,
        )
        db.add(study)
        await db.commit()
        await db.refresh(study)
        print(f"   StudyInstanceUID: {study.study_instance_uid}")
        print(f"   Series: {study.series_count}  Instances: {study.instances_count}")
        return study.id


async def main():
    # ── 1. Simular webhook Orthanc → ImagingStudy
    print("[1] Simular webhook Orthanc (crear ImagingStudy para orden CT id=1)")
    study_id = await create_test_study(order_id=1)
    print(f"    Study id={study_id} creado -> OK")

    # ── 2. Login radiólogo
    r = httpx.post(f"{BASE}/api/v1/auth/login",
                   json={"username": "radiologo", "password": "Radiologo123!"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    print(f"\n[2] Login radiologo -> OK")

    # ── 3. Crear borrador de informe (ReportEditorPage → POST /reports)
    r = httpx.post(f"{BASE}/api/v1/reports", headers=h, json={
        "study_id": study_id,
        "technique": "RM columna lumbar con protocolo degenerativo. Secuencias T1, T2 y STIR en planos sagital y axial.",
        "findings": (
            "A nivel L4-L5 se observa protrusión discal posterocentral con leve impronta sobre el saco tecal. "
            "No se evidencia compromiso radicular significativo. Resto de discos en altura y señal conservadas. "
            "Médula espinal sin alteraciones."
        ),
        "impression": (
            "Protrusión discal L4-L5 sin compromiso radicular significativo. "
            "Hallazgos compatibles con discopatía degenerativa incipiente."
        ),
        "recommendation": "Tratamiento conservador. Control en 6 meses si persiste la sintomatología.",
        "clinical_info": "Lumbalgia crónica con irradiación a miembro inferior derecho.",
    }, timeout=15)
    print(f"\n[3] POST /api/v1/reports -> {r.status_code}")
    assert r.status_code == 201, f"FAIL: {r.text}"
    report = r.json()
    rid = report["id"]
    print(f"    Informe id={rid}  status={report['status']}")
    print(f"    Técnica:   {report['technique'][:60]}...")
    print(f"    Hallazgos: {report['findings'][:60]}...")
    print(f"    Impresión: {report['impression'][:60]}...")

    # ── 4. Actualizar borrador (PUT /reports/{id})
    r = httpx.put(f"{BASE}/api/v1/reports/{rid}", headers=h, json={
        "recommendation": "Tratamiento conservador. Fisioterapia. Control en 3 meses.",
    }, timeout=15)
    print(f"\n[4] PUT /api/v1/reports/{rid} -> {r.status_code}")
    assert r.status_code == 200
    print(f"    Recomendación actualizada -> OK")

    # ── 5. Firmar digitalmente (POST /reports/{id}/sign)
    r = httpx.post(f"{BASE}/api/v1/reports/{rid}/sign", headers=h,
                   json={"password": "Radiologo123!"}, timeout=15)
    print(f"\n[5] POST /api/v1/reports/{rid}/sign -> {r.status_code}")
    assert r.status_code == 200, f"FAIL: {r.text}"
    signed = r.json()
    print(f"    Status:     {signed['status']}")
    print(f"    Firmado por:{signed['signed_by']}")
    print(f"    Fecha:      {signed['signed_at']}")
    print(f"    Hash SHA256:{signed['signature_hash'][:32]}...")

    # ── 6. Descargar PDF
    r = httpx.get(f"{BASE}/api/v1/reports/{rid}/pdf", headers=h, timeout=15)
    print(f"\n[6] GET /api/v1/reports/{rid}/pdf -> {r.status_code}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    print(f"    Content-Type: {r.headers['content-type']}")
    print(f"    Tamaño PDF:   {len(r.content)} bytes")

    # ── 7. Verificar HL7 ORU^R01 generado al firmar
    ra = httpx.post(f"{BASE}/api/v1/auth/login",
                    json={"username": "admin", "password": "Admin123!"})
    ha = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    r = httpx.get(f"{BASE}/api/v1/hl7/messages", headers=ha)
    msgs = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    oru = [m for m in msgs if m["message_type"] == "ORU^R01"]
    print(f"\n[7] HL7 ORU^R01 generado al firmar -> {len(oru)} mensaje(s)")
    for m in oru:
        print(f"    [{m['id']}] {m['message_type']} {m['direction']} {m['status']}")

    print("\n" + "=" * 55)
    print("FLUJO COMPLETO DE INFORME: OK")
    print("  Borrador creado  -> Editado -> Firmado -> PDF generado")
    print(f"  HL7 ORU^R01 enviado al firmar: {'SI' if oru else 'NO'}")
    print("=" * 55)


asyncio.run(main())
