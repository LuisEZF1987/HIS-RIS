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

## Inicio Rápido

### Prerrequisitos
- Docker Desktop (con WSL2 en Windows)
- Make (opcional, para comandos simplificados)
- OpenSSL (para generar claves JWT)

### 1. Generar claves JWT RS256
```bash
bash infrastructure/scripts/generate-keys.sh
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env si es necesario
```

### 3. Iniciar todos los servicios
```bash
docker compose up -d
# o con make:
make up
```

### 4. Ejecutar migraciones de base de datos
```bash
docker compose exec api alembic upgrade head
# o:
make migrate
```

### 5. Cargar datos iniciales
```bash
docker compose exec api python -m app.db.seed
# o:
make seed
```

### 6. Acceder a la aplicación
- **Frontend**: http://localhost:80 (producción) o http://localhost:3000 (dev)
- **API Docs**: http://localhost:8000/docs
- **Orthanc**: http://localhost:8042 (admin:orthanc)

### Usuarios por defecto
| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin123! | Administrador |
| recepcion | Recep123! | Recepcionista |
| tecnico | Tecnico123! | Técnico |
| radiologo | Radiologo123! | Radiólogo |
| medico | Medico123! | Médico |

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (puerto 80)                     │
├──────────────────────┬──────────────────────────────────┤
│   React Frontend     │    FastAPI Backend                │
│   (puerto 3000)      │    (puerto 8000)                  │
│                      │    /api/v1/*                      │
│                      │    /fhir/r4/*                     │
└──────────────────────┴──────────────────────────────────┘
                              │
         ┌────────────────────┼─────────────────────┐
         │                    │                     │
    PostgreSQL            Redis                 Orthanc
    (puerto 5432)     (puerto 6379)        HTTP: 8042
         │                    │             DICOM: 4242
    Alembic            Celery Worker         │
    Migrations         (async tasks)    Worklist .wl files
                                        (volumen compartido)
```

## Flujo IHE Scheduled Workflow (SWF)

```
1. Recepción registra paciente → ADT A01 HL7
2. Médico crea orden RIS → ORM O01 HL7
3. Sistema genera DicomWorklistEntry + escribe archivo .wl
4. Equipo CR/CT/MR hace C-FIND a Orthanc → recibe worklist
5. Equipo adquiere imágenes → C-STORE a Orthanc (puerto 4242)
6. Orthanc llama webhook POST /api/v1/orthanc/webhook
7. Backend vincula Study con Order → actualiza estado
8. Radiólogo crea y firma informe → ORU R01 HL7
9. Informe disponible en FHIR R4 /fhir/r4/DiagnosticReport/{id}
```

## Endpoints API

### Autenticación
- `POST /api/v1/auth/login` — Login → JWT
- `POST /api/v1/auth/refresh` — Renovar token
- `GET /api/v1/auth/me` — Usuario actual

### ADT - Pacientes
- `POST /api/v1/patients` — Crear paciente
- `GET /api/v1/patients` — Listar/buscar
- `GET /api/v1/patients/{id}` — Detalle
- `PUT /api/v1/patients/{id}` — Actualizar
- `POST /api/v1/encounters` — Crear encuentro/admisión

### RIS - Órdenes
- `POST /api/v1/orders` — Crear orden (→ MWL automático)
- `GET /api/v1/orders` — Listar órdenes
- `PUT /api/v1/orders/{id}/status` — Cambiar estado
- `GET /api/v1/worklist` — Ver worklist activa

### Informes
- `POST /api/v1/reports` — Crear borrador
- `PUT /api/v1/reports/{id}` — Editar
- `POST /api/v1/reports/{id}/sign` — Firmar digitalmente
- `GET /api/v1/reports/{id}/pdf` — Descargar PDF

### Agendamiento
- `GET /api/v1/slots` — Ver disponibilidad
- `POST /api/v1/appointments` — Crear cita
- `GET /api/v1/resources` — Ver recursos/equipos

### FHIR R4
- `GET /fhir/r4/Patient/{id}`
- `GET /fhir/r4/ServiceRequest/{id}`
- `GET /fhir/r4/ImagingStudy/{id}`
- `GET /fhir/r4/DiagnosticReport/{id}`

### Orthanc
- `POST /api/v1/orthanc/webhook` — Webhook para estudios nuevos

## Comandos Útiles

```bash
make up              # Iniciar servicios (dev)
make down            # Detener servicios
make migrate         # Ejecutar migraciones
make seed            # Cargar datos iniciales
make logs-api        # Ver logs del API
make db-shell        # Abrir psql
make keys            # Generar claves JWT
make test            # Ejecutar tests
```

## Configuración DICOM para equipos

Para conectar un equipo de imagen a la worklist:
- **AE Title SCU**: Configurable por equipo
- **AE Title SCP**: `ORTHANC`
- **Host**: IP del servidor Orthanc
- **Puerto C-FIND**: 4242
- **Puerto C-STORE**: 4242

## Seguridad

- JWT RS256 con rotación de refresh tokens
- RBAC por roles: admin, recepcionista, técnico, radiólogo, médico
- Audit log para todas las acciones críticas
- Firma digital SHA-256 de informes
- Headers de seguridad HTTP via Nginx y middleware
