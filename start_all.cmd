@echo off
echo Starting XZ Ancestral Network Services...

start "XZ - User Service [3006]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-user-service && npm run dev"
start "XZ - Content Service [3005]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-content-service && npm run dev"
start "XZ - Chat Service [3004]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-chat-service && npm run dev"
start "XZ - Point Service [3007]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-point-service && npm run dev"
start "XZ - Feed Service [3009]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-feed-service && npm run dev"
start "XZ - Notification Service [3010]" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-notification-service && npm run dev"
start "XZ - Frontend Client" cmd /k "cd /d C:\Users\Mbiangoup II Reine\Documents\XZ PROJECT\xz-chat-service\frontend && npm run dev"

echo All processes launched! Feel free to check the respective console windows.
pause
