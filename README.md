# Dimed HIS/RIS

Sistema completo de Información Hospitalaria (HIS) y Radiológica (RIS) con integración PACS Orthanc, DICOM MWL, HL7 v2.x y FHIR R4.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 + FastAPI + SQLAlchemy Async |
| Base de Datos | PostgreSQL 15 |
| Cache / Cola | Redis 7 + Celery |
| PACS | Orthanc con plugin Worklist |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Proxy | Nginx |
| Contenedores | Docker Compose |

---

## Inicio Rápido

### Prerrequisitos
- Docker Desktop (con WSL2 en Windows)
- OpenSSL (para generar claves JWT — solo primera vez)

### 1. Generar claves JWT RS256 (solo primera vez)
```bash
bash infrastructure/scripts/generate-keys.sh
```

### 2. Configurar variables de entorno (solo primera vez)
```bash
cp .env.example .env
# Editar .env si es necesario
```

### 3. Iniciar todos los servicios
```bash
docker compose -f docker-compose.yml up -d
```

### 4. Ejecutar migraciones (solo primera vez)
```bash
docker compose exec api alembic upgrade head
```

### 5. Cargar datos iniciales (solo primera vez)
```bash
docker compose exec api python -m app.db.seed
```

### 6. Acceder al sistema

| Servicio | URL |
|---|---|
| **HIS/RIS** (aplicación principal) | http://localhost:8080 |
| **API Docs** (Swagger) | http://localhost:8000/docs |
| **Orthanc PACS** | http://localhost:8043 |

**Desde otras máquinas en la red local** — solo necesitan un navegador:
```
http://<IP-DEL-SERVIDOR>:8080
```
No se instala ningún software adicional en los clientes.

---

## Usuarios por defecto

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin123! | Administrador |
| receptionist | Recep123! | Recepcionista |
| tecnico | Tecnico123! | Técnico |
| radiologo | Radiologo123! | Radiólogo |
| medico | Medico123! | Médico |

---

## Módulos del Sistema

### Pacientes (ADT)
- Registro y búsqueda de pacientes con MRN único
- Ficha completa: datos personales, contactos, historial de órdenes
- Edición inline (admin y recepcionista)
- Desactivación de pacientes (el registro se conserva)

### Órdenes RIS
- Creación de órdenes de imagen con modalidad, procedimiento, prioridad
- Generación automática de entrada DICOM Worklist (archivo `.wl`)
- Si se indica fecha programada → cita en agenda creada automáticamente
- Edición y cancelación de órdenes (admin y recepcionista)
- Estados: REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED / CANCELLED

### Agenda de Citas
- Calendario visual (vistas: mes, semana, día, agenda)
- Clic en cualquier cita → panel de detalle con nombre del paciente, estudio, fecha/hora, estado
- Enlace directo a la ficha del paciente desde el detalle
- Búsqueda de pacientes por nombre, MRN o cédula al crear cita manual

### Worklist DICOM (MWL)
- Lista de procedimientos pendientes para equipos de imagen
- Botón "Simular" para probar el flujo sin equipo físico (genera webhook de estudio)

### Informes Radiológicos
- Editor de informe: técnica, hallazgos, impresión diagnóstica, recomendaciones
- Borrador → Preliminar → Final (firmado digitalmente)
- Firma digital con contraseña de sesión del radiólogo (SHA-256 + timestamp)
- **Admin puede firmar cualquier informe**; radiólogos solo los propios
- Descarga en PDF

### Administración
- Gestión de usuarios (crear, activar/desactivar)
- Audit log de acciones críticas

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    Nginx (puerto 8080)                        │
├─────────────────────────┬────────────────────────────────────┤
│   React Frontend        │    FastAPI Backend                  │
│   Build estático        │    (puerto 8000)                    │
│   Nginx interno :80     │    /api/v1/*  /fhir/r4/*           │
└─────────────────────────┴────────────────────────────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          │                    │                      │
     PostgreSQL             Redis                  Orthanc
     (puerto 5432)      (puerto 6379)         HTTP:  8043
          │                    │              DICOM:  4243
     Alembic            Celery Worker              │
     Migrations         (async tasks)      Worklist .wl files
                                           (volumen compartido)
```

## Integración DIMED_PACS

El sistema HIS/RIS puede recibir estudios del PACS externo DIMED_PACS vía webhook:

```
[Equipo DICOM] → C-STORE → [DIMED_PACS Orthanc :4242]
    └─ OnStableStudy() Lua
        └─ POST http://host.docker.internal:8000/api/v1/orthanc/webhook
               └─ HIS/RIS crea ImagingStudy → vincula a orden → COMPLETED
               └─ Radiólogo crea y firma informe
```

| Servicio | HIS/RIS | DIMED_PACS |
|---------|---------|-----------|
| App principal | 8080 | 80 |
| Orthanc HTTP | 8043 | 8042 |
| Orthanc DICOM | 4243 | 4242 |

---

## Flujo IHE Scheduled Workflow (SWF)

```
1. Recepción registra paciente → ADT A01 HL7
2. Médico crea orden RIS → ORM O01 HL7
3. Sistema genera DicomWorklistEntry + escribe archivo .wl
4. Equipo CR/CT/MR hace C-FIND a Orthanc → recibe worklist
5. Equipo adquiere imágenes → C-STORE a Orthanc (puerto 4243)
6. Orthanc llama webhook POST /api/v1/orthanc/webhook
7. Backend vincula Study con Order → estado COMPLETED
8. Radiólogo crea y firma informe → ORU R01 HL7
9. Informe disponible en FHIR R4 /fhir/r4/DiagnosticReport/{id}
```

---

## Endpoints API Principales

### Autenticación
- `POST /api/v1/auth/login` — Login → JWT
- `POST /api/v1/auth/refresh` — Renovar token
- `GET  /api/v1/auth/me` — Usuario actual

### ADT - Pacientes
- `POST /api/v1/patients` — Crear paciente
- `GET  /api/v1/patients` — Listar/buscar
- `GET  /api/v1/patients/{id}` — Detalle
- `PUT  /api/v1/patients/{id}` — Actualizar
- `DELETE /api/v1/patients/{id}` — Desactivar

### RIS - Órdenes
- `POST /api/v1/orders` — Crear orden (→ MWL automático)
- `GET  /api/v1/orders` — Listar órdenes
- `PUT  /api/v1/orders/{id}` — Editar orden
- `DELETE /api/v1/orders/{id}` — Cancelar orden
- `GET  /api/v1/worklist` — Ver worklist activa

### Informes
- `POST /api/v1/reports` — Crear borrador
- `PUT  /api/v1/reports/{id}` — Editar
- `POST /api/v1/reports/{id}/sign` — Firmar (contraseña de sesión)
- `GET  /api/v1/reports/{id}/pdf` — Descargar PDF

### Agendamiento
- `POST /api/v1/appointments` — Crear cita
- `GET  /api/v1/appointments` — Listar citas
- `GET  /api/v1/resources` — Ver equipos/salas

### FHIR R4
- `GET /fhir/r4/Patient/{id}`
- `GET /fhir/r4/ServiceRequest/{id}`
- `GET /fhir/r4/ImagingStudy/{id}`
- `GET /fhir/r4/DiagnosticReport/{id}`

### Administración
- `GET  /api/v1/admin/users` — Listar usuarios
- `POST /api/v1/admin/users` — Crear usuario
- `GET  /api/v1/admin/audit-logs` — Ver audit log

---

## Comandos de Operación

### Operación diaria
```bash
# Iniciar sistema
docker compose -f docker-compose.yml up -d

# Detener sistema
docker compose -f docker-compose.yml down

# Ver estado de los servicios
docker compose -f docker-compose.yml ps

# Ver logs del API
docker compose -f docker-compose.yml logs api --tail=50 -f
```

### Después de cambios en el código
```bash
# Reconstruir backend
docker compose -f docker-compose.yml build api
docker compose -f docker-compose.yml up -d --force-recreate api
docker compose -f docker-compose.yml restart nginx   # ← SIEMPRE después de recrear el API

# Reconstruir frontend
docker compose -f docker-compose.yml build frontend
docker compose -f docker-compose.yml up -d frontend
```

### Solución de problemas

| Problema | Causa | Solución |
|---|---|---|
| Login → 502 Bad Gateway | Nginx tiene IP vieja del API | `docker compose restart nginx` |
| "No module named app" | Imagen no reconstruida | `docker compose build api` |
| Frontend sin interfaz | Vite dev mode desde red | Ya resuelto: build producción |

---

## Configuración DICOM para equipos

Para conectar un equipo de imagen al worklist:
- **AE Title SCP**: `ORTHANC`
- **Host**: IP del servidor
- **Puerto C-FIND (MWL)**: 4243
- **Puerto C-STORE**: 4243

---

## Seguridad

- JWT RS256 con rotación de refresh tokens (30 min access / 7 días refresh)
- RBAC por roles: admin, recepcionista, técnico, radiólogo, médico
- Audit log automático para todas las acciones POST/PUT/DELETE
- Firma digital SHA-256 de informes con verificación de contraseña
- Admin puede firmar cualquier informe; radiólogos solo los propios
- Headers de seguridad HTTP via Nginx
