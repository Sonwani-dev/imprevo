@echo off
set "PATH=C:\Users\win\nodejs;C:\Users\win\mysql\bin;%PATH%"

echo Checking MySQL status...
tasklist /fi "imagename eq mysqld.exe" | find /i "mysqld.exe" >nul
if errorlevel 1 (
    echo Starting MySQL Server in background...
    start /min "MySQL Server" "C:\Users\win\mysql\bin\mysqld.exe" --defaults-file="C:\Users\win\mysql\my.ini" --console
    timeout /t 3 >nul
) else (
    echo MySQL Server is already running.
)

echo Starting Imprevo Backend and Frontend...
echo Opening Local Kiosk Dashboard at http://localhost:5001/dashboard...
start "" "http://localhost:5001/dashboard"
npm run dev:all
pause
