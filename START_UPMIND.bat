@echo off
title UPMIND Web Application
color 0C
cd /d "%~dp0"

echo =====================================================================
echo               UPMIND -- Learn. Create. Connect.
echo       Full-Stack Peer Learning ^& Social Network Web App
echo =====================================================================
echo.
echo [*] Checking environment...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        echo [*] Initializing .env configuration from .env.example...
        copy ".env.example" ".env" >nul
    )
)

if not exist "node_modules\" (
    echo [*] Installing dependencies (first run only)...
    call npm install
)

echo.
echo [*] Starting Upmind development server...
echo [*] Opening your default web browser at http://localhost:5173
echo.
echo ---------------------------------------------------------------------
echo   Press CTRL+C anytime in this window to stop the server.
echo ---------------------------------------------------------------------
echo.

call npm start

pause
