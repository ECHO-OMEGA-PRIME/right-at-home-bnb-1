@echo off
title Trinity Prime Bridge - RightAtHomeBnB
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════════════════════════════════╗
echo  ║  TRINITY PRIME - SOVEREIGN BRIDGE LAUNCHER                                    ║
echo  ║  Authority 11.0 ^| Commander Bobby Don McWilliams II                           ║
echo  ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

cd /d P:\SOVEREIGN_APPS\RightAtHomeBnB\bridge

:: Check if ws is installed
if not exist "..\node_modules\ws" (
    echo [SETUP] Installing WebSocket dependency...
    cd ..
    call npm install ws
    cd bridge
)

echo [STARTING] Bridge Agent...
echo.
echo  WebSocket: localhost:8080 (Trinity UI)
echo  HTTP:      localhost:8765 (External AI)
echo.
echo  After startup, run in another terminal:
echo    cloudflared tunnel --url http://localhost:8765
echo.
echo  Then open trinity_prime_canvas.html in your browser
echo.
echo ══════════════════════════════════════════════════════════════════════════════════
echo.

node trinity_bridge_agent.js

pause
