# DrumGen Scorer - Complete Setup Guide

This guide will walk you through setting up the DrumGen Scorer application on a new machine.

## Table of Contents
- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software

1. **Python 3.11+**
   - Download from: https://www.python.org/downloads/
   - Verify installation: `python3 --version` or `python --version`

2. **Node.js 18+ and npm**
   - Download from: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

3. **Git**
   - Download from: https://git-scm.com/downloads
   - Verify installation: `git --version`

---

## System Requirements

- **OS**: macOS, Linux, or Windows (WSL recommended for Windows)
- **RAM**: Minimum 4GB
- **Storage**: At least 1GB free space
- **Network**: Internet connection required for API calls to DrumGen and Illugen servers

---

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "DrumGen Scorer"
```

### 2. Backend Setup (Python/FastAPI)

#### a. Create Python Virtual Environment

```bash
cd backend
python3 -m venv .venv
```

#### b. Activate Virtual Environment

**macOS/Linux:**
```bash
source .venv/bin/activate
```

**Windows (PowerShell):**
```powershell
.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
.venv\Scripts\activate.bat
```

#### c. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### d. Verify Backend Dependencies

The `requirements.txt` includes:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - Database ORM
- `aiosqlite` - Async SQLite support
- `httpx` - Async HTTP client
- `pydantic` - Data validation
- Other supporting libraries

### 3. Frontend Setup (React/Vite)

#### a. Navigate to Frontend Directory

```bash
cd ../frontend
```

#### b. Install Node Dependencies

```bash
npm install
```

#### c. Verify Frontend Dependencies

The `package.json` includes:
- `react` & `react-dom` - UI framework
- `react-router-dom` - Routing
- `axios` - HTTP client
- `vite` - Build tool and dev server
- Other supporting libraries

---

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the project root (optional, defaults are provided):

```bash
# DrumGen API Configuration
DRUMGEN_BASE_URL=https://dev-onla-drumgen-demo.waves.com
DRUMGEN_TIMEOUT=30
DRUMGEN_MAX_RETRIES=3

# Illugen API Configuration
ILLUGEN_BASE_URL=https://dev-onla-samplemaker-server.waves.com
ILLUGEN_TIMEOUT=30
ILLUGEN_MAX_RETRIES=3
ILLUGEN_COOKIE="<your-illugen-cookie-if-needed>"
```

**Note**: The Illugen cookie may be required for authentication. If you don't have one, Illugen features may not work, but the core DrumGen functionality will still operate.

---

## Database Setup

### Database File

The application uses SQLite with the database file located at:
```
./drumgen.db
```

**Important**: The database file (`drumgen.db`) is included in the repository and contains:
- Prompts dataset
- Test results
- Illugen generation records

### Database Schema

The database includes three main tables:
1. **prompts** - Drum generation prompts with difficulty ratings
2. **test_results** - Scored test results
3. **illugen_generations** - Illugen sample generation records

### If Database Needs Reset

To reset the database (⚠️ this will delete all data):

```bash
# Backup first (optional)
cp drumgen.db drumgen.db.backup

# Delete and let the app recreate it
rm drumgen.db
```

The application will automatically create a new database on next startup, but it will be empty.

---

## Running the Application

### Quick Start (Recommended)

From the project root directory:

```bash
# Make the start script executable (first time only)
chmod +x scripts/start_servers.sh

# Start both backend and frontend
./scripts/start_servers.sh
```

### Manual Start (Alternative)

#### Terminal 1 - Backend Server

```bash
cd "DrumGen Scorer"
source backend/.venv/bin/activate
PYTHONPATH=. uvicorn backend.main:app --port 8000
```

Backend will be available at: http://localhost:8000

#### Terminal 2 - Frontend Development Server

```bash
cd "DrumGen Scorer/frontend"
npm run dev -- --host --port 5173
```

Frontend will be available at: http://localhost:5173

### Accessing the Application

Once both servers are running:
1. Open your browser to: http://localhost:5173
2. You should see the DrumGen Scorer interface
3. Navigate between pages:
   - **Testing** - Generate and score drum samples
   - **Results** - View and manage test results
   - **Dashboard** - Analytics and statistics
   - **Prompts** - Manage prompts library

---

## Project Structure

```
DrumGen Scorer/
├── backend/                  # FastAPI backend
│   ├── .venv/               # Python virtual environment
│   ├── main.py              # FastAPI application entry point
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models & Pydantic schemas
│   ├── routers/             # API route handlers
│   │   ├── prompts.py       # Prompts CRUD endpoints
│   │   ├── results.py       # Results & dashboard endpoints
│   │   └── testing.py       # Generation & testing endpoints
│   ├── services/            # External API clients
│   │   ├── analytics.py     # Scoring calculations
│   │   ├── drumgen_client.py   # DrumGen API client
│   │   ├── illugen_client.py   # Illugen API client
│   │   └── prompt_generator.py # Prompt generation
│   └── requirements.txt     # Python dependencies
├── frontend/                # React frontend
│   ├── node_modules/        # Node dependencies
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client (axios)
│   │   ├── App.jsx          # Main app component
│   │   └── main.jsx         # Entry point
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
├── audio_files/             # Generated DrumGen audio samples
├── illugen_audio/           # Generated Illugen audio samples
├── note_attachments/        # User-uploaded note attachments
├── drumgen.db               # SQLite database
├── scripts/                 # Utility scripts
│   ├── start_backend.sh     # Start backend only
│   ├── start_frontend.sh    # Start frontend only
│   └── start_servers.sh     # Start both servers
├── SETUP.md                 # This file
├── README.md                # Project overview
└── requirements.txt         # Python dependencies (root level)
```

---

## Troubleshooting

### Backend Issues

#### Port 8000 Already in Use

```bash
# Find and kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Or use a different port
uvicorn backend.main:app --port 8001
```

#### Python Virtual Environment Not Activating

```bash
# Recreate the virtual environment
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### Database Errors

```bash
# Check if database file exists
ls -la drumgen.db

# Check permissions
chmod 644 drumgen.db

# If corrupted, restore from backup or delete
rm drumgen.db  # App will recreate on next start
```

#### Import Errors

```bash
# Make sure PYTHONPATH is set
export PYTHONPATH=.
# Or run from project root with:
PYTHONPATH=. uvicorn backend.main:app --port 8000
```

### Frontend Issues

#### Port 5173 Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port in package.json or command line
npm run dev -- --port 5174
```

#### Node Modules Issues

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Build Errors

```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### API Connection Issues

#### Backend Not Responding

1. Check if backend is running: `curl http://localhost:8000/docs`
2. Check backend logs in the terminal
3. Verify CORS settings in `backend/main.py`

#### DrumGen/Illugen API Errors

1. Check network connectivity
2. Verify API URLs in environment variables
3. Check if Illugen cookie is valid (if required)
4. Review API timeout settings

### General Issues

#### "Module Not Found" Errors

**Python:**
```bash
cd backend
source .venv/bin/activate
pip list  # Verify all packages are installed
pip install -r requirements.txt  # Reinstall if needed
```

**Node:**
```bash
cd frontend
npm list  # Verify packages
npm install  # Reinstall if needed
```

#### Permission Denied

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix file permissions
chmod -R u+w .
```

---

## Updating the Application

### Pull Latest Changes

```bash
git pull origin main  # Or 'dev' for development branch
```

### Update Backend Dependencies

```bash
cd backend
source .venv/bin/activate
pip install --upgrade -r requirements.txt
```

### Update Frontend Dependencies

```bash
cd frontend
npm install
```

---

## Development Notes

### API Documentation

When the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Testing Endpoints

You can test API endpoints using:
- The Swagger UI at `/docs`
- cURL commands
- Postman or similar tools

Example:
```bash
# Get all prompts
curl http://localhost:8000/api/prompts/

# Get dashboard data
curl http://localhost:8000/api/results/dashboard
```

---

## Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://react.dev/
- **Vite Documentation**: https://vitejs.dev/
- **SQLAlchemy Documentation**: https://docs.sqlalchemy.org/

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs in the terminal
3. Check the git repository issues section
4. Contact the development team

---

## Version Information

- **Python**: 3.11+
- **Node.js**: 18+
- **FastAPI**: Latest
- **React**: 18+
- **SQLite**: 3.x

---

**Last Updated**: December 2025
