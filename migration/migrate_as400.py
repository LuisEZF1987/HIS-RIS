#!/usr/bin/env python3
"""
=============================================================================
  HIS/RIS — Script de Migración desde IBM AS400
  Versión: 1.0
=============================================================================

  USO:
    python migrate_as400.py --patients pacientes.csv
    python migrate_as400.py --patients pacientes.csv --orders ordenes.csv
    python migrate_as400.py --patients pacientes.csv --dry-run

  OPCIONES:
    --patients  <archivo.csv>   CSV de pacientes del AS400
    --orders    <archivo.csv>   CSV de órdenes/estudios del AS400 (opcional)
    --url       <url>           URL del sistema (default: http://localhost:8080)
    --user      <usuario>       Usuario admin (default: admin)
    --password  <clave>         Contraseña admin (default: Admin123!)
    --dry-run                   Simular sin insertar datos
    --encoding  <enc>           Encoding del CSV (default: latin-1)
    --delimiter <char>          Delimitador del CSV (default: ,)
    --help                      Mostrar esta ayuda

  EJEMPLOS:
    # Prueba sin insertar datos
    python migrate_as400.py --patients pacientes.csv --dry-run

    # Migración real
    python migrate_as400.py --patients pacientes.csv --orders ordenes.csv

    # Con URL remota
    python migrate_as400.py --patients pacientes.csv --url http://192.168.100.12:8080

=============================================================================
"""

import csv
import json
import sys
import os
import argparse
import requests
from datetime import datetime, date
from typing import Optional, Dict, List, Tuple

# ── Colores para la consola ────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}[OK]{RESET} {msg}")
def warn(msg):  print(f"  {YELLOW}[!]{RESET}  {msg}")
def err(msg):   print(f"  {RED}[ERR]{RESET} {msg}")
def info(msg):  print(f"  {CYAN}[*]{RESET}  {msg}")

# ── Mapeo de columnas AS400 → HIS/RIS ─────────────────────────────────────────
# Lista de nombres posibles por campo (AS400 varía mucho según instalación)
# Agrega aquí los nombres exactos que vengan en tu CSV

PATIENT_FIELD_CANDIDATES = {
    "first_name": [
        "NOMBRE", "NOM", "NOMBRE1", "PNOMBRE", "PRIMER_NOMBRE",
        "FIRST_NAME", "NOMBRES", "PACIENTE_NOMBRE",
    ],
    "last_name": [
        "APELLIDO", "APE", "APELLIDO1", "PAPELLIDO", "PRIMER_APELLIDO",
        "LAST_NAME", "APELLIDOS", "PACIENTE_APELLIDO",
    ],
    "dni": [
        "CEDULA", "CI", "CED", "DNI", "DOCUMENTO", "NUM_CEDULA",
        "CEDULA_IDENTIDAD", "IDENTIFICACION", "RUT", "DUI",
    ],
    "date_of_birth": [
        "FECHA_NAC", "FNAC", "F_NAC", "FECNAC", "FECHA_NACIMIENTO",
        "DATE_OF_BIRTH", "DOB", "NACIMIENTO", "FEC_NAC",
    ],
    "gender": [
        "SEXO", "SEX", "GENERO", "GENDER", "SEXO_PAC",
    ],
    "blood_type": [
        "GRUPO_SANG", "GS", "GSAN", "GRUPO_SANGUINEO", "BLOOD_TYPE",
        "TIPO_SANGRE", "GSANGUINEO",
    ],
    "allergies": [
        "ALERGIAS", "ALERGIA", "ALLERGIES", "ALERG",
    ],
}

ORDER_FIELD_CANDIDATES = {
    "dni_paciente": [
        "CEDULA", "CI", "CED", "DNI", "DOCUMENTO", "PAC_CEDULA",
    ],
    "modality": [
        "MODALIDAD", "MODALITY", "TIPO_ESTUDIO", "EQUIPO",
        "MOD", "TIPO_EXAMEN",
    ],
    "procedure_description": [
        "DESCRIPCION", "ESTUDIO", "PROCEDIMIENTO", "EXAMEN",
        "PROCEDURE", "DESC_ESTUDIO", "NOMBRE_ESTUDIO",
    ],
    "body_part": [
        "PARTE_CUERPO", "REGION", "ZONA", "BODY_PART",
        "AREA", "ANATOMIA",
    ],
    "priority": [
        "PRIORIDAD", "PRIORITY", "URGENCIA",
    ],
    "clinical_indication": [
        "INDICACION", "MOTIVO", "CLINICAL_INDICATION",
        "INDICACION_CLINICA", "DIAGNOSTICO", "SINTOMAS",
    ],
    "fecha_estudio": [
        "FECHA_ESTUDIO", "FECHA", "FECHA_EXAMEN", "FECH_EST",
        "DATE", "FECHA_ORDEN",
    ],
}

# Mapeo de género AS400 → HIS/RIS
GENDER_MAP = {
    "M": "M", "MASCULINO": "M", "MASC": "M", "H": "M",
    "HOMBRE": "M", "MALE": "M", "1": "M",
    "F": "F", "FEMENINO": "F", "FEM": "F", "MUJER": "F",
    "FEMALE": "F", "2": "F",
    "O": "O", "OTRO": "O", "OTHER": "O",
}

# Mapeo de prioridad
PRIORITY_MAP = {
    "ROUTINE": "ROUTINE", "RUTINA": "ROUTINE", "NORMAL": "ROUTINE",
    "URGENT": "URGENT",   "URGENTE": "URGENT",
    "STAT": "STAT",       "EMERGENCIA": "STAT", "CRITICO": "STAT",
    "ASAP": "ASAP",
}

# Modalidades válidas
VALID_MODALITIES = {
    "CR", "CT", "MR", "US", "NM", "PT", "DX",
    "MG", "XA", "RF", "OT",
    # Aliases comunes del AS400
    "RX": "CR", "RAYOS X": "CR", "RAYOS": "CR", "RADIOGRAFIA": "CR",
    "TAC": "CT", "TOMOGRAFIA": "CT", "SCANNER": "CT",
    "RMN": "MR", "RESONANCIA": "MR", "MRI": "MR",
    "ECO": "US", "ECOGRAFIA": "US", "ULTRASONIDO": "US",
    "MAMOGRAFIA": "MG", "MAMOGRAFIA DIGITAL": "MG",
    "FLUOROSCOPIA": "RF",
}

# ── Funciones auxiliares ───────────────────────────────────────────────────────

def detect_columns(headers: List[str], candidates: Dict) -> Dict[str, str]:
    """Detecta automáticamente qué columna del CSV corresponde a cada campo."""
    mapping = {}
    headers_upper = {h.upper().strip(): h for h in headers}
    for field, names in candidates.items():
        for name in names:
            if name.upper() in headers_upper:
                mapping[field] = headers_upper[name.upper()]
                break
    return mapping

def parse_date(value: str) -> Optional[str]:
    """Parsea fechas en múltiples formatos comunes del AS400."""
    if not value or not value.strip():
        return None
    value = value.strip().replace("/", "-").replace(".", "-")
    formats = [
        "%Y%m%d",       # 19850315
        "%Y-%m-%d",     # 1985-03-15
        "%d-%m-%Y",     # 15-03-1985
        "%m-%d-%Y",     # 03-15-1985
        "%d%m%Y",       # 15031985
        "%Y%m%d%H%M%S", # 19850315000000
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value[:len(fmt.replace("%Y","0000").replace("%m","00").replace("%d","00").replace("%H","00").replace("%M","00").replace("%S","00"))], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Intento genérico
    for fmt in ["%Y%m%d", "%d%m%Y", "%m%d%Y"]:
        try:
            clean = value.replace("-", "").replace("/", "")[:8]
            return datetime.strptime(clean, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    warn(f"No se pudo parsear la fecha: '{value}'")
    return None

def parse_gender(value: str) -> Optional[str]:
    if not value:
        return None
    return GENDER_MAP.get(value.strip().upper())

def parse_modality(value: str) -> str:
    if not value:
        return "OT"
    v = value.strip().upper()
    if v in VALID_MODALITIES:
        return v if isinstance(VALID_MODALITIES[v], bool) else VALID_MODALITIES.get(v, v)
    # Buscar en aliases
    mapped = VALID_MODALITIES.get(v)
    if mapped and isinstance(mapped, str):
        return mapped
    return "OT"

def parse_priority(value: str) -> str:
    if not value:
        return "ROUTINE"
    return PRIORITY_MAP.get(value.strip().upper(), "ROUTINE")

# ── Cliente API ────────────────────────────────────────────────────────────────

class HISRISClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.token = None
        self._login(username, password)

    def _login(self, username: str, password: str):
        info(f"Conectando a {self.base_url}...")
        try:
            r = requests.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"username": username, "password": password},
                timeout=10,
            )
            r.raise_for_status()
            self.token = r.json()["access_token"]
            ok("Autenticado correctamente")
        except requests.exceptions.ConnectionError:
            err(f"No se puede conectar a {self.base_url}")
            err("Verifique que el sistema HIS/RIS esté corriendo")
            sys.exit(1)
        except requests.exceptions.HTTPError:
            err("Credenciales inválidas")
            sys.exit(1)

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def find_patient_by_dni(self, dni: str) -> Optional[dict]:
        r = requests.get(
            f"{self.base_url}/api/v1/patients",
            params={"q": dni, "page_size": 5},
            headers=self._headers(), timeout=10,
        )
        if r.ok:
            for p in r.json().get("items", []):
                if p.get("dni") == dni:
                    return p
        return None

    def create_patient(self, data: dict) -> Tuple[Optional[dict], Optional[str]]:
        r = requests.post(
            f"{self.base_url}/api/v1/patients",
            json=data,
            headers=self._headers(), timeout=10,
        )
        if r.ok:
            return r.json(), None
        return None, r.json().get("detail", str(r.status_code))

    def create_order(self, data: dict) -> Tuple[Optional[dict], Optional[str]]:
        r = requests.post(
            f"{self.base_url}/api/v1/orders",
            json=data,
            headers=self._headers(), timeout=10,
        )
        if r.ok:
            return r.json(), None
        return None, r.json().get("detail", str(r.status_code))

# ── Migración de pacientes ─────────────────────────────────────────────────────

def migrate_patients(
    client: HISRISClient,
    csv_path: str,
    encoding: str,
    delimiter: str,
    dry_run: bool,
) -> Dict[str, int]:
    """Retorna dict con patient_id por DNI (para usar en órdenes)."""

    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"{BOLD}  MIGRACIÓN DE PACIENTES{RESET}")
    print(f"  Archivo: {csv_path}")
    print(f"{'─'*60}{RESET}")

    inserted = 0
    skipped  = 0
    errors   = 0
    dni_to_id: Dict[str, int] = {}

    with open(csv_path, encoding=encoding, newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        headers = reader.fieldnames or []

        # Detectar columnas
        col = detect_columns(headers, PATIENT_FIELD_CANDIDATES)
        print(f"\n  Columnas detectadas:")
        for field, col_name in col.items():
            print(f"    {field:20s} ← {col_name}")
        if not col.get("first_name") and not col.get("last_name"):
            err("No se encontraron columnas de nombre. Verifique el CSV.")
            err(f"Columnas disponibles: {', '.join(headers)}")
            return dni_to_id

        print()
        rows = list(reader)
        total = len(rows)
        info(f"Total de registros: {total}")

        for i, row in enumerate(rows, 1):
            # Construir datos del paciente
            first_name = row.get(col.get("first_name", ""), "").strip().title()
            last_name  = row.get(col.get("last_name",  ""), "").strip().title()

            if not first_name or not last_name:
                warn(f"Fila {i}: nombre/apellido vacío — omitido")
                skipped += 1
                continue

            dni = row.get(col.get("dni", ""), "").strip() if col.get("dni") else None
            dob = parse_date(row.get(col.get("date_of_birth", ""), "") if col.get("date_of_birth") else "")
            gender    = parse_gender(row.get(col.get("gender", ""), "") if col.get("gender") else "")
            blood_type = row.get(col.get("blood_type", ""), "").strip().upper() if col.get("blood_type") else None
            allergies  = row.get(col.get("allergies", ""), "").strip() if col.get("allergies") else None

            patient_data = {
                "first_name": first_name,
                "last_name": last_name,
            }
            if dni:           patient_data["dni"] = dni
            if dob:           patient_data["date_of_birth"] = dob
            if gender:        patient_data["gender"] = gender
            if blood_type and blood_type in ["A+","A-","B+","B-","AB+","AB-","O+","O-"]:
                patient_data["blood_type"] = blood_type
            if allergies:     patient_data["allergies"] = allergies

            progress = f"[{i}/{total}]"

            if dry_run:
                ok(f"{progress} {first_name} {last_name} (CI: {dni or '—'}) — SIMULADO")
                inserted += 1
                continue

            # Verificar si ya existe por DNI
            if dni:
                existing = client.find_patient_by_dni(dni)
                if existing:
                    warn(f"{progress} {first_name} {last_name} (CI: {dni}) — Ya existe (MRN: {existing['mrn']})")
                    dni_to_id[dni] = existing["id"]
                    skipped += 1
                    continue

            # Crear paciente
            result, error = client.create_patient(patient_data)
            if result:
                ok(f"{progress} {first_name} {last_name} (CI: {dni or '—'}) → MRN: {result['mrn']}")
                if dni:
                    dni_to_id[dni] = result["id"]
                inserted += 1
            else:
                err(f"{progress} {first_name} {last_name} — Error: {error}")
                errors += 1

    print(f"\n  {'─'*40}")
    print(f"  Insertados:  {GREEN}{inserted}{RESET}")
    print(f"  Ya existían: {YELLOW}{skipped}{RESET}")
    print(f"  Errores:     {RED}{errors}{RESET}")
    return dni_to_id

# ── Migración de órdenes ───────────────────────────────────────────────────────

def migrate_orders(
    client: HISRISClient,
    csv_path: str,
    encoding: str,
    delimiter: str,
    dry_run: bool,
    dni_to_id: Dict[str, int],
):
    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"{BOLD}  MIGRACIÓN DE ÓRDENES / HISTORIAL{RESET}")
    print(f"  Archivo: {csv_path}")
    print(f"{'─'*60}{RESET}")

    inserted = 0
    skipped  = 0
    errors   = 0

    with open(csv_path, encoding=encoding, newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        headers = reader.fieldnames or []
        col = detect_columns(headers, ORDER_FIELD_CANDIDATES)

        print(f"\n  Columnas detectadas:")
        for field, col_name in col.items():
            print(f"    {field:25s} ← {col_name}")

        if not col.get("dni_paciente"):
            err("No se encontró columna de cédula del paciente.")
            err(f"Columnas disponibles: {', '.join(headers)}")
            return

        print()
        rows = list(reader)
        total = len(rows)
        info(f"Total de registros: {total}")

        for i, row in enumerate(rows, 1):
            dni = row.get(col.get("dni_paciente", ""), "").strip()
            procedure = row.get(col.get("procedure_description", ""), "Estudio importado").strip()
            modality  = parse_modality(row.get(col.get("modality", ""), "") if col.get("modality") else "")
            body_part = row.get(col.get("body_part", ""), "").strip() if col.get("body_part") else None
            priority  = parse_priority(row.get(col.get("priority", ""), "") if col.get("priority") else "")
            indication = row.get(col.get("clinical_indication", ""), "").strip() if col.get("clinical_indication") else None

            progress = f"[{i}/{total}]"

            # Buscar patient_id
            patient_id = dni_to_id.get(dni)
            if not patient_id and not dry_run:
                existing = client.find_patient_by_dni(dni)
                if existing:
                    patient_id = existing["id"]
                    dni_to_id[dni] = patient_id

            if not patient_id:
                warn(f"{progress} CI {dni} — Paciente no encontrado, omitido")
                skipped += 1
                continue

            order_data = {
                "patient_id":            patient_id,
                "modality":              modality,
                "procedure_description": procedure or "Estudio histórico importado",
                "priority":              priority,
            }
            if body_part:  order_data["body_part"] = body_part
            if indication: order_data["clinical_indication"] = indication

            if dry_run:
                ok(f"{progress} CI {dni} — {procedure[:40]} ({modality}) — SIMULADO")
                inserted += 1
                continue

            result, error = client.create_order(order_data)
            if result:
                ok(f"{progress} CI {dni} — {procedure[:40]} → Accesión: {result['accession_number']}")
                inserted += 1
            else:
                err(f"{progress} CI {dni} — Error: {error}")
                errors += 1

    print(f"\n  {'─'*40}")
    print(f"  Insertados:  {GREEN}{inserted}{RESET}")
    print(f"  Omitidos:    {YELLOW}{skipped}{RESET}")
    print(f"  Errores:     {RED}{errors}{RESET}")

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Migración de datos IBM AS400 → HIS/RIS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--patients",  help="CSV de pacientes")
    parser.add_argument("--orders",    help="CSV de órdenes/estudios (opcional)")
    parser.add_argument("--url",       default="http://localhost:8080", help="URL del sistema")
    parser.add_argument("--user",      default="admin",    help="Usuario admin")
    parser.add_argument("--password",  default="Admin123!", help="Contraseña")
    parser.add_argument("--encoding",  default="latin-1",  help="Encoding del CSV (latin-1, utf-8, cp037)")
    parser.add_argument("--delimiter", default=",",        help="Delimitador del CSV (, o ;)")
    parser.add_argument("--dry-run",   action="store_true", help="Simular sin insertar datos")
    args = parser.parse_args()

    if not args.patients:
        parser.print_help()
        sys.exit(0)

    print(f"\n{BOLD}{'='*60}")
    print(f"  HIS/RIS — Migración desde IBM AS400")
    print(f"{'='*60}{RESET}")
    if args.dry_run:
        print(f"\n  {YELLOW}{BOLD}MODO SIMULACIÓN — No se insertarán datos reales{RESET}\n")

    client = HISRISClient(args.url, args.user, args.password)

    dni_to_id = migrate_patients(
        client, args.patients,
        args.encoding, args.delimiter, args.dry_run,
    )

    if args.orders:
        migrate_orders(
            client, args.orders,
            args.encoding, args.delimiter, args.dry_run,
            dni_to_id,
        )

    print(f"\n{BOLD}{'='*60}")
    print(f"  MIGRACIÓN COMPLETADA")
    print(f"{'='*60}{RESET}\n")

if __name__ == "__main__":
    main()
