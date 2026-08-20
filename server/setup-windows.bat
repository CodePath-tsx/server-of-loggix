@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   LogixStore - Installation du serveur
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js n'est pas installe. Installez la version LTS: https://nodejs.org
  pause
  exit /b 1
)

where psql >nul 2>nul
if errorlevel 1 (
  echo [ATTENTION] psql introuvable dans le PATH.
  echo Ajoutez C:\Program Files\PostgreSQL\16\bin au PATH puis relancez.
  pause
)

REM --- 1. Adresse IP locale ---
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined LANIP set LANIP=%%a
)
set LANIP=%LANIP: =%
echo Adresse IP detectee : %LANIP%
echo.

REM --- 2. Fichier .env ---
if not exist ".env" (
  echo Creation du fichier .env ...
  (
    echo PORT=3000
    echo SERVER_LAN_IP=%LANIP%
    echo NODE_ENV=production
    echo DATABASE_URL=postgres://logixstore:logix2024@localhost:5432/logixstore
    echo JWT_SECRET=logixstore-acces-secret-please-change-32chars
    echo JWT_REFRESH_SECRET=logixstore-refresh-secret-change-32chars
    echo JWT_ACCESS_EXPIRES_IN=15m
    echo JWT_REFRESH_EXPIRES_IN=30d
    echo CORS_ORIGINS=*
    echo RATE_LIMIT_MAX=300
    echo RATE_LIMIT_WINDOW=1 minute
    echo OWNER_DEFAULT_PASSWORD=Owner123456
    echo BACKUP_DIR=./backups
    echo BACKUP_RETENTION_DAYS=14
  ) > .env
  echo .env cree.
) else (
  echo .env existe deja - conserve.
)
echo.

REM --- 3. Base de donnees ---
echo Creation de la base de donnees (mot de passe postgres demande) ...
psql -U postgres -c "CREATE USER logixstore WITH PASSWORD 'logix2024';" 2>nul
psql -U postgres -c "CREATE DATABASE logixstore OWNER logixstore;" 2>nul
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE logixstore TO logixstore;" 2>nul
echo.

REM --- 4. Dependances + schema + donnees ---
call npm install || goto :err
call npm run db:push || goto :err
call npm run db:seed || goto :err

REM --- 5. Pare-feu ---
netsh advfirewall firewall add rule name="LogixStore 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>nul

echo.
echo ==========================================
echo   Installation terminee !
echo   Serveur : http://%LANIP%:3000
echo   Login   : proprietaire / Owner123456
echo ==========================================
echo.
echo Demarrage du serveur ...
call npm run dev
goto :eof

:err
echo.
echo [ERREUR] Une etape a echoue. Lisez le message ci-dessus.
pause
