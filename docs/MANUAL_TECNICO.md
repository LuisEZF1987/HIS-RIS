# Manual Técnico — Dimed HIS/RIS

**Versión:** 1.0.0 | **Stack:** FastAPI · React · PostgreSQL · Docker · Orthanc

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Requisitos del Sistema](#2-requisitos-del-sistema)
3. [Instalación desde Cero](#3-instalación-desde-cero)
4. [Ejecución del Sistema](#4-ejecución-del-sistema)
5. [Configuración (.env)](#5-configuración-env)
6. [Estructura de Directorios](#6-estructura-de-directorios)
7. [Base de Datos](#7-base-de-datos)
8. [Servicios y Puertos](#8-servicios-y-puertos)
9. [Variables de Entorno](#9-variables-de-entorno)
10. [API REST — Referencia](#10-api-rest--referencia)
11. [Integración DICOM / Orthanc](#11-integración-dicom--orthanc)
12. [HL7 v2.x — MLLP Listener](#12-hl7-v2x--mllp-listener)
13. [FHIR R4](#13-fhir-r4)
14. [Seguridad](#14-seguridad)
15. [Backup y Restauración](#15-backup-y-restauración)
16. [Monitoreo y Logs](#16-monitoreo-y-logs)
17. [Migración de Datos desde AS/400 (IBM)](#17-migración-de-datos-desde-as400-ibm)
18. [Troubleshooting](#18-troubleshooting)
19. [Comandos Make de Referencia](#19-comandos-make-de-referencia)

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        NGINX :8080                          │
│              Reverse Proxy + Rate Limiting                  │
└──────────┬──────────────────────────────┬───────────────────┘
           │ /api/  /fhir/                │ /
           ▼                              ▼
┌──────────────────────┐      ┌───────────────────────┐
│  FastAPI API :8000   │      │  React Frontend :3000 │
│  - REST API v1       │      │  - Vite + TypeScript  │
│  - FHIR R4           │      │  - TailwindCSS        │
│  - HL7 MLLP :2575    │      │  - React Query        │
└──────────┬───────────┘      └───────────────────────┘
           │
     ┌─────┴──────┬──────────────┐
     ▼            ▼              ▼
┌─────────┐ ┌─────────┐  ┌────────────┐
│Postgres │ │  Redis  │  │  Orthanc   │
│  :5432  │ │  :6379  │  │ :8043/:4243│
│  (DB)   │ │ (cache/ │  │  (PACS)    │
└─────────┘ │  queue) │  └────────────┘
            └────┬────┘
                 │
    ┌────────────┴──────────────┐
    ▼                           ▼
┌──────────────┐      ┌──────────────────┐
│Celery Worker │      │  Celery Beat     │
│ (async tasks)│      │  (scheduled jobs)│
└──────────────┘      └──────────────────┘
```

---

## 2. Requisitos del Sistema

### Hardware mínimo (producción)
| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Disco | 100 GB SSD | 500 GB SSD |
| Red | 100 Mbps | 1 Gbps |

### Software
| Software | Versión mínima | Notas |
|----------|---------------|-------|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose | 2.x | incluido en Docker Desktop |
| Git | cualquiera | para clonar el repo |
| OpenSSL | 1.1+ | para generar claves JWT |
| `make` | cualquiera | opcional pero recomendado |

### Sistema Operativo soportado
- Linux (Ubuntu 22.04+ / Debian 12+) — **recomendado para producción**
- Windows 11 con WSL2 o Docker Desktop
- macOS 13+

---

## 3. Instalación desde Cero

### Paso 1 — Clonar el repositorio
```bash
git clone https://github.com/LuisEZF1987/HIS-RIS.git
cd HIS-RIS
```

### Paso 2 — Crear archivo de configuración
```bash
cp .env.example .env
# Editar .env con los valores de producción
nano .env
```

### Paso 3 — Generar claves JWT (RS256)
```bash
mkdir -p infrastructure/keys
openssl genrsa -out infrastructure/keys/private_key.pem 2048
openssl rsa -in infrastructure/keys/private_key.pem -pubout -out infrastructure/keys/public_key.pem
chmod 600 infrastructure/keys/private_key.pem

# O usando el script incluido:
bash infrastructure/scripts/generate-keys.sh
```

### Paso 4 — Construir imágenes Docker
```bash
docker compose build
# Con make:
make build
```

### Paso 5 — Iniciar todos los servicios
```bash
docker compose up -d
# Con make:
make up
```

### Paso 6 — Ejecutar migraciones de base de datos
```bash
docker compose exec api alembic upgrade head
# Con make:
make migrate
```

### Paso 7 — Cargar datos iniciales
```bash
docker compose exec api python -m app.db.seed
# Con make:
make seed
```

### Paso 8 — Verificar que todo funciona
```bash
# Test de salud
curl http://localhost:8000/health

# Test e2e completo
docker compose exec api python test_e2e.py

# Test IHE SWF completo
docker compose exec api python test_ihe_swf.py
```

---

## 4. Ejecución del Sistema

### Modo Desarrollo (hot-reload, logs detallados)
```bash
docker compose up -d
# El archivo docker-compose.override.yml se aplica automáticamente en desarrollo
```

### Modo Producción (imágenes optimizadas, sin hot-reload)
```bash
docker compose -f docker-compose.yml up -d
# Con make:
make up-prod
```

### Detener todos los servicios
```bash
docker compose down
make down
```

### Reiniciar un servicio específico
```bash
docker compose restart api
docker compose restart celery-worker
```

### Ver estado de los servicios
```bash
docker compose ps
```

Salida esperada (todos healthy):
```
NAME                   STATUS          PORTS
his_ris_nginx          Up (healthy)    0.0.0.0:8080->80/tcp
his_ris_api            Up (healthy)    0.0.0.0:8000->8000/tcp, 0.0.0.0:2575->2575/tcp
his_ris_frontend       Up
his_ris_celery         Up
his_ris_celery_beat    Up
his_ris_postgres       Up (healthy)    0.0.0.0:5432->5432/tcp
his_ris_redis          Up (healthy)    0.0.0.0:6379->6379/tcp
his_ris_orthanc        Up (healthy)    0.0.0.0:8043->8042/tcp, 0.0.0.0:4243->4242/tcp
```

---

## 5. Configuración (.env)

Cree el archivo `.env` en la raíz del proyecto:

```ini
# ── Base de Datos ─────────────────────────────────────────────
POSTGRES_DB=his_ris
POSTGRES_USER=his_ris_user
POSTGRES_PASSWORD=CAMBIE_ESTO_EN_PRODUCCION

DATABASE_URL=postgresql+asyncpg://his_ris_user:CAMBIE_ESTO_EN_PRODUCCION@postgres:5432/his_ris

# ── Redis / Celery ────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# ── JWT ───────────────────────────────────────────────────────
JWT_ALGORITHM=RS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Orthanc PACS ─────────────────────────────────────────────
ORTHANC_URL=http://orthanc:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=CAMBIE_CLAVE_ORTHANC

# ── Configuración Hospital ────────────────────────────────────
INSTITUTION_NAME=Hospital General San José
ENVIRONMENT=production

# ── CORS (orígenes permitidos, separados por coma) ────────────
ALLOWED_ORIGINS=http://mi-servidor.local:8080,https://his.hospital.com
```

---

## 6. Estructura de Directorios

```
HIS-RIS/
├── .env / .env.example
├── docker-compose.yml          # Producción
├── docker-compose.override.yml # Desarrollo (hot-reload)
├── Makefile                    # Comandos de utilidad
│
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + lifespan
│   │   ├── config.py           # Settings (Pydantic BaseSettings)
│   │   ├── dependencies.py     # Inyección de dependencias (DB, JWT, RBAC)
│   │   ├── core/
│   │   │   ├── security.py     # JWT RS256/HS256, hashing bcrypt
│   │   │   ├── middleware.py   # AuditLog, RequestID, Timing, Security headers
│   │   │   ├── mllp_server.py  # Listener TCP HL7 MLLP puerto 2575
│   │   │   ├── dicom_utils.py  # Helpers pydicom, generación .wl
│   │   │   └── hl7_parser.py   # Builder/parser HL7 v2 (ADT/ORM/ORU)
│   │   ├── db/
│   │   │   ├── session.py      # AsyncEngine + AsyncSessionLocal
│   │   │   ├── base.py         # Importa todos los modelos (Alembic)
│   │   │   ├── base_class.py   # DeclarativeBase + enum_values()
│   │   │   └── seed.py         # Datos iniciales (usuarios, recursos)
│   │   ├── models/             # SQLAlchemy ORM
│   │   │   ├── user.py
│   │   │   ├── patient.py
│   │   │   ├── encounter.py
│   │   │   ├── order.py
│   │   │   ├── study.py
│   │   │   ├── report.py
│   │   │   ├── worklist.py
│   │   │   ├── schedule.py
│   │   │   ├── hl7_message.py
│   │   │   └── audit.py
│   │   ├── schemas/            # Pydantic v2 request/response
│   │   ├── routers/            # FastAPI endpoints por módulo
│   │   ├── services/           # Lógica de negocio
│   │   └── workers/            # Tareas Celery
│   ├── alembic/versions/       # Migraciones de BD
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── api/                # Axios + React Query hooks
│       ├── pages/              # Componentes por módulo
│       ├── types/index.ts      # Interfaces TypeScript
│       └── store/              # Zustand (auth state)
│
└── infrastructure/
    ├── nginx/nginx.conf        # Reverse proxy + rate limiting
    ├── orthanc/orthanc.json    # Config Orthanc PACS
    ├── keys/                   # Claves JWT RS256 (NO commitear)
    └── scripts/
        ├── init-db.sh          # Extensiones PostgreSQL
        └── generate-keys.sh    # Genera par de claves RSA
```

---

## 7. Base de Datos

### Motor
PostgreSQL 15 con extensiones `uuid-ossp` y `pg_trgm`.

### Esquema principal

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios del sistema (roles, bcrypt hash) |
| `patients` | Registro maestro de pacientes (MRN único) |
| `patient_contacts` | Teléfonos, emails, direcciones |
| `encounters` | Admisiones, encuentros ADT |
| `imaging_orders` | Órdenes de imagen (accession_number único) |
| `dicom_worklist_entries` | Entradas MWL para equipos DICOM |
| `imaging_studies` | Estudios DICOM recibidos desde Orthanc |
| `radiology_reports` | Informes radiológicos + firma digital |
| `report_versions` | Historial de versiones de informes |
| `appointments` | Citas de la agenda |
| `resources` | Salas y equipos (con AE Title DICOM) |
| `hl7_messages` | Log de mensajes HL7 enviados/recibidos |
| `audit_logs` | Auditoría de todas las acciones POST/PUT/DELETE |

### Comandos útiles

```bash
# Abrir consola psql
make db-shell
# o directamente:
docker compose exec postgres psql -U his_ris_user -d his_ris

# Aplicar migraciones
make migrate

# Crear nueva migración
make migrate-create MSG="add new_table table"

# Rollback una migración
make migrate-down

# Ver historial de migraciones
make migrate-history
```

### Backup de la base de datos

```bash
# Backup completo
docker compose exec postgres pg_dump -U his_ris_user his_ris > backup_$(date +%Y%m%d).sql

# Restaurar
docker compose exec -T postgres psql -U his_ris_user his_ris < backup_20260224.sql
```

---

## 8. Servicios y Puertos

| Servicio | Container | Puerto Host | Puerto Interno | Descripción |
|----------|-----------|-------------|----------------|-------------|
| Nginx | his_ris_nginx | **8080** | 80 | Punto de entrada principal |
| API FastAPI | his_ris_api | 8000 | 8000 | REST API + FHIR R4 |
| HL7 MLLP | his_ris_api | **2575** | 2575 | Listener TCP HL7 v2 |
| Frontend Vite | his_ris_frontend | (interno) | 3000 | Servido por nginx |
| PostgreSQL | his_ris_postgres | 5432 | 5432 | Base de datos |
| Redis | his_ris_redis | 6379 | 6379 | Cola Celery + caché |
| Orthanc HTTP | his_ris_orthanc | 8043 | 8042 | REST API PACS |
| Orthanc DICOM | his_ris_orthanc | 4243 | 4242 | SCP C-STORE / C-FIND |
| Celery Worker | his_ris_celery | — | — | Tareas asíncronas |
| Celery Beat | his_ris_celery_beat | — | — | Tareas programadas |

> **Para producción** (nginx en puerto 80/443): cambiar `"8080:80"` → `"80:80"` en `docker-compose.yml`.

---

## 9. Variables de Entorno

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql+asyncpg://... | URL completa de PostgreSQL |
| `REDIS_URL` | redis://redis:6379/0 | URL de Redis |
| `JWT_ALGORITHM` | RS256 | RS256 (producción) o HS256 (dev) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Expiración token de acceso |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Expiración token de refresco |
| `ORTHANC_URL` | http://orthanc:8042 | URL interna de Orthanc |
| `ORTHANC_USERNAME` | orthanc | Usuario Orthanc |
| `ORTHANC_PASSWORD` | orthanc | Contraseña Orthanc |
| `INSTITUTION_NAME` | Hospital General | Nombre del hospital |
| `ENVIRONMENT` | development | `development` o `production` |
| `ALLOWED_ORIGINS` | http://localhost:3000 | CORS — orígenes permitidos |
| `HL7_SENDING_FACILITY` | HIS_RIS | Identificador HL7 del sistema |
| `HL7_RECEIVING_FACILITY` | PACS | Identificador HL7 destino |

---

## 10. API REST — Referencia

Base URL: `http://servidor:8000/api/v1`

### Autenticación
```
POST /auth/login          Obtener access + refresh token
POST /auth/refresh        Renovar access token
POST /auth/logout         Invalidar sesión
```

### Pacientes (ADT)
```
GET    /patients           Listar (búsqueda, paginación)
POST   /patients           Crear paciente
GET    /patients/{id}      Ficha completa
PUT    /patients/{id}      Actualizar
POST   /encounters         Crear encuentro/admisión
```

### Órdenes e Imágenes (RIS)
```
GET    /orders             Listar (filtros: status, modality, patient_id)
POST   /orders             Crear orden → genera MWL + HL7 ORM^O01
GET    /orders/{id}        Detalle
PUT    /orders/{id}/status Actualizar estado
GET    /worklist           DICOM Worklist activa
GET    /studies            Estudios con info paciente/informe
```

### Informes
```
GET    /reports            Listar informes con info enriquecida
POST   /reports            Crear borrador
GET    /reports/{id}       Obtener informe
PUT    /reports/{id}       Actualizar borrador
POST   /reports/{id}/sign  Firmar digitalmente → HL7 ORU^R01
GET    /reports/{id}/pdf   Descargar PDF
```

### Agenda
```
GET    /appointments       Listar citas
POST   /appointments       Crear cita
PUT    /appointments/{id}  Modificar / cancelar
GET    /resources          Lista de salas y equipos
GET    /slots              Disponibilidad por recurso y fecha
```

### FHIR R4 (base: `/fhir/r4`)
```
GET    /Patient/{id}            Paciente FHIR
GET    /Patient                 Búsqueda (Bundle)
GET    /ServiceRequest/{id}     Orden FHIR
GET    /ImagingStudy/{id}       Estudio FHIR
GET    /DiagnosticReport/{id}   Informe FHIR
```

### Administración
```
GET    /admin/users             Listar usuarios
POST   /admin/users             Crear usuario
PUT    /admin/users/{id}        Editar usuario
DELETE /admin/users/{id}        Desactivar usuario
GET    /admin/audit-logs        Ver log de auditoría
GET    /hl7/messages            Log de mensajes HL7
GET    /hl7/messages/{id}/raw   Mensaje HL7 en texto plano
```

---

## 11. Integración DICOM / Orthanc

### Configuración Orthanc

Archivo: `infrastructure/orthanc/orthanc.json`

Orthanc actúa como:
- **SCP DICOM** (puerto 4243): recibe imágenes de los equipos.
- **Servidor de Worklist**: entrega las listas DICOM MWL a los equipos.
- **Webhook**: notifica al API cuando llega un estudio nuevo.

### Flujo Worklist (IHE Scheduled Workflow)

```
1. Médico crea orden (POST /orders)
   → Se genera archivo .wl en /var/lib/orthanc/worklists/

2. Equipo (CT/MR/CR) hace DICOM C-FIND a Orthanc puerto 4243
   → Recibe los datos del paciente y el procedimiento

3. Técnico selecciona el estudio en el equipo → adquiere imágenes
   → El equipo hace DICOM C-STORE a Orthanc puerto 4243

4. Orthanc llama al webhook: POST /api/v1/orthanc/webhook
   → El API vincula el estudio a la orden en BD
   → La orden pasa a COMPLETED
   → El .wl entry se marca como inactivo
```

### Configurar un equipo DICOM para apuntar al sistema

En la consola del equipo (CT/MR/CR), configurar:

| Parámetro | Valor |
|-----------|-------|
| AE Title destino | `ORTHANC` |
| Host / IP | IP del servidor |
| Puerto C-STORE | `4243` |
| Puerto C-FIND (worklist) | `4243` |

---

## 12. HL7 v2.x — MLLP Listener

### Puerto: 2575 (TCP)

El sistema escucha mensajes HL7 entrantes usando el protocolo MLLP (Minimal Lower Layer Protocol).

### Mensajes soportados

| Mensaje | Dirección | Trigger |
|---------|-----------|---------|
| `ADT^A01` | Outbound | Al registrar un paciente |
| `ADT^A03` | Outbound | Al dar de alta un paciente |
| `ORM^O01` | Outbound | Al crear una orden de imagen |
| `ORU^R01` | Outbound | Al firmar un informe radiológico |
| `ADT^*` | Inbound | Admisiones desde HIS externo |

### Enviar un mensaje HL7 al sistema (ejemplo Python)

```python
import socket

MLLP_START = b"\x0b"
MLLP_END   = b"\x1c\x0d"

msg = (
    "MSH|^~\\&|HIS_EXTERNO||HIS_RIS||20260224||ADT^A01|MSG001|P|2.5\r"
    "EVN|A01|20260224\r"
    "PID|1||PAT001|||GARCIA^JUAN\r"
)
frame = MLLP_START + msg.encode("latin-1") + MLLP_END

with socket.create_connection(("servidor", 2575)) as s:
    s.sendall(frame)
    ack = s.recv(1024)
    print("ACK:", ack.decode("latin-1"))
```

---

## 13. FHIR R4

El sistema expone recursos FHIR R4 de solo lectura.

**Base URL:** `http://servidor:8000/fhir/r4`

**Autenticación:** Bearer token JWT (mismo token que la API REST)

Recursos disponibles: `Patient`, `ServiceRequest`, `ImagingStudy`, `DiagnosticReport`

---

## 14. Seguridad

### JWT (JSON Web Tokens)
- **Algoritmo producción**: RS256 (par de claves RSA 2048 bits)
- **Algoritmo desarrollo**: HS256 (fallback si no hay claves)
- Token de acceso: 30 minutos
- Token de refresco: 7 días (rotación automática)
- Las claves privadas nunca deben commitearse al repositorio (están en `.gitignore`)

### Contraseñas
- Hash con **bcrypt** (factor de coste 12)
- Mínimo 8 caracteres

### Rate Limiting (nginx)
- Endpoints generales: 100 req/min por IP
- `/auth/login`: 10 req/min por IP (protección brute force)

### Headers de Seguridad
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### HTTPS (producción)
Para habilitar HTTPS, modifique `infrastructure/nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    # ... resto de la configuración
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Monte el volumen de certificados en el servicio nginx del `docker-compose.yml`:
```yaml
nginx:
  volumes:
    - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./infrastructure/certs:/etc/nginx/certs:ro
```

---

## 15. Backup y Restauración

### Backup Completo

```bash
#!/bin/bash
# backup.sh — ejecutar diariamente con cron
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/his_ris"
mkdir -p "$BACKUP_DIR"

# PostgreSQL
docker compose exec -T postgres pg_dump \
  -U his_ris_user his_ris | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Volumen Orthanc (imágenes DICOM)
docker run --rm \
  -v his_ris_orthanc_data:/data \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/orthanc_$DATE.tar.gz" /data

echo "Backup completado: $BACKUP_DIR"
```

Agregar a cron (`crontab -e`):
```
0 2 * * * /opt/his_ris/backup.sh >> /var/log/his_ris_backup.log 2>&1
```

### Restaurar PostgreSQL

```bash
# Detener el API para evitar escrituras durante la restauración
docker compose stop api celery-worker celery-beat

# Restaurar
gunzip -c backup_20260224_020000.sql.gz | \
  docker compose exec -T postgres psql -U his_ris_user his_ris

# Reiniciar
docker compose start api celery-worker celery-beat
```

---

## 16. Monitoreo y Logs

### Ver logs en tiempo real

```bash
# Todos los servicios
docker compose logs -f

# Solo API
make logs-api        # o: docker compose logs -f api

# Solo Celery Worker
make logs-worker

# Solo errores
docker compose logs api 2>&1 | grep ERROR
```

### Health Check Manual

```bash
# API
curl http://localhost:8000/health

# Orthanc
curl -u orthanc:orthanc http://localhost:8043/system

# PostgreSQL
docker compose exec postgres pg_isready -U his_ris_user

# Redis
docker compose exec redis redis-cli ping
```

### Métricas básicas

```bash
# Cantidad de pacientes
docker compose exec postgres psql -U his_ris_user his_ris \
  -c "SELECT COUNT(*) FROM patients;"

# Órdenes por estado
docker compose exec postgres psql -U his_ris_user his_ris \
  -c "SELECT status, COUNT(*) FROM imaging_orders GROUP BY status;"

# Mensajes HL7 de hoy
docker compose exec postgres psql -U his_ris_user his_ris \
  -c "SELECT message_type, COUNT(*) FROM hl7_messages WHERE created_at::date = CURRENT_DATE GROUP BY message_type;"
```

---

## 17. Migración de Datos desde AS/400 (IBM)

### ¿Es posible?

**Sí, es completamente viable.** AS/400 (iSeries / IBM i) usa DB2 como motor de base de datos, y los datos pueden exportarse e importarse al sistema HIS/RIS mediante varios métodos.

### Método 1 — Exportación CSV / SQL (recomendado para arranque)

**En el AS/400:**
```sql
-- Exportar pacientes (ajustar nombres de columnas al esquema de su AS/400)
CPYTOIMPF FROMFILE(LIBHOSPITAL/PACIENTES)
          TOSTMF('/home/export/pacientes.csv')
          MBROPT(*REPLACE) STMFCODPAG(*UTF8)
          RCDDLM(*CRLF) STRDLM(*NONE) FLDDLM(';')
```

**Transformación Python (ETL):**

```python
# etl_as400_patients.py
import csv
import httpx

BASE = "http://servidor:8000/api/v1"
token = httpx.post(f"{BASE}/auth/login",
                   json={"username": "admin", "password": "Admin123!"}) \
              .json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Mapeo de campos AS/400 → HIS/RIS
GENDER_MAP = {"M": "M", "F": "F", "H": "M", "V": "F"}  # ajustar según AS/400

with open("pacientes.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f, delimiter=";"):
        patient = {
            "first_name":      row["NOMPAC"].strip(),
            "last_name":       row["APEPAC"].strip(),
            "date_of_birth":   row["FECNAC"],   # formato YYYY-MM-DD
            "gender":          GENDER_MAP.get(row["SEXPAC"], "U"),
            "dni":             row["DNIPAC"].strip(),
            "contacts": []
        }
        if row.get("TELPAC"):
            patient["contacts"].append({
                "contact_type": "phone",
                "value": row["TELPAC"].strip(),
                "is_primary": True
            })

        r = httpx.post(f"{BASE}/patients", headers=headers, json=patient)
        if r.status_code == 201:
            print(f"OK: {patient['last_name']}, {patient['first_name']}")
        else:
            print(f"ERROR: {r.text} — {patient}")
```

### Método 2 — JDBC/ODBC directo (migración automatizada)

Instalar el driver JDBC de IBM (JTOpen) y usar Python con `jaydebeapi`:

```bash
pip install jaydebeapi jpype1
# Descargar: https://github.com/IBM/JTOpen (jt400.jar)
```

```python
import jaydebeapi
import httpx

# Conexión directa a DB2 en AS/400
conn = jaydebeapi.connect(
    "com.ibm.as400.access.AS400JDBCDriver",
    "jdbc:as400://192.168.1.100/LIBHOSPITAL;naming=system;date format=iso",
    ["usuario_as400", "password_as400"],
    "/path/to/jt400.jar"
)

cursor = conn.cursor()
cursor.execute("SELECT CODPAC, NOMPAC, APEPAC, FECNAC, SEXPAC, DNIPAC FROM PACIENTES")

# Para cada fila, llamar a la API del HIS/RIS...
```

### Método 3 — HL7 ADT (integración en tiempo real)

Si el AS/400 tiene capacidad de generar mensajes HL7 (muchos HIS legacy lo tienen), configure el AS/400 para enviar **ADT^A28** (nuevo paciente) o **ADT^A31** (actualización) al puerto **2575** del servidor HIS/RIS.

El sistema recibirá los mensajes y los almacenará automáticamente.

### Tablas a migrar y prioridad

| Prioridad | Tabla AS/400 → HIS/RIS | Notas |
|-----------|------------------------|-------|
| 1 | Pacientes → `patients` | MRN debe coincidir |
| 2 | Órdenes históricas → `imaging_orders` | Solo si se necesita historial |
| 3 | Encuentros → `encounters` | Admisiones activas |
| 4 | Estudios previos → `imaging_studies` | Solo si se migran imágenes DICOM |

### Consideraciones importantes

1. **MRN**: El número de historia clínica del AS/400 debe convertirse en el `mrn` del HIS/RIS. Mantenga la misma numeración para trazabilidad.
2. **Fechas**: AS/400 usa formatos de fecha variados (CYYMMDD, ISO). Normalice a `YYYY-MM-DD` antes de importar.
3. **Caracteres especiales**: El AS/400 usa EBCDIC. Al exportar a CSV, asegúrese de usar `*UTF8` como codepage.
4. **Migración en fases**: Primero migrar en entorno de pruebas. Validar conteos (COUNT) en ambas bases antes de go-live.
5. **Operación en paralelo**: Se recomienda 2-4 semanas de operación paralela (AS/400 + HIS/RIS) antes de cortar completamente.

---

## 18. Troubleshooting

### El API no arranca (error de DB)

```bash
docker compose logs api | grep ERROR
# Verificar que postgres está healthy:
docker compose ps postgres
# Si postgres no está healthy, revisar contraseñas en .env
```

### Error "mapper failed to initialize"

```
sqlalchemy.exc.InvalidRequestError: ... failed to locate a name 'ImagingOrder'
```

**Causa**: Un script Python no importó todos los modelos antes de usarlos.
**Solución**: Agregar `import app.db.base` al inicio del script.

### El Worklist no aparece en el equipo DICOM

1. Verificar que la entrada existe: `GET /api/v1/worklist`
2. Verificar que Orthanc está healthy: `curl -u orthanc:orthanc http://localhost:8043/system`
3. Verificar que el archivo `.wl` fue creado:
   ```bash
   docker compose exec api ls /var/lib/orthanc/worklists/
   ```
4. Verificar AE Title del equipo en `infrastructure/orthanc/orthanc.json`

### El MLLP no recibe mensajes

```bash
# Verificar que el puerto está escuchando
docker compose exec api ss -tlnp | grep 2575

# Ver logs del listener
docker compose logs api | grep MLLP
```

### Celery no procesa tareas

```bash
docker compose logs celery-worker | grep ERROR

# Verificar conexión a Redis
docker compose exec celery-worker celery -A app.workers.celery_app inspect ping
```

### Restablecer base de datos completamente (DESTRUCTIVO)

```bash
docker compose down -v          # elimina volúmenes
docker compose up -d
make migrate
make seed
```

---

## 19. Comandos Make de Referencia

```bash
make help          # Lista todos los comandos disponibles

# Docker
make up            # Levantar en modo desarrollo
make up-prod       # Levantar en modo producción
make down          # Detener todos los servicios
make build         # Reconstruir imágenes
make restart       # down + up

# Logs
make logs          # Todos los servicios
make logs-api      # Solo API
make logs-worker   # Solo Celery worker

# Base de datos
make migrate       # Aplicar migraciones pendientes
make migrate-create MSG="descripcion"  # Nueva migración
make migrate-down  # Rollback última migración
make db-shell      # Consola psql

# Datos
make seed          # Datos iniciales (usuarios, recursos)
make seed-demo     # Datos de demostración

# Desarrollo
make test          # Ejecutar tests backend
make test-cov      # Tests con cobertura HTML
make lint          # Ruff linter
make format        # Ruff formatter
make shell         # Shell en contenedor API

# Seguridad
make keys          # Generar claves JWT RS256

# Limpieza
make clean         # Eliminar contenedores + volúmenes (DESTRUCTIVO)
make clean-images  # Eliminar imágenes construidas
```
