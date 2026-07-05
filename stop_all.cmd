@echo off
setlocal enabledelayedexpansion
echo ============================================================
echo  XZ Digital Roots — Stopping All Services
echo ============================================================

echo.
echo [1/2] Killing processes on service ports (3004-3010, 5173)...

for %%P in (3004 3005 3006 3007 3008 3009 3010 5173) do (
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr /R ":%%P[^0-9]" ^| findstr LISTENING') do (
        echo     Stopping process on port %%P (PID: %%i)
        taskkill /PID %%i /F /T >nul 2>&1
    )
)

echo.
echo [2/2] Force-killing any remaining node/nodemon/ts-node processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM nodemon.exe /F >nul 2>&1
taskkill /IM ts-node.exe /F >nul 2>&1

echo.
echo Waiting for OS to release ports...
timeout /t 2 /nobreak >nul

echo.
echo Verifying ports are free...
set ALL_CLEAR=1
for %%P in (3004 3005 3006 3007 3008 3009 3010 5173) do (
    netstat -ano | findstr /R ":%%P[^0-9]" | findstr LISTENING >nul
    if not errorlevel 1 (
        echo     WARNING: Port %%P is STILL in use!
        set ALL_CLEAR=0
    )
)

if "!ALL_CLEAR!"=="1" (
    echo     All target ports are free.
) else (
    echo.
    echo     Some ports are still occupied. Remaining node-related processes:
    tasklist | findstr /I "node nodemon ts-node"
    echo.
    echo     Try re-running this script as Administrator.
)

echo.
echo ============================================================
echo  All XZ services have been stopped.
echo ============================================================
echo.
pause