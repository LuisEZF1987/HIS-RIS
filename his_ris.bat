@echo off
setlocal EnableDelayedExpansion
title HIS/RIS Sistema Hospitalario

:: ════════════════════════════════════════════════════════════════
::  HIS/RIS — Menu de Gestion (Windows)
::  Uso: his_ris.bat  (doble clic o desde CMD)
:: ════════════════════════════════════════════════════════════════

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║         HIS/RIS  Sistema Hospitalario                ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  SERVICIOS                                           ║
echo  ║    [1]  Iniciar sistema          (docker compose up) ║
echo  ║    [2]  Detener sistema          (docker compose down)║
echo  ║    [3]  Reiniciar sistema                            ║
echo  ║    [4]  Reconstruir imagenes     (build)             ║
echo  ║                                                      ║
echo  ║  BASE DE DATOS                                       ║
echo  ║    [5]  Ejecutar migraciones     (alembic upgrade)   ║
echo  ║    [6]  Cargar datos iniciales   (seed)              ║
echo  ║    [7]  Abrir consola psql                           ║
echo  ║                                                      ║
echo  ║  INSTALACION PRIMERA VEZ                             ║
echo  ║    [8]  Configuracion inicial    (keys + up + migrate + seed)
echo  ║                                                      ║
echo  ║  DIAGNOSTICO                                         ║
echo  ║    [9]  Ver estado de servicios                      ║
echo  ║    [10] Ver logs API en tiempo real                  ║
echo  ║    [11] Ver logs todos los servicios                 ║
echo  ║    [12] Verificar salud del sistema                  ║
echo  ║                                                      ║
echo  ║  ACCESO                                              ║
echo  ║    [13] Abrir sistema en navegador                   ║
echo  ║    [14] Abrir API Docs (Swagger)                     ║
echo  ║    [15] Abrir Orthanc PACS                           ║
echo  ║                                                      ║
echo  ║  MANTENIMIENTO                                       ║
echo  ║    [16] Backup base de datos                         ║
echo  ║    [17] Limpiar sistema (BORRA DATOS)                ║
echo  ║                                                      ║
echo  ║    [0]  Salir                                        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
set /p "OPT=  Seleccione una opcion: "

if "%OPT%"=="1"  goto INICIAR
if "%OPT%"=="2"  goto DETENER
if "%OPT%"=="3"  goto REINICIAR
if "%OPT%"=="4"  goto BUILD
if "%OPT%"=="5"  goto MIGRATE
if "%OPT%"=="6"  goto SEED
if "%OPT%"=="7"  goto DBSHELL
if "%OPT%"=="8"  goto SETUP
if "%OPT%"=="9"  goto STATUS
if "%OPT%"=="10" goto LOGS_API
if "%OPT%"=="11" goto LOGS_ALL
if "%OPT%"=="12" goto HEALTH
if "%OPT%"=="13" goto ABRIR_WEB
if "%OPT%"=="14" goto ABRIR_API
if "%OPT%"=="15" goto ABRIR_ORTHANC
if "%OPT%"=="16" goto BACKUP
if "%OPT%"=="17" goto LIMPIAR
if "%OPT%"=="0"  goto FIN

echo  [!] Opcion no valida.
timeout /t 2 >nul
goto MENU

:: ────────────────────────────────────────────────────────────────
:INICIAR
cls
echo.
echo  [*] Iniciando todos los servicios...
echo.
docker compose up -d
echo.
echo  [OK] Servicios iniciados.
echo.
echo  Accesos:
echo    Sistema:  http://localhost:8080
echo    API Docs: http://localhost:8000/docs
echo    Orthanc:  http://localhost:8043
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:DETENER
cls
echo.
echo  [*] Deteniendo servicios...
docker compose down
echo.
echo  [OK] Servicios detenidos.
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:REINICIAR
cls
echo.
echo  [*] Reiniciando servicios...
docker compose down
docker compose up -d
echo.
echo  [OK] Servicios reiniciados.
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:BUILD
cls
echo.
echo  [*] Reconstruyendo imagenes Docker (puede tardar varios minutos)...
echo.
docker compose build
echo.
echo  [OK] Imagenes reconstruidas.
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:MIGRATE
cls
echo.
echo  [*] Ejecutando migraciones de base de datos...
docker compose exec api alembic upgrade head
echo.
echo  [OK] Migraciones completadas.
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:SEED
cls
echo.
echo  [*] Cargando datos iniciales (usuarios por defecto)...
docker compose exec api python -m app.db.seed
echo.
echo  [OK] Datos iniciales cargados.
echo.
echo  Usuarios disponibles:
echo    admin        / Admin123!
echo    receptionist / Recep123!
echo    tecnico      / Tecnico123!
echo    radiologo    / Radiologo123!
echo    medico       / Medico123!
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:DBSHELL
cls
echo.
echo  [*] Abriendo consola PostgreSQL...
echo      Escriba \q para salir.
echo.
docker compose exec postgres psql -U his_ris_user -d his_ris
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:SETUP
cls
echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║   CONFIGURACION INICIAL — PRIMERA VEZ             ║
echo  ╚═══════════════════════════════════════════════════╝
echo.
echo  Este proceso realizara:
echo    1. Generar claves JWT (RSA 2048)
echo    2. Iniciar todos los servicios
echo    3. Ejecutar migraciones de BD
echo    4. Cargar datos iniciales
echo.
set /p "CONF=  Continuar? (S/N): "
if /i not "%CONF%"=="S" goto MENU

echo.
echo  [1/4] Generando claves JWT...
if not exist "infrastructure\keys" mkdir "infrastructure\keys"
docker run --rm -v "%CD%\infrastructure\keys:/keys" alpine/openssl genrsa -out /keys/private_key.pem 2048
docker run --rm -v "%CD%\infrastructure\keys:/keys" alpine/openssl rsa -in /keys/private_key.pem -pubout -out /keys/public_key.pem
echo        Claves generadas en infrastructure\keys\

echo.
echo  [2/4] Construyendo e iniciando servicios...
docker compose up -d --build

echo.
echo  [3/4] Esperando que la API este lista...
:WAIT_API
timeout /t 5 >nul
docker compose exec api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" >nul 2>&1
if errorlevel 1 (
    echo        Esperando API...
    goto WAIT_API
)
echo        API lista.

echo.
echo  [4/4] Ejecutando migraciones y seed...
docker compose exec api alembic upgrade head
docker compose exec api python -m app.db.seed

echo.
echo  ═══════════════════════════════════════════════════
echo   INSTALACION COMPLETADA
echo  ═══════════════════════════════════════════════════
echo.
echo   Sistema:  http://localhost:8080
echo   API Docs: http://localhost:8000/docs
echo   Orthanc:  http://localhost:8043
echo.
echo   Usuario admin: admin / Admin123!
echo   (Cambie las contrasenas antes de produccion)
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:STATUS
cls
echo.
echo  [*] Estado de los servicios:
echo.
docker compose ps
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:LOGS_API
cls
echo.
echo  [*] Logs de la API (Ctrl+C para salir)...
echo.
docker compose logs -f api
goto MENU

:: ────────────────────────────────────────────────────────────────
:LOGS_ALL
cls
echo.
echo  [*] Logs de todos los servicios (Ctrl+C para salir)...
echo.
docker compose logs -f
goto MENU

:: ────────────────────────────────────────────────────────────────
:HEALTH
cls
echo.
echo  [*] Verificando salud del sistema...
echo.
echo  --- API ---
curl -s http://localhost:8000/health
echo.
echo  --- Orthanc ---
curl -s -u orthanc:orthanc http://localhost:8043/system
echo.
echo  --- PostgreSQL ---
docker compose exec postgres pg_isready -U his_ris_user -d his_ris
echo.
echo  --- Redis ---
docker compose exec redis redis-cli ping
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:ABRIR_WEB
start http://localhost:8080
goto MENU

:: ────────────────────────────────────────────────────────────────
:ABRIR_API
start http://localhost:8000/docs
goto MENU

:: ────────────────────────────────────────────────────────────────
:ABRIR_ORTHANC
start http://localhost:8043
goto MENU

:: ────────────────────────────────────────────────────────────────
:BACKUP
cls
echo.
echo  [*] Realizando backup de la base de datos...
echo.
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set FECHA=%DT:~0,8%_%DT:~8,6%
set ARCHIVO=backup_his_ris_%FECHA%.sql

if not exist "backups" mkdir "backups"
docker compose exec -T postgres pg_dump -U his_ris_user his_ris > "backups\%ARCHIVO%"
echo.
echo  [OK] Backup guardado en:  backups\%ARCHIVO%
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:LIMPIAR
cls
echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║   ADVERTENCIA — ACCION DESTRUCTIVA                ║
echo  ╠═══════════════════════════════════════════════════╣
echo  ║   Esto eliminara TODOS los contenedores y         ║
echo  ║   volumenes, incluyendo la base de datos.         ║
echo  ║   Esta accion NO se puede deshacer.               ║
echo  ╚═══════════════════════════════════════════════════╝
echo.
set /p "CONF=  Escriba CONFIRMAR para continuar: "
if not "%CONF%"=="CONFIRMAR" (
    echo  Operacion cancelada.
    timeout /t 2 >nul
    goto MENU
)
echo.
echo  [*] Eliminando contenedores y volumenes...
docker compose down -v --remove-orphans
echo.
echo  [OK] Sistema limpiado. Ejecute la opcion 8 para reinstalar.
echo.
pause
goto MENU

:: ────────────────────────────────────────────────────────────────
:FIN
cls
echo.
echo  HIS/RIS — Sistema detenido. Hasta luego.
echo.
endlocal
exit /b 0
