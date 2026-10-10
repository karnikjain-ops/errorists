# CivicSense AI - Civic Complaints Aggregator & Routing Engine

Intelligent civic complaint ingestion, geospatial clustering within 500m, and canonical ranking system.

## Project Structure

- **`backend/`**: FastAPI backend with SQLAlchemy, spatial Haversine clustering, and Gemini AI heuristic engine.
- **`frontend/`**: React + Vite frontend with Tailwind CSS, Leaflet GIS maps, and Lucide icons.
- **`start_dev.bat`**: One-click startup script for Windows to launch both services.

---

## Quick Start (Development)

### Option 1: One-Click Startup (Windows)
Double-click or run `start_dev.bat` from the root directory:
```bash
.\start_dev.bat
```

### Option 2: Run Services Manually

#### 1. Backend Server
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```
- API is accessible at: `http://localhost:8000`
- Swagger Documentation: `http://localhost:8000/docs`

#### 2. Frontend Development Server
```powershell
cd frontend
npm run dev
```
- Web App is accessible at: `http://localhost:5173`

---

## Database Configuration

The application supports both local SQLite and PostgreSQL (e.g. Supabase).

In `backend/.env`:
- **Local SQLite (Default)**:
  ```env
  DATABASE_URL=sqlite:///./complaints.db
  ```
- **PostgreSQL (Optional)**:
  ```env
  DATABASE_URL=postgresql://user:password@host:port/database
  ```

> **Note**: If a configured remote PostgreSQL database cannot be reached (e.g. DNS failure, network timeout), the backend automatically falls back to the local SQLite database (`complaints.db`) without crashing.

