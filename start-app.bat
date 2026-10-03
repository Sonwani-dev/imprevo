@echo off
set "PATH=C:\Users\win\nodejs;C:\Users\win\mysql\bin;%PATH%"

echo ========================================================
echo        IMPREVO SMART KIOSK & PRINTER SPOOLER
echo ========================================================

echo Checking MySQL status...
tasklist /fi "imagename eq mysqld.exe" | find /i "mysqld.exe" >nul
if errorlevel 1 (
    echo Starting MySQL Server in background...
    start /min "MySQL Server" "C:\Users\win\mysql\bin\mysqld.exe" --defaults-file="C:\Users\win\mysql\my.ini" --console
    timeout /t 2 >nul
) else (
    echo MySQL Server is already running.
)

echo Building latest frontend bundle...
call npm run build

echo Starting Imprevo Backend and Hardware Print Spooler...
start "Imprevo Backend & Kiosk" cmd /c "npm run dev:all"

echo Waiting for services to initialize...
timeout /t 3 >nul

echo Opening Local Kiosk Dashboard at http://localhost:5001/dashboard...
start "" "http://localhost:5001/dashboard"

echo Imprevo is running! Keep this window open.
pause
