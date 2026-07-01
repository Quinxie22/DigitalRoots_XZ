@echo off
echo ============================================================
echo  XZ Ancestral Network — Sequential Container Builder
echo ============================================================
echo.
echo [PRE-BUILD] Compiling TypeScript on host (no network required)...
echo.

echo   Building xz-user-service...
cd xz-user-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-user-service build failed & goto error)
cd ..

echo   Building xz-content-service...
cd xz-content-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-content-service build failed & goto error)
cd ..

echo   Building xz-chat-service...
cd xz-chat-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-chat-service build failed & goto error)
cd ..

echo   Building xz-point-service...
cd xz-point-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-point-service build failed & goto error)
cd ..

echo   Building xz-notification-service...
cd xz-notification-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-notification-service build failed & goto error)
cd ..

echo   Building xz-feed-service...
cd xz-feed-service
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-feed-service build failed & goto error)
cd ..

echo   Building xz-frontend...
cd xz-chat-service\frontend
call npm run build
if %errorlevel% neq 0 (echo ERROR: xz-frontend build failed & goto error)
cd ..\..

echo.
echo [PRE-BUILD] All TypeScript compiled successfully!
echo.

echo ============================================================
echo  Assembling Docker images sequentially...
echo ============================================================

echo.
echo [1/7] Building xz-user-service...
docker compose build --pull=false xz-user-service
if %errorlevel% neq 0 goto error

echo.
echo [2/7] Building xz-point-service...
docker compose build --pull=false xz-point-service
if %errorlevel% neq 0 goto error

echo.
echo [3/7] Building xz-notification-service...
docker compose build --pull=false xz-notification-service
if %errorlevel% neq 0 goto error

echo.
echo [4/7] Building xz-content-service...
docker compose build --pull=false xz-content-service
if %errorlevel% neq 0 goto error

echo.
echo [5/7] Building xz-chat-service...
docker compose build --pull=false xz-chat-service
if %errorlevel% neq 0 goto error

echo.
echo [6/7] Building xz-feed-service...
docker compose build --pull=false xz-feed-service
if %errorlevel% neq 0 goto error

echo.
echo [7/7] Building xz-frontend (Vite + Nginx)...
docker compose build --pull=false xz-frontend
if %errorlevel% neq 0 goto error

echo.
echo ============================================================
echo  All images built successfully! Starting containers...
echo ============================================================
docker compose up -d
goto end

:error
echo.
echo ============================================================
echo  ERROR: Build failed. Please check the logs above.
echo ============================================================
pause
exit /b %errorlevel%

:end
echo.
echo Container stack is up and running! Access http://localhost:5173
pause
