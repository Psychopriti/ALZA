@echo off
setlocal
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
cd /d "%~dp0"
"%NODE_EXE%" server.js
