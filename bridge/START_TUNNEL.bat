@echo off
title Cloudflare Tunnel - Gemini Access
color 0B

echo.
echo  ╔═══════════════════════════════════════════════════════════════════════════════╗
echo  ║  CLOUDFLARE TUNNEL - GEMINI EXTERNAL ACCESS                                   ║
echo  ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.
echo  Starting tunnel to expose localhost:8765...
echo  Copy the https://xxx.trycloudflare.com URL and give it to Gemini!
echo.
echo ══════════════════════════════════════════════════════════════════════════════════
echo.

cloudflared tunnel --url http://localhost:8765

pause
