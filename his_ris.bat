@echo off
setlocal EnableDelayedExpansion
title Dimed HIS/RIS
cd /d "%~dp0"

:: ================================================================
::  HIS/RIS - Menu de Gestion (Windows)
::  Uso: his_ris.bat  (doble clic o desde CMD)
:: ================================================================

:MENU
cls
echo.
echo  +======================================================+
echo  ^|              Dimed HIS/RIS                           ^|
echo  +======================================================^|
echo  ^|  SERVICIOS                                           ^|
echo  ^|    [1]  Iniciar sistema                              ^|
echo  ^|    [2]  Detener sistema                              ^|
echo  ^|    [3]  Reiniciar sistema                            ^|
echo  ^|    [4]  Reconstruir imagenes  (tras cambios codigo)  ^|
echo  ^|                                                      ^|
echo  ^|  BASE DE DATOS                                       ^|
echo  ^|    [5]  Ejecutar migraciones  (alembic upgrade)      ^|
echo  ^|    [6]  Cargar datos iniciales (seed)                ^|
echo  ^|    [7]  Abrir consola psql                           ^|
echo  ^|    [8]  Backup base de datos                         ^|
echo  ^|                                                      ^|
echo  ^|  INSTALACION PRIMERA VEZ                             ^|
echo  ^|    [9]  Configuracion inicial (keys+up+migrate+seed) ^|
echo  ^|                                                      ^|
echo  ^|  DIAGNOSTICO                                         ^|
echo  ^|    [10] Ver estado de servicios                      ^|
echo  ^|    [11] Ver logs API en tiempo real                  ^|
echo  ^|    [12] Ver logs todos los servicios                 ^|
echo  ^|    [13] Verificar salud del sistema                  ^|
echo  ^|                                                      ^|
echo  ^|  ACCESO RAPIDO                                       ^|
echo  ^|    [14] Abrir sistema en navegador                   ^|
echo  ^|    [15] Abrir API Docs (Swagger)                     ^|
echo  ^|    [16] Abrir Orthanc PACS                           ^|
echo  ^|                                                      ^|
echo  ^|  MANTENIMIENTO                                       ^|
echo  ^|    [17] Limpiar sistema (BORRA TODOS LOS DATOS)      ^|
echo  ^|                                                      ^|
echo  ^|    [0]  Salir                                        ^|
echo  +======================================================+
echo.
set "OPT="
set /p "OPT=  Seleccione una opcion: "

if "%OPT%"=="1"  goto INICIAR
if "%OPT%"=="2"  goto DETENER
if "%OPT%"=="3"  goto REINICIAR
if "%OPT%"=="4"  goto BUILD
if "%OPT%"=="5"  goto MIGRATE
if "%OPT%"=="6"  goto SEED
if "%OPT%"=="7"  goto DBSHELL
if "%OPT%"=="8"  goto BACKUP
if "%OPT%"=="9"  goto SETUP
if "%OPT%"=="10" goto STATUS
if "%OPT%"=="11" goto LOGS_API
if "%OPT%"=="12" goto LOGS_ALL
if "%OPT%"=="13" goto HEALTH
if "%OPT%"=="14" goto ABRIR_WEB
if "%OPT%"=="15" goto ABRIR_API
if "%OPT%"=="16" goto ABRIR_ORTHANC
if "%OPT%"=="17" goto LIMPIAR
if "%OPT%"=="0"  goto FIN

echo  Opcion no valida.
timeout /t 2 >nul
goto MENU

:: ----------------------------------------------------------------
:INICIAR
cls
echo.
echo  Iniciando todos los servicios...
echo.
docker compose -f docker-compose.yml up -d
echo.
echo  Servicios iniciados.
echo.
echo  Accesos:
echo    Sistema:  http://localhost:8080
echo    API Docs: http://localhost:8000/docs
echo    Orthanc:  http://localhost:8043
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:DETENER
cls
echo.
echo  Deteniendo servicios...
docker compose -f docker-compose.yml down
echo.
echo  Servicios detenidos.
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:REINICIAR
cls
echo.
echo  Reiniciando servicios...
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d
echo.
echo  Servicios reiniciados.
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:BUILD
cls
echo.
echo  Reconstruyendo imagenes Docker...
echo  (Esto puede tardar varios minutos)
echo.
echo  Seleccione que reconstruir:
echo    [1] Solo Backend (API)
echo    [2] Solo Frontend
echo    [3] Todo
echo.
set "BOPT="
set /p "BOPT=  Opcion: "

if "%BOPT%"=="1" (
    echo.
    echo  Reconstruyendo API...
    docker compose -f docker-compose.yml build api
    docker compose -f docker-compose.yml up -d --force-recreate api
    echo.
    echo  Reiniciando Nginx para actualizar rutas...
    docker compose -f docker-compose.yml restart nginx
    echo  Listo.
)
if "%BOPT%"=="2" (
    echo.
    echo  Reconstruyendo Frontend...
    docker compose -f docker-compose.yml build frontend
    docker compose -f docker-compose.yml up -d frontend
    echo  Listo.
)
if "%BOPT%"=="3" (
    echo.
    echo  Reconstruyendo todo...
    docker compose -f docker-compose.yml build api frontend
    docker compose -f docker-compose.yml up -d --force-recreate api frontend
    docker compose -f docker-compose.yml restart nginx
    echo  Listo.
)
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:MIGRATE
cls
echo.
echo  Ejecutando migraciones de base de datos...
docker compose -f docker-compose.yml exec api alembic upgrade head
echo.
echo  Migraciones completadas.
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:SEED
cls
echo.
echo  Cargando datos iniciales (usuarios por defecto)...
docker compose -f docker-compose.yml exec api python -m app.db.seed
echo.
echo  Datos iniciales cargados.
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

:: ----------------------------------------------------------------
:DBSHELL
cls
echo.
echo  Abriendo consola PostgreSQL...
echo  Escriba \q para salir.
echo.
docker compose -f docker-compose.yml exec postgres psql -U his_ris_user -d his_ris
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:BACKUP
cls
echo.
echo  Realizando backup de la base de datos...
echo.
if not exist "backups" mkdir "backups"

:: Obtener fecha/hora usando PowerShell (compatible con Windows 11)
for /f "delims=" %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set FECHA=%%D
set "ARCHIVO=backup_his_ris_%FECHA%.sql"

docker compose -f docker-compose.yml exec -T postgres pg_dump -U his_ris_user his_ris > "backups\%ARCHIVO%"
echo.
echo  Backup guardado en:  backups\%ARCHIVO%
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:SETUP
cls
echo.
echo  +===================================================+
echo  ^|   CONFIGURACION INICIAL - PRIMERA VEZ            ^|
echo  +===================================================+
echo.
echo  Este proceso realizara:
echo    1. Generar claves JWT (RSA 2048)
echo    2. Construir e iniciar todos los servicios
echo    3. Ejecutar migraciones de BD
echo    4. Cargar usuarios por defecto
echo.
set "CONF="
set /p "CONF=  Continuar? (S/N): "
if /i not "%CONF%"=="S" goto MENU

echo.
echo  [1/4] Generando claves JWT...
if not exist "infrastructure\keys" mkdir "infrastructure\keys"
docker run --rm -v "%CD%\infrastructure\keys:/keys" alpine/openssl genrsa -out /keys/private_key.pem 2048
docker run --rm -v "%CD%\infrastructure\keys:/keys" alpine/openssl rsa -in /keys/private_key.pem -pubout -out /keys/public_key.pem
echo  Claves generadas en infrastructure\keys\

echo.
echo  [2/4] Construyendo e iniciando servicios...
docker compose -f docker-compose.yml up -d --build

echo.
echo  [3/4] Esperando que la API este lista...
:WAIT_API
timeout /t 5 >nul
docker compose -f docker-compose.yml exec api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" >nul 2>&1
if errorlevel 1 (
    echo  Esperando API...
    goto WAIT_API
)
echo  API lista.

echo.
echo  [4/4] Migraciones y datos iniciales...
docker compose -f docker-compose.yml exec api alembic upgrade head
docker compose -f docker-compose.yml exec api python -m app.db.seed

echo.
echo  ===================================================
echo   INSTALACION COMPLETADA
echo  ===================================================
echo.
echo   Sistema:  http://localhost:8080
echo   API Docs: http://localhost:8000/docs
echo   Orthanc:  http://localhost:8043
echo.
echo   Usuario admin: admin / Admin123!
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:STATUS
cls
echo.
echo  Estado de los servicios:
echo.
docker compose -f docker-compose.yml ps
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:LOGS_API
cls
echo.
echo  Logs de la API (Ctrl+C para salir)...
echo.
docker compose -f docker-compose.yml logs -f api
goto MENU

:: ----------------------------------------------------------------
:LOGS_ALL
cls
echo.
echo  Logs de todos los servicios (Ctrl+C para salir)...
echo.
docker compose -f docker-compose.yml logs -f
goto MENU

:: ----------------------------------------------------------------
:HEALTH
cls
echo.
echo  Verificando salud del sistema...
echo.

echo  [API] http://localhost:8000/health
docker compose -f docker-compose.yml exec api python -c "import urllib.request, json; r=urllib.request.urlopen('http://localhost:8000/health'); print(r.read().decode())"
echo.

echo  [PostgreSQL]
docker compose -f docker-compose.yml exec postgres pg_isready -U his_ris_user -d his_ris
echo.

echo  [Redis]
docker compose -f docker-compose.yml exec redis redis-cli ping
echo.

echo  [Orthanc]
docker compose -f docker-compose.yml exec api python -c "import urllib.request, base64; req=urllib.request.Request('http://orthanc:8042/system'); req.add_header('Authorization','Basic '+base64.b64encode(b'orthanc:orthanc').decode()); r=urllib.request.urlopen(req); import json; data=json.loads(r.read()); print('Version:', data.get('Version','?'), '- OK')"
echo.

echo  [Contenedores]
docker compose -f docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}"
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:ABRIR_WEB
start http://localhost:8080
goto MENU

:: ----------------------------------------------------------------
:ABRIR_API
start http://localhost:8000/docs
goto MENU

:: ----------------------------------------------------------------
:ABRIR_ORTHANC
start http://localhost:8043
goto MENU

:: ----------------------------------------------------------------
:LIMPIAR
cls
echo.
echo  +===================================================+
echo  ^|   ADVERTENCIA - ACCION DESTRUCTIVA               ^|
echo  +---------------------------------------------------+
echo  ^|   Esto eliminara TODOS los contenedores y        ^|
echo  ^|   volumenes, incluyendo la base de datos.        ^|
echo  ^|   Esta accion NO se puede deshacer.              ^|
echo  +===================================================+
echo.
set "CONF="
set /p "CONF=  Escriba CONFIRMAR para continuar: "
if not "%CONF%"=="CONFIRMAR" (
    echo  Operacion cancelada.
    timeout /t 2 >nul
    goto MENU
)
echo.
echo  Eliminando contenedores y volumenes...
docker compose -f docker-compose.yml down -v --remove-orphans
echo.
echo  Sistema limpiado. Use la opcion 9 para reinstalar.
echo.
pause
goto MENU

:: ----------------------------------------------------------------
:FIN
cls
echo.
echo  Dimed HIS/RIS - Hasta luego.
echo.
endlocal
exit /b 0
