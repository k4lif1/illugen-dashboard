# Illugen Dashboard

A tool for generating and scoring music loops using AI. It uses OpenAI to create composition plans and ElevenLabs to generate audio.

## Prerequisites

You need these installed on your computer before starting:

- **Python 3.10+** — [Download here](https://www.python.org/downloads/)
- **Node.js 18+** — [Download here](https://nodejs.org/)
- **Git** — [Download here](https://git-scm.com/downloads)

To check if you already have them, open a terminal and run:

```
python3 --version
node --version
git --version
```

If each one prints a version number, you're good.

## Step-by-Step Setup

### 1. Clone the repository

Open a terminal and run:

```
git clone https://github.com/k4lif1/illugen-dashboard.git
cd illugen-dashboard
```

### 2. Add the environment file

The `.env` file contains the API keys needed to run the app. **It was sent to you via Teams.**

1. Find the `.env` file you received on Teams
2. Copy it into the `illugen-dashboard` folder (the root of the project — the same folder that has this `README.md` in it)

If you open the `.env` file it should have lines like:

```
samplemakerOpenAiApiKey=sk-...
samplemakerElevenLabsApiKey=xi-...
```

**Do not share this file or commit it to git.**

### 3. Install backend (Python) dependencies

From the project root folder, run:

```
pip install -r backend/requirements.txt
```

If `pip` doesn't work, try `pip3` instead:

```
pip3 install -r backend/requirements.txt
```

### 4. Install frontend (Node.js) dependencies

```
cd frontend
npm install
cd ..
```

### 5. Start the backend server

```
python3 -m uvicorn backend.main:app --port 8000
```

You should see output like:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**Leave this terminal window open** — the backend needs to keep running.

### 6. Start the frontend (in a new terminal)

Open a **second terminal window**, navigate to the project folder, then run:

```
cd illugen-dashboard/frontend
npm run dev
```

You should see output like:

```
VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

### 7. Open the app

Open your browser and go to:

```
http://localhost:5173
```

You should see the Illugen Dashboard.

## Daily Usage

Every time you want to use the app, you need to start both servers:

1. **Terminal 1** (backend): from the project folder, run `python3 -m uvicorn backend.main:app --port 8000`
2. **Terminal 2** (frontend): from the project folder, run `cd frontend && npm run dev`
3. **Browser**: go to `http://localhost:5173`

To stop the servers, press `Ctrl+C` in each terminal window.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `command not found: python3` | Install Python from the link above |
| `command not found: node` or `npm` | Install Node.js from the link above |
| `Missing samplemakerOpenAiApiKey` | Make sure the `.env` file is in the project root folder |
| Backend won't start | Check that port 8000 isn't already in use — try closing other terminals first |
| Frontend shows connection errors | Make sure the backend is running in another terminal |
