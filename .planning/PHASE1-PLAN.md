# Phase 1: Foundation Setup — Detailed Plan

**Timeline:** Days 1-2 (4-6 hours)
**Status:** Ready for execution
**Updated:** 2026-04-19

---

## Overview

Phase 1 sets up the complete MVP foundation:
- ✅ Git repository & project structure
- ✅ Express.js backend skeleton
- ✅ React 18 + TailwindCSS frontend
- ✅ Deepgram API integration
- ✅ Ollama (local LLM) setup
- ✅ Documentation

**Key decision:** Using **Ollama (free, local)** instead of Claude API for MVP analysis.

---

## Task 1: Initialize Git & Project Structure (30 min)

### 1.1 Create directory structure
```bash
cd C:\Users\MSI\Transcription
mkdir backend frontend docs
```

### 1.2 Initialize Git
```bash
git init
git config user.name "Transcription MVP"
git config user.email "dev@transcription.local"
```

### 1.3 Create .gitignore
```
node_modules/
.env
.env.local
dist/
build/
.DS_Store
*.log
.vscode/
.idea/
.claude/
__pycache__/
*.pyc
.planning/
```

### 1.4 Create root README.md
```markdown
# Transcription AI Service

Convert voice messages to text + extract goals, tasks, and summaries automatically.

## Quick Start

### Prerequisites
- Node.js 18+
- Deepgram API key (free tier)
- Ollama (optional, for local analysis)

### Setup

1. **Clone and install**
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure .env**
   ```bash
   cp backend/.env.example backend/.env
   # Add your Deepgram API key
   ```

3. **Start services**
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev

   # Terminal 3 (optional): Ollama
   ollama serve
   ```

4. Open http://localhost:5173

## Architecture

- **Frontend:** React 18 + TailwindCSS (port 5173)
- **Backend:** Express.js (port 3000)
- **Transcription:** Deepgram API
- **Analysis:** Ollama (local) + Cloud Pro Claude (optional)
- **Database:** SQLite (MVP)

## API Endpoints

- `POST /api/transcribe` — Upload audio file
- `GET /api/transcribe/:jobId` — Get transcript status
- `POST /api/analyze` — Run Ollama analysis
- `POST /api/analyze-deep` — Request Cloud Pro analysis (optional)

## Development

```bash
# Backend logs
cd backend && npm run dev

# Frontend logs
cd frontend && npm run dev

# Run tests
npm test
```

## Deployment

See DEPLOY.md for production setup (Phase 2+).

## License

MIT
```

### 1.5 Create .env.example
```
# Backend
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite:./data/transcription.db

# Deepgram API
DEEPGRAM_API_KEY=your_key_here

# Ollama (local analysis)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Optional: Cloud Pro Claude analysis
# Set your chat webhook or use manual prompts
CLOUD_PRO_ENABLED=false
```

### 1.6 Initial Git commit
```bash
git add .gitignore README.md
git commit -m "Initial project structure"
```

**Success Criteria:**
- ✅ Git repo initialized
- ✅ Directory structure created
- ✅ Files committed

---

## Task 2: Express.js Backend Setup (1 hour)

### 2.1 Initialize Node project
```bash
cd backend
npm init -y
```

### 2.2 Install dependencies
```bash
npm install express dotenv cors morgan axios bull redis sqlite3
npm install --save-dev nodemon
```

### 2.3 Create backend structure
```bash
mkdir routes middleware models utils
touch index.js .env.example
```

### 2.4 Create backend/.env.example
```
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite:./data/transcription.db
DEEPGRAM_API_KEY=your_key_here
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

### 2.5 Create backend/index.js
```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Test Deepgram endpoint
app.post('/api/test-deepgram', (req, res) => {
  if (!process.env.DEEPGRAM_API_KEY) {
    return res.status(400).json({ error: 'Deepgram API key not configured' });
  }
  res.status(200).json({
    status: 'Deepgram API key is configured',
    apiUrl: 'https://api.deepgram.com'
  });
});

// Test Ollama endpoint
app.post('/api/test-ollama', (req, res) => {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  res.status(200).json({
    status: 'Ollama configuration',
    apiUrl: ollamaUrl,
    model: process.env.OLLAMA_MODEL || 'mistral'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
```

### 2.6 Update package.json scripts
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  }
}
```

### 2.7 Test backend
```bash
npm run dev
# In another terminal:
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2.8 Commit
```bash
cd ..
git add backend/
git commit -m "Add Express.js backend skeleton"
```

**Success Criteria:**
- ✅ Backend starts without errors
- ✅ `/health` endpoint returns 200 OK
- ✅ Can test Deepgram and Ollama configuration

---

## Task 3: React Frontend Setup (1 hour)

### 3.1 Create React app with Vite
```bash
cd frontend
npm create vite@latest . -- --template react
npm install
```

### 3.2 Install TailwindCSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3.3 Configure Tailwind (tailwind.config.js)
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 3.4 Update src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}
```

### 3.5 Create API client (src/api.js)
```javascript
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Transcription endpoints
export const transcribe = (file) => api.post('/transcribe', file, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const getStatus = (jobId) => api.get(`/transcribe/${jobId}`);

// Analysis endpoints
export const analyze = (transcript) => api.post('/analyze', { transcript });
export const analyzeDeep = (transcript) => api.post('/analyze-deep', { transcript });

// Test endpoints
export const testDeepgram = () => api.post('/test-deepgram');
export const testOllama = () => api.post('/test-ollama');
```

### 3.6 Create main App component (src/App.jsx)
```javascript
import { useState } from 'react';
import { testDeepgram, testOllama } from './api';

export default function App() {
  const [deepgramStatus, setDeepgramStatus] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTestDeepgram = async () => {
    setLoading(true);
    try {
      const res = await testDeepgram();
      setDeepgramStatus(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setDeepgramStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const handleTestOllama = async () => {
    setLoading(true);
    try {
      const res = await testOllama();
      setOllamaStatus(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setOllamaStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Transcription AI Service
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Deepgram Test */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Deepgram Setup</h2>
            <button
              onClick={handleTestDeepgram}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test Deepgram'}
            </button>
            {deepgramStatus && (
              <pre className="mt-4 bg-gray-100 p-3 rounded text-sm overflow-auto">
                {deepgramStatus}
              </pre>
            )}
          </div>

          {/* Ollama Test */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Ollama Setup</h2>
            <button
              onClick={handleTestOllama}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test Ollama'}
            </button>
            {ollamaStatus && (
              <pre className="mt-4 bg-gray-100 p-3 rounded text-sm overflow-auto">
                {ollamaStatus}
              </pre>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4">
          <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Get Deepgram API key from https://console.deepgram.com</li>
            <li>Install Ollama from https://ollama.ai (optional)</li>
            <li>Add API key to backend/.env</li>
            <li>Start backend and frontend servers</li>
            <li>Click test buttons above to verify setup</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
```

### 3.7 Install axios
```bash
npm install axios
```

### 3.8 Test frontend
```bash
npm run dev
# Open http://localhost:5173
```

### 3.9 Commit
```bash
cd ..
git add frontend/
git commit -m "Add React + TailwindCSS frontend skeleton"
```

**Success Criteria:**
- ✅ Frontend loads at http://localhost:5173
- ✅ No console errors
- ✅ Test buttons visible

---

## Task 4: Get API Credentials (30 min)

### 4.1 Deepgram API Key

1. Go to https://console.deepgram.com
2. Sign up (free tier: 25 hours/month, unlimited projects)
3. Create new project
4. Generate API key (keep it safe)
5. Copy key to `backend/.env`:
   ```
   DEEPGRAM_API_KEY=your_actual_key_here
   ```

### 4.2 Ollama Setup (Qwen2.5B for your hardware)

**Why Qwen2.5B:** 2.5B parameters, optimized for 4-6GB RAM, works on GTX 3050

1. Download Ollama from https://ollama.ai
2. Install and run `ollama serve`
3. In another terminal, pull Qwen2.5B model:
   ```bash
   ollama pull qwen:2.5b
   ```
   (Download: ~1.5GB, takes 2-5 minutes)

4. Verify it works:
   ```bash
   curl http://localhost:11434/api/generate -d '{"model":"qwen:2.5b","prompt":"Hello"}'
   ```

5. Update `backend/.env`:
   ```
   OLLAMA_API_URL=http://localhost:11434
   OLLAMA_MODEL=qwen:2.5b
   ```

**GPU Optimization (for RTX 3050):**
Create `%APPDATA%\ollama\ollama.exe.config` (or set env vars):
```
# Use GPU (CUDA)
OLLAMA_NUM_GPU=1
OLLAMA_MAX_LOADED_MODELS=1
```

**Performance Notes:**
- First run: ~10-15 seconds (loading model)
- Subsequent: ~5-10 seconds per analysis
- CPU fallback: ~20-30 seconds (if GPU runs out of memory)

### 4.3 Cloud Pro Claude (Optional)

For detailed analysis, you can manually send transcripts to this chat for analysis. We'll integrate a "Send to Analysis" feature in Phase 3.

**Success Criteria:**
- ✅ Deepgram API key obtained
- ✅ (Optional) Ollama installed locally
- ✅ Keys added to `.env`

---

## Task 5: Test API Credentials (1 hour)

### 5.1 Test Deepgram

```bash
# Create test-deepgram.js in backend/
cat > test-deepgram.js << 'EOF'
const axios = require('axios');
require('dotenv').config();

async function testDeepgram() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set');
    return;
  }

  try {
    // Test API connectivity
    const response = await axios.get('https://api.deepgram.com/v1/status', {
      headers: { 'Authorization': `Token ${apiKey}` }
    });

    console.log('✅ Deepgram API is working');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('❌ Deepgram API error:', err.message);
  }
}

testDeepgram();
EOF

node test-deepgram.js
```

Expected output:
```
✅ Deepgram API is working
{ status: 'OK', ... }
```

### 5.2 Test Ollama

```bash
# Create test-ollama.js in backend/
cat > test-ollama.js << 'EOF'
const axios = require('axios');
require('dotenv').config();

async function testOllama() {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';

  try {
    // Test Ollama connectivity
    const response = await axios.post(`${ollamaUrl}/api/generate`, {
      model: process.env.OLLAMA_MODEL || 'mistral',
      prompt: 'What is the capital of France?',
      stream: false
    });

    console.log('✅ Ollama is working');
    console.log('Response:', response.data.response);
  } catch (err) {
    console.error('⚠️ Ollama not available:', err.message);
    console.log('Install Ollama: https://ollama.ai');
  }
}

testOllama();
EOF

node test-ollama.js
```

### 5.3 Test from Frontend

1. Start both servers:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

2. Open http://localhost:5173

3. Click "Test Deepgram" and "Test Ollama" buttons

4. Check console for any errors

**Success Criteria:**
- ✅ Deepgram test returns 200 OK
- ✅ Ollama test passes (or gracefully fails if not installed)
- ✅ Frontend can connect to backend
- ✅ No CORS errors

---

## Task 6: Documentation & Final Setup (30 min)

### 6.1 Create SETUP.md
```markdown
# Setup Guide

## Prerequisites
- Node.js 18+ ([download](https://nodejs.org))
- Deepgram API key ([free](https://console.deepgram.com))
- Ollama (optional, [download](https://ollama.ai))

## Installation

### 1. Clone repo
```bash
git clone <repo-url>
cd transcription
```

### 2. Install dependencies
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 3. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your Deepgram API key
```

### 4. Start services
```bash
# Terminal 1: Backend (http://localhost:3000)
cd backend && npm run dev

# Terminal 2: Frontend (http://localhost:5173)
cd frontend && npm run dev

# Terminal 3 (optional): Ollama
ollama serve
```

### 5. Open browser
Navigate to http://localhost:5173

## Troubleshooting

**Backend won't start:**
- Check Node.js version: `node --version`
- Check port 3000 is not in use
- Check .env file has required keys

**Frontend won't load:**
- Check port 5173 is not in use
- Clear browser cache
- Check terminal for build errors

**Deepgram test fails:**
- Verify API key is correct
- Check internet connection
- Test key at https://console.deepgram.com

**Ollama test fails:**
- Ollama is optional for MVP
- Install from https://ollama.ai
- Run: `ollama serve` in separate terminal
- Run: `ollama pull mistral` to download model

## Next Steps
See ARCHITECTURE.md for system design details.
```

### 6.2 Create ARCHITECTURE.md
```markdown
# System Architecture

## Overview

```
User Browser
    ↓
React Frontend (port 5173)
    ↓
Express.js Backend (port 3000)
    ├─ Deepgram API (transcribe audio)
    ├─ Ollama (quick analysis, local)
    └─ Cloud Pro Claude (detailed analysis, optional)
    ↓
SQLite Database
```

## Components

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** TailwindCSS
- **State:** React Context
- **HTTP Client:** Axios

### Backend
- **Framework:** Express.js
- **Async Jobs:** Bull.js (Redis-backed)
- **Database:** SQLite (MVP)
- **External APIs:** Deepgram, Ollama, Claude (optional)

### APIs

#### POST /api/transcribe
Upload audio file for transcription
- Input: FormData with audio file
- Returns: { jobId, status, createdAt }
- Processing: Deepgram API

#### GET /api/transcribe/:jobId
Get transcription status and results
- Returns: { jobId, status, transcript, analysis, error }

#### POST /api/analyze
Quick analysis using local Ollama
- Input: { transcript }
- Returns: { goals, tasks, keyPoints, summary }

#### POST /api/analyze-deep
Detailed analysis (Cloud Pro Claude)
- Input: { transcript }
- Returns: { enrichedGoals, enrichedTasks, insights }

## Data Flow

1. **Upload Phase**
   - User uploads audio file
   - Frontend sends to backend
   - Backend stores temporarily

2. **Transcription Phase**
   - Backend calls Deepgram API
   - Transcript returned with timestamps
   - Stored in database

3. **Analysis Phase**
   - Backend calls Ollama (quick)
   - Optional: User can request Cloud Pro analysis
   - Results merged and displayed

4. **Export Phase**
   - User can export as JSON, Markdown, or to Obsidian

## Security Notes

- API keys stored in .env (never committed)
- Audio files deleted after 7 days
- No authentication required for MVP
- CORS enabled for localhost only (development)

## Performance

- Target: < 2 minutes end-to-end for 10-minute audio
- Deepgram: 1-10 seconds (batch processing)
- Ollama: 5-30 seconds (depends on hardware)
- Claude: 10-30 seconds (optional, manual)

## Future Improvements (Phase 2+)

- User authentication
- Database persistence
- Real-time transcription (streaming)
- Advanced speaker diarization
- Custom analysis templates
- Batch processing (100+ files)
```

### 6.3 Update root package.json
```json
{
  "name": "transcription-ai-service",
  "version": "0.1.0",
  "description": "Convert voice messages to text + extract goals, tasks, summaries",
  "scripts": {
    "install-all": "npm install && cd backend && npm install && cd ../frontend && npm install",
    "dev": "echo 'Start backend: cd backend && npm run dev' && echo 'Start frontend: cd frontend && npm run dev'",
    "test": "echo 'Tests coming in Phase 2'"
  }
}
```

### 6.4 Final Git commit
```bash
git add SETUP.md ARCHITECTURE.md package.json
git commit -m "Phase 1: Foundation setup complete

- Git repository initialized
- Express.js backend with health check
- React + TailwindCSS frontend
- Deepgram API integration skeleton
- Ollama local analysis support
- Complete documentation"
```

### 6.5 Verify everything works

```bash
# 1. Check git history
git log --oneline
# Should show 3+ commits

# 2. Start backend
cd backend && npm run dev
# Should print: ✅ Backend running on http://localhost:3000

# 3. In new terminal, start frontend
cd frontend && npm run dev
# Should print: VITE v4.x.x ready in X ms

# 4. Test endpoints
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Success Criteria:**
- ✅ All documentation written
- ✅ Git history shows 3+ commits
- ✅ Both servers can start simultaneously
- ✅ Health check works
- ✅ Frontend loads without errors

---

## Phase 1 Complete! ✅

### What's Done
- ✅ Project structure initialized
- ✅ Git repository with initial commits
- ✅ Express.js backend skeleton
- ✅ React + TailwindCSS frontend
- ✅ Deepgram API key configured
- ✅ Ollama setup instructions
- ✅ Complete documentation

### What's Next (Phase 2)
- Audio upload endpoint
- Deepgram transcription integration
- Job tracking system
- Frontend upload UI

### Total Time
Estimated 4-6 hours

### Commands to Remember
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Both (in separate terminals)
cd backend && npm run dev &
cd frontend && npm run dev &
```

---

**Status:** Ready for Phase 2 execution
**Next:** `/gsd-plan-phase 2` for Phase 2 planning
