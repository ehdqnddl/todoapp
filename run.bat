@echo off
cd /d "%~dp0"

echo Todoapp 서버를 시작합니다 (http://localhost:8000)...
start "Todoapp Server" cmd /k python -m http.server 8000

timeout /t 1 /nobreak >nul
start http://localhost:8000/index.html
