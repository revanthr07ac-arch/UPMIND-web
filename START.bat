@echo off
setlocal EnableDelayedExpansion
title UPMIND Web Application
color 0C
cd /d "%~dp0"

echo =====================================================================
echo               UPMIND -- Learn. Create. Connect.
echo       Full-Stack Peer Learning and Social Network Web App
echo =====================================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js was not found on your system!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        echo [*] Initializing .env configuration...
        copy /y ".env.example" ".env" >nul
    )
)

if not exist "node_modules" (
    echo [*] Installing dependencies, please wait...
    call npm.cmd install
)

echo.
echo [*] Starting Upmind server...
echo [*] Opening your default web browser at http://localhost:5173
echo.
echo ---------------------------------------------------------------------
echo   Press CTRL+C anytime in this window to stop the server.
echo ---------------------------------------------------------------------
echo.

call npm.cmd start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Server exited. Launching via npx vite...
    call npx.cmd vite --open
)

echo.
echo Server stopped.
pause
