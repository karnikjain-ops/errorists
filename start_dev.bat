@echo off
echo ========================================================
echo Starting CivicSense AI (Backend + Frontend)
echo ========================================================

echo Starting FastAPI Backend on http://localhost:8000 ...
start "CivicSense Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Vite Frontend on http://localhost:5173 ...
start "CivicSense Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers have been launched in separate terminal windows!
echo - Backend:  http://localhost:8000
echo - API Docs: http://localhost:8000/docs
echo - Frontend: http://localhost:5173
echo ========================================================
