# Manual de Usuario — Dimed HIS/RIS

**Versión:** 1.0.0
**Fecha:** Febrero 2026

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Módulo Dashboard](#3-módulo-dashboard)
4. [Módulo Pacientes (ADT)](#4-módulo-pacientes-adt)
5. [Módulo Órdenes de Imagen (RIS)](#5-módulo-órdenes-de-imagen-ris)
6. [Módulo Worklist DICOM](#6-módulo-worklist-dicom)
7. [Módulo Informes Radiológicos](#7-módulo-informes-radiológicos)
8. [Módulo Agenda](#8-módulo-agenda)
9. [Módulo Administración](#9-módulo-administración)
10. [Roles y Permisos](#10-roles-y-permisos)
11. [Preguntas Frecuentes](#11-preguntas-frecuentes)

---

## 1. Introducción

El **Dimed HIS/RIS** es una plataforma web integrada que cubre:

- **HIS** (Hospital Information System): registro de pacientes, encuentros clínicos.
- **RIS** (Radiology Information System): órdenes de imagen, informes radiológicos, firma digital.
- **PACS** (Picture Archiving): integración con Orthanc para almacenamiento y visualización de imágenes DICOM.
- **Estándares**: DICOM Worklist (MWL), HL7 v2.x, FHIR R4.

**URL de acceso:** `http://<servidor>:8080`
**Documentación API:** `http://<servidor>:8000/docs` (solo en entorno de desarrollo)

---

## 2. Acceso al Sistema

### 2.1 Inicio de Sesión

1. Abra el navegador y acceda a la URL del sistema.
2. Ingrese su **usuario** y **contraseña**.
3. Haga clic en **Iniciar Sesión**.

> **Sesión:** El token de acceso expira a los 30 minutos de inactividad. El sistema lo renueva automáticamente mientras esté activo.

### 2.2 Usuarios por Defecto (instalación nueva)

| Usuario       | Contraseña    | Rol              |
|---------------|---------------|------------------|
| admin         | Admin123!     | Administrador    |
| receptionist  | Recep123!     | Recepcionista    |
| tecnico       | Tecnico123!   | Técnico          |
| radiologo     | Radiologo123! | Radiólogo        |
| medico        | Medico123!    | Médico           |

> **Importante:** Cambie las contraseñas por defecto antes de poner el sistema en producción.

### 2.3 Cierre de Sesión

Haga clic en su nombre de usuario (esquina superior derecha) → **Cerrar Sesión**.

---

## 3. Módulo Dashboard

Pantalla principal tras el inicio de sesión. Muestra:

| Tarjeta | Descripción |
|---------|-------------|
| **Total Pacientes** | Cantidad de pacientes registrados |
| **Órdenes Pendientes** | Órdenes en estado REQUESTED |
| **Órdenes Programadas** | Órdenes en estado SCHEDULED |
| **Worklist Activo** | Estudios pendientes de adquisición en equipos |
| **Sin Informe** | Estudios recibidos sin informe (solo admin y radiólogo) |

**Acciones rápidas** disponibles: Nuevo Paciente, Nueva Orden, Ver Worklist, Ver Agenda.

---

## 4. Módulo Pacientes (ADT)

### 4.1 Buscar Paciente

1. Menú → **Pacientes**.
2. Escriba en el campo de búsqueda: nombre, apellido o MRN.
3. Haga clic en el paciente para ver su ficha.

### 4.2 Registrar Nuevo Paciente

1. Menú → **Pacientes** → botón **+ Nuevo Paciente**.
2. Complete los campos:

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Nombre(s) | Sí | Nombres del paciente |
| Apellido(s) | Sí | Apellidos |
| Fecha de Nacimiento | No | Formato YYYY-MM-DD |
| Género | No | M / F / Otro |
| DNI | No | Documento de identidad |
| Grupo Sanguíneo | No | A+, A-, B+, etc. |
| Alergias | No | Texto libre |
| Teléfono | No | Número de contacto |
| Email | No | Correo electrónico |

3. Haga clic en **Registrar Paciente**.
4. El sistema asigna automáticamente un **MRN** (Medical Record Number) único.

> Al registrar el paciente se genera automáticamente un mensaje **HL7 ADT^A01** hacia sistemas externos.

### 4.3 Ficha del Paciente

Muestra:
- Datos personales completos.
- Lista de órdenes de imagen históricas.
- Botón **Nueva Orden** para crear una orden directamente desde la ficha.

---

## 5. Módulo Órdenes de Imagen (RIS)

### 5.1 Ver Órdenes

Menú → **Órdenes**. Se puede filtrar por:
- **Estado**: REQUESTED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED.
- **Modalidad**: CR, CT, MR, US, etc.

### 5.2 Crear Nueva Orden

1. Menú → **Órdenes** → **+ Nueva Orden** (o desde la ficha del paciente).
2. Complete los campos:

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| ID Paciente | Sí | Número de ID del paciente |
| Modalidad | Sí | CR, CT, MR, US, NM, PT, DX, MG, XA, RF, OT |
| Descripción del Procedimiento | Sí | Texto descriptivo |
| Código de Procedimiento | No | Código SNOMED/CPT |
| Parte del Cuerpo | No | Región anatómica |
| Prioridad | Sí | ROUTINE / URGENT / STAT / ASAP |
| Indicación Clínica | No | Motivo clínico |
| Fecha Programada | No | Fecha y hora de la cita |

3. Haga clic en **Crear Orden**.

> Al crear la orden:
> - Se genera automáticamente una **entrada en el Worklist DICOM** (archivo `.wl` para Orthanc).
> - Se envía un mensaje **HL7 ORM^O01** a sistemas externos.

### 5.3 Estados de una Orden

```
REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED
                                    ↘ CANCELLED
```

---

## 6. Módulo Worklist DICOM

Menú → **Worklist**.

Muestra las órdenes programadas disponibles para los equipos de imagen (DICOM C-FIND MWL).

**Filtro por Modalidad**: permite ver solo los estudios para un equipo específico (CT, MR, CR, etc.).

> Los equipos de imagen (CT, MRI, etc.) consultan esta lista automáticamente via DICOM C-FIND. Cuando el técnico selecciona un estudio en el equipo, los datos del paciente se cargan automáticamente (sin riesgo de error de transcripción).

---

## 7. Módulo Informes Radiológicos

### 7.1 Tab "Pendientes de Informe"

Lista los estudios recibidos (imágenes ya en Orthanc) que aún no tienen informe.

- Muestra: nombre del paciente, MRN, número de acceso, modalidad, cantidad de series.
- Botón **Crear Informe**: crea un borrador y abre el editor.

### 7.2 Tab "Mis Informes"

Lista todos los informes existentes (borradores y firmados).

- **Borrador** (draft): en edición.
- **Preliminar** (preliminary): guardado al menos una vez.
- **Firmado** (final): firmado digitalmente, no editable.

### 7.3 Editor de Informe

Campos disponibles:

| Sección | Descripción |
|---------|-------------|
| **Técnica** | Descripción del protocolo utilizado |
| **Hallazgos** | Descripción de lo observado en las imágenes |
| **Impresión Diagnóstica** | Conclusión diagnóstica (obligatorio para firmar) |
| **Recomendaciones** | Sugerencias de seguimiento |

**Guardar Borrador**: guarda el informe sin firmarlo (puede editarse nuevamente).

### 7.4 Firma Digital

1. Haga clic en **Firmar Informe**.
2. Ingrese su **contraseña** para confirmar identidad.
3. El sistema:
   - Marca el informe como **final** (no editable).
   - Genera un **hash SHA-256** de verificación.
   - Registra fecha/hora de firma y nombre del firmante.
   - Envía automáticamente un mensaje **HL7 ORU^R01** a sistemas externos.

> Un informe firmado NO puede modificarse. Si necesita correcciones, contacte al administrador para crear un informe enmendado.

### 7.5 Descarga PDF

Disponible solo para informes firmados (estado **final**). El PDF incluye:
- Datos del paciente y número de acceso.
- Técnica, hallazgos, impresión diagnóstica y recomendaciones.
- Nombre del firmante, fecha y hash de verificación.

---

## 8. Módulo Agenda

### 8.1 Vista Calendario

Menú → **Agenda**. Muestra citas en vista mensual, semanal o diaria.

### 8.2 Crear Cita

1. Haga clic en **+ Nueva Cita** o en un slot libre del calendario.
2. Complete: paciente, recurso (sala/equipo), fecha y hora, duración.

### 8.3 Consultar Disponibilidad

Seleccione un recurso y una fecha para ver los slots disponibles.

**Recursos disponibles**: salas de RX, escáneres CT, equipos MRI, ecógrafos, etc.

---

## 9. Módulo Administración

> Accesible solo para el rol **Administrador**.

### 9.1 Gestión de Usuarios

- Crear nuevos usuarios con roles específicos.
- Ver estado (activo/inactivo) de cada usuario.
- Desactivar usuarios que ya no deben tener acceso.

### 9.2 Auditoría del Sistema

Tab **Auditoría** — registra automáticamente:
- Todas las acciones de creación/modificación/eliminación.
- Usuario que realizó la acción.
- IP de origen, endpoint, código HTTP de respuesta.
- Fecha y hora exacta.

---

## 10. Roles y Permisos

| Módulo | Admin | Recepcionista | Técnico | Radiólogo | Médico |
|--------|-------|---------------|---------|-----------|--------|
| Pacientes (crear/editar) | ✓ | ✓ | — | — | — |
| Pacientes (ver) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Órdenes (crear) | ✓ | — | — | — | ✓ |
| Órdenes (ver) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Worklist | ✓ | — | ✓ | ✓ | — |
| Informes (crear/editar) | ✓ | — | — | ✓ | — |
| Informes (firmar) | ✓ | — | — | ✓ | — |
| Informes (ver) | ✓ | — | ✓ | ✓ | ✓ |
| Agenda | ✓ | ✓ | ✓ | ✓ | ✓ |
| FHIR R4 | ✓ | — | — | ✓ | ✓ |
| HL7 mensajes | ✓ | — | — | — | — |
| Administración | ✓ | — | — | — | — |

---

## 11. Preguntas Frecuentes

**¿Qué hago si olvidé mi contraseña?**
Contacte al administrador del sistema para que restablezca su contraseña desde el módulo de Administración.

**¿Puedo editar un informe ya firmado?**
No. Los informes firmados son inmutables por seguridad. Solicite al administrador que gestione un informe enmendado.

**¿Por qué no veo la opción Worklist?**
El Worklist solo está disponible para los roles: Técnico, Radiólogo y Administrador.

**¿Cuánto tiempo permanece activa mi sesión?**
El token de acceso expira en 30 minutos. El sistema lo renueva automáticamente mientras esté usando la aplicación. Si estuvo inactivo más de 30 minutos, deberá volver a iniciar sesión.

**¿El sistema funciona en dispositivos móviles?**
La interfaz es responsive y funciona en tablets. Para uso intensivo (informes, worklist) se recomienda escritorio.
