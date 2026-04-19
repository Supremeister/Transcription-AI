# Phase 1: Foundation Setup — PLAN

**Phase:** 01-Foundation-Setup
**Timeline:** Days 1-2 (estimated 6-8 hours)
**Status:** Ready for execution
**Owner:** User

---

## Phase Overview

### Goal
Set up the complete development foundation for the transcription service MVP. After Phase 1, the developer (you) should have:
- A working git repository with project structure
- Valid API credentials for Deepgram and Claude
- A local development environment (backend + frontend) that compiles and runs
- Verified that API calls work correctly
- All configuration files and environment templates in place

### Success Criteria
- [x] Git repository initialized with first commit
- [x] Backend server starts and responds to health check
- [x] Frontend dev server runs without errors
- [x] Deepgram API test call succeeds (audio transcription works)
- [x] Claude API test call succeeds (analysis works)
- [x] Environment variables configured locally (.env file present)
- [x] README.md with setup instructions for Phase 2

### Deliverables
1. `.env.example` with all required API keys
2. Backend skeleton (Express.js or FastAPI) with health endpoint
3. Frontend skeleton (React with TailwindCSS)
4. Test scripts for API validation
5. Git repository with clean history

### Technology Decisions (from Research)
- **ASR:** Deepgram API (primary) with Faster-Whisper fallback for testing
- **LLM:** Claude Sonnet (via Anthropic API)
- **Backend:** Node.js + Express.js (faster setup, best Deepgram SDK support)
- **Frontend:** React 18 + TailwindCSS (standard, quick prototyping)
- **Database:** PostgreSQL (for job tracking in Phase 2; SQLite for MVP if needed)
- **Job Queue:** Bull.js (Node.js async job handling, Redis-based)

### Phase Dependencies
- None (Phase 1 is the foundation)

### Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| API credentials delayed | Use placeholder keys, swap in real keys before Phase 2 |
| Local environment setup complexity | Provide Docker setup option as backup |
| Node/Python version conflicts | Lock versions in package.json / requirements.txt |

---

## Task Breakdown

Each task is atomic, completable in 1-2 hours, with clear dependencies.

### Task 1: Initialize Git Repository & Project Structure

**Objective:** Create the foundational directory structure and git history.

**Time Estimate:** 30 minutes

**Acceptance Criteria:**
- Git repo initialized with `.gitignore`
- Directory structure matches backend/frontend separation
- `.env.example` created with all required keys
- First commit made with message "chore: initialize project structure"
- No secret keys committed to git

**Steps:**

1. Initialize git repository:
```bash
cd ~/transcription-service  # or your project directory
git init
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

2. Create `.gitignore`:
```
node_modules/
__pycache__/
*.pyc
.env
.env.local
.DS_Store
dist/
build/
venv/
env/
.vscode/
.idea/
*.log
.next/
out/
.vercel/
.cache/
```

3. Create directory structure:
```bash
mkdir -p backend frontend docs public
mkdir -p backend/src/{routes,middleware,utils,services}
mkdir -p frontend/src/{components,pages,hooks,utils,styles}
mkdir -p .planning/{research,phases}
touch .planning/STATE.md
```

4. Create `.env.example`:
```
# Backend Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Deepgram API
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_URL=https://api.deepgram.com/v1

# Claude API
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/transcription
# For MVP with SQLite: DATABASE_URL=sqlite:///./transcription.db

# Redis (for Bull queue)
REDIS_URL=redis://localhost:6379

# Frontend
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_ENV=development

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=100

# Optional: Faster-Whisper fallback
ENABLE_LOCAL_FALLBACK=false
FASTER_WHISPER_MODEL=base
```

5. Create `README.md` with setup instructions (see Template section below)

6. Make first commit:
```bash
git add .
git commit -m "chore: initialize project structure"
```

**Verification:**
```bash
# Verify structure
ls -la  # Should see: backend/, frontend/, docs/, .env.example, README.md
git log --oneline  # Should show initial commit
```

---

### Task 2: Set Up Backend (Express.js Skeleton)

**Objective:** Create a working Express.js server with health endpoint and API structure.

**Time Estimate:** 1 hour

**Acceptance Criteria:**
- Backend server starts without errors
- `GET /health` returns `{ status: "ok" }`
- Environment variables are loaded correctly
- Request/response logging is working
- Error handling middleware is present
- Server listens on port 3000 (configurable)

**Steps:**

1. Initialize Node.js project:
```bash
cd backend
npm init -y
```

2. Install dependencies:
```bash
npm install express dotenv axios cors helmet morgan
npm install --save-dev nodemon prettier eslint
```

3. Create `backend/.env` (copy from `.env.example`):
```bash
cp ../.env.example .env
```

4. Create `backend/src/server.js`:
```javascript
require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes (to be implemented in Phase 2)
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/analyze', require('./routes/analyze'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
```

5. Create `backend/src/routes/transcribe.js`:
```javascript
const express = require('express');
const router = express.Router();

// Placeholder route for Phase 2
router.post('/', async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

router.get('/:jobId', async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

module.exports = router;
```

6. Create `backend/src/routes/analyze.js`:
```javascript
const express = require('express');
const router = express.Router();

// Placeholder route for Phase 2
router.post('/', async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

module.exports = router;
```

7. Create `backend/package.json` scripts (update the existing):
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "echo \"Tests not yet implemented\" && exit 0"
  }
}
```

8. Create `backend/.gitignore`:
```
node_modules/
.env
.env.local
npm-debug.log*
dist/
```

9. Test backend:
```bash
npm run dev
# In another terminal:
curl http://localhost:3000/health
```

**Verification:**
```bash
npm run dev
# Should see: ✓ Server running on http://localhost:3000
# Visit http://localhost:3000/health → should return { status: "ok", ... }
```

---

### Task 3: Set Up Frontend (React + TailwindCSS Skeleton)

**Objective:** Create a working React app with TailwindCSS and basic layout.

**Time Estimate:** 1 hour

**Acceptance Criteria:**
- React dev server starts without errors
- Frontend loads on `http://localhost:3000`
- TailwindCSS is working (basic styles apply)
- Environment variables are loaded correctly
- App has basic layout structure (header, main, footer)

**Steps:**

1. Create React app:
```bash
cd frontend
npx create-react-app . --template
# Or use Vite (faster):
npm create vite@latest . -- --template react
cd ..
```

2. Install additional dependencies:
```bash
cd frontend
npm install tailwindcss postcss autoprefixer axios zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

3. Configure TailwindCSS in `frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

4. Update `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
}
```

5. Create `frontend/.env.local` (based on `.env.example`):
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_ENV=development
```

6. Create `frontend/src/App.jsx`:
```javascript
import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check backend health
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/health');
        const data = await response.json();
        setHealthStatus(data);
      } catch (error) {
        console.error('Backend not available:', error);
        setHealthStatus({ error: 'Backend connection failed' });
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Transcription AI Service
          </h1>
          <p className="text-gray-600 mt-2">
            Convert voice to structured insights
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Phase 1: Setup Status</h2>

          {loading ? (
            <p className="text-gray-600">Checking backend health...</p>
          ) : healthStatus?.error ? (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-800">
                ❌ Backend Error: {healthStatus.error}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Make sure backend is running: `cd backend && npm run dev`
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-green-800 font-semibold">
                ✓ Backend is healthy
              </p>
              <div className="mt-3 text-sm text-gray-700">
                <p><strong>Status:</strong> {healthStatus?.status}</p>
                <p><strong>Environment:</strong> {healthStatus?.environment}</p>
                <p><strong>Uptime:</strong> {Math.round(healthStatus?.uptime || 0)}s</p>
              </div>
            </div>
          )}

          {/* Phase 1 Checklist */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Phase 1 Checklist</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Git repository initialized</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Backend skeleton created</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Frontend skeleton created</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>Deepgram API credentials configured</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>Claude API credentials configured</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>API calls tested and verified</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>Transcription AI Service — Phase 1 Setup</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
```

7. Update `frontend/src/App.css`:
```css
/* Empty — all styles via TailwindCSS */
```

8. Test frontend:
```bash
npm run dev
# Should see: ✓ Local: http://localhost:5173
```

**Verification:**
```bash
# In frontend/ directory:
npm run dev
# Should see: Network: use --host to expose
# Visit http://localhost:5173 (or port shown)
```

---

### Task 4: API Credentials Setup & Configuration

**Objective:** Obtain and validate API keys for Deepgram and Claude.

**Time Estimate:** 30 minutes (credential acquisition depends on provider response time)

**Acceptance Criteria:**
- Deepgram API key obtained and saved to `.env`
- Claude API key obtained and saved to `.env`
- Both keys are valid (verified by API calls in Task 5)
- `.env` file is in `.gitignore` (no secrets in git)

**Steps:**

1. Get Deepgram API Key:
   - Visit https://console.deepgram.com/signup
   - Sign up for free account (25 hours/month free tier)
   - Go to **Credentials** → **API Keys**
   - Click **Create New API Key**
   - Copy the key (you'll only see it once)
   - Add to `.env`:
   ```
   DEEPGRAM_API_KEY=your_actual_key_here
   ```

2. Get Claude API Key:
   - Visit https://console.anthropic.com/
   - Sign up or log in to your Anthropic account
   - Go to **API Keys** in the dashboard
   - Click **Create Key**
   - Copy the key
   - Add to `.env`:
   ```
   ANTHROPIC_API_KEY=your_actual_key_here
   ```

3. Verify `.env` is in `.gitignore`:
```bash
cat .gitignore | grep "^\.env"
# Should output: .env
```

4. Document the credential locations in `SETUP.md` (for future reference):
```markdown
# API Credentials Setup

## Deepgram
- Dashboard: https://console.deepgram.com
- API Key location: Credentials → API Keys
- Free tier: 25 hours/month
- Set in: DEEPGRAM_API_KEY

## Claude
- Dashboard: https://console.anthropic.com
- API Key location: API Keys section
- Set in: ANTHROPIC_API_KEY

## Getting Keys
1. Visit provider dashboard
2. Create new API key
3. Copy to .env (never commit)
4. Test via Task 5
```

**Verification:**
```bash
# Check .env file exists
test -f .env && echo "✓ .env file present" || echo "✗ .env missing"

# Check keys are set (without exposing them)
grep -c "DEEPGRAM_API_KEY" .env && echo "✓ Deepgram key set"
grep -c "ANTHROPIC_API_KEY" .env && echo "✓ Claude key set"
```

---

### Task 5: Test API Credentials (Deepgram & Claude)

**Objective:** Verify that API keys work with actual API calls.

**Time Estimate:** 1 hour

**Acceptance Criteria:**
- Deepgram transcribes a sample audio file successfully
- Claude analyzes sample text successfully
- Test results are logged and saved
- Both APIs return expected JSON responses
- No errors in API calls

**Steps:**

1. Create `backend/src/utils/api-test.js`:
```javascript
require('dotenv').config({ path: '../../.env' });
const axios = require('axios');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function testDeepgramAPI() {
  console.log(`\n${colors.blue}=== Testing Deepgram API ===${colors.reset}`);

  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) {
    console.error(`${colors.red}✗ DEEPGRAM_API_KEY not set${colors.reset}`);
    return false;
  }

  try {
    // Use a public sample audio file
    const sampleAudioUrl = 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';

    console.log(`Sending transcription request to Deepgram...`);
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=en',
      { url: sampleAudioUrl },
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      const transcript = response.data.results.channels[0].alternatives[0].transcript;
      console.log(`${colors.green}✓ Deepgram API working${colors.reset}`);
      console.log(`  Transcript (first 100 chars): "${transcript.substring(0, 100)}..."`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response format${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Deepgram API error: ${error.message}${colors.reset}`);
    if (error.response?.data) {
      console.error(`  Details:`, error.response.data);
    }
    return false;
  }
}

async function testClaudeAPI() {
  console.log(`\n${colors.blue}=== Testing Claude API ===${colors.reset}`);

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';

  if (!ANTHROPIC_API_KEY) {
    console.error(`${colors.red}✗ ANTHROPIC_API_KEY not set${colors.reset}`);
    return false;
  }

  try {
    console.log(`Sending analysis request to Claude (${MODEL})...`);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: 'Extract goals from this text: "We need to launch the API by Friday. Maria will handle authentication. Testing starts Monday."'
          }
        ]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );

    if (response.data?.content?.[0]?.text) {
      const text = response.data.content[0].text;
      console.log(`${colors.green}✓ Claude API working${colors.reset}`);
      console.log(`  Response (first 100 chars): "${text.substring(0, 100)}..."`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response format${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Claude API error: ${error.message}${colors.reset}`);
    if (error.response?.data) {
      console.error(`  Details:`, error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log(`${colors.yellow}Starting API credential tests...${colors.reset}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const deepgramOk = await testDeepgramAPI();
  const claudeOk = await testClaudeAPI();

  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`Deepgram: ${deepgramOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);
  console.log(`Claude:   ${claudeOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);

  if (deepgramOk && claudeOk) {
    console.log(`\n${colors.green}All API tests passed! Ready for Phase 2.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}Some tests failed. Check credentials and try again.${colors.reset}`);
    process.exit(1);
  }
}

runTests();
```

2. Add test script to `backend/package.json`:
```json
{
  "scripts": {
    "test:api": "node src/utils/api-test.js"
  }
}
```

3. Run the test:
```bash
cd backend
npm run test:api
```

4. Capture test output and save to `backend/TEST_RESULTS.md`:
```markdown
# Phase 1 API Test Results

Date: 2026-04-19
Environment: development

## Deepgram API Test
- Status: ✓ PASSED
- Audio transcribed successfully
- Sample output: "[transcript sample]"

## Claude API Test
- Status: ✓ PASSED
- Analysis completed successfully
- Sample output: "[analysis sample]"

## Summary
Both APIs are configured correctly and ready for Phase 2.
```

**Verification:**
```bash
cd backend
npm run test:api
# Should output:
# ✓ Deepgram API working
# ✓ Claude API working
# All API tests passed! Ready for Phase 2.
```

---

### Task 6: Documentation & Project Setup Guide

**Objective:** Create comprehensive setup documentation for developers (future reference).

**Time Estimate:** 30 minutes

**Acceptance Criteria:**
- README.md includes setup instructions
- ARCHITECTURE.md explains project structure
- CONTRIBUTING.md has development guidelines
- SETUP.md has credential setup steps
- All files are clear and easy to follow

**Steps:**

1. Create `README.md` in project root:
```markdown
# Transcription AI Service

Convert voice recordings into structured insights (transcript + analysis).

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- API keys from Deepgram and Anthropic (Claude)

### Installation

1. **Clone and setup:**
```bash
git clone [your-repo-url]
cd transcription-service
cp .env.example .env
```

2. **Add API keys:**
```bash
# Edit .env with your Deepgram and Claude API keys
nano .env
```

3. **Install dependencies:**
```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

4. **Start development servers:**
```bash
# Terminal 1: Backend (port 3000)
cd backend && npm run dev

# Terminal 2: Frontend (port 5173 or 3000)
cd frontend && npm run dev
```

5. **Verify setup:**
```bash
curl http://localhost:3000/health
# Should return: { "status": "ok", ... }
```

6. **Test APIs:**
```bash
cd backend && npm run test:api
```

## Project Structure

```
transcription-service/
├── backend/              # Express.js server
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Express middleware
│   │   └── utils/       # Helper functions
│   └── package.json
├── frontend/            # React app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   └── utils/       # Helper functions
│   └── package.json
├── .planning/           # Planning documents
├── docs/                # Architecture & guides
├── .env.example         # Environment template
└── README.md
```

## Phase 1 Status: Complete ✓

- [x] Git repository initialized
- [x] Backend skeleton (Express.js)
- [x] Frontend skeleton (React + TailwindCSS)
- [x] API credentials configured
- [x] API tests passing
- [x] Documentation complete

## Next Steps: Phase 2

In Phase 2, you'll implement:
- File upload endpoint
- Deepgram transcription integration
- Job tracking system
- Frontend upload UI

See `.planning/ROADMAP.md` for the full roadmap.

## Development

### Backend API Endpoints

| Method | Endpoint | Status | Phase |
|--------|----------|--------|-------|
| POST | /api/transcribe | TODO | 2 |
| GET | /api/transcribe/:jobId | TODO | 2 |
| POST | /api/analyze | TODO | 3 |

### Environment Variables

See `.env.example` for all available variables.

### Contributing

See `CONTRIBUTING.md` for development guidelines.

## Troubleshooting

### Backend won't start
```bash
cd backend
npm install
npm run dev
```

### Frontend won't load
```bash
cd frontend
npm install
npm run dev
```

### API tests fail
1. Check API keys in `.env`
2. Verify internet connection
3. Run tests again: `npm run test:api`

## License

MIT

## Support

For issues or questions, check `.planning/STATE.md` or contact the project owner.
```

2. Create `docs/ARCHITECTURE.md`:
```markdown
# Project Architecture

## Overview

```
User Browser
     ↓
  React Frontend (port 5173)
     ↓
Express.js Backend (port 3000)
     ↓
    ├─ Deepgram API (transcription)
    ├─ Claude API (analysis)
    └─ Database (job tracking, results)
```

## Components

### Frontend (React)
- **Upload UI**: Drag-drop file upload
- **Results Panel**: Display transcript + analysis
- **Status Indicator**: Real-time job progress

### Backend (Express.js)
- **Health Endpoint** (`/health`): Server status
- **Transcription Route** (`/api/transcribe`): Handle audio uploads
- **Analysis Route** (`/api/analyze`): Process transcripts
- **Queue System**: Bull.js for async job processing

### External APIs
- **Deepgram**: Speech-to-text transcription
- **Claude (Anthropic)**: Content analysis and extraction

### Database
- **PostgreSQL** (production) or **SQLite** (MVP): Store jobs, transcripts, analysis results

## Data Flow

1. User uploads audio file
2. Backend receives file, stores temporarily
3. Backend queues transcription job (Bull.js)
4. Deepgram transcribes audio → returns transcript
5. Backend queues analysis job
6. Claude analyzes transcript → extracts goals, tasks, summary
7. Results stored in database
8. Frontend polls for results
9. Results displayed to user

## Technology Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TailwindCSS | Fast prototyping, popular, good component model |
| Backend | Express.js (Node.js) | Best Deepgram SDK, async-first, JSON-native |
| ASR | Deepgram API | Cost/speed/accuracy balance |
| LLM | Claude Sonnet API | JSON output, Russian support, cost-effective |
| Queue | Bull.js | Redis-backed, Node.js native, reliable |
| Database | PostgreSQL (or SQLite for MVP) | Relational, JSONB support, scalable |

## Next Steps (Phase 2+)

- Add Redis for job queue
- Implement database migrations
- Add authentication (optional for MVP)
- Deploy to production (Railway + Vercel)
```

3. Create `docs/CONTRIBUTING.md`:
```markdown
# Contributing Guide

## Development Setup

See `README.md` for initial setup.

## Code Standards

### Backend (Node.js/Express)
- Use async/await (no callbacks)
- Handle errors with try/catch
- Log important events
- Validate input before processing

Example:
```javascript
router.post('/api/transcribe', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Missing file' });

    const job = await transcribeQueue.add({ file });
    res.json({ jobId: job.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
```

### Frontend (React)
- Use functional components + hooks
- Keep components small (<100 lines)
- Use TailwindCSS for styling (no CSS files)
- Handle loading/error states

### Git Commits
Format: `type(scope): description`
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Setup, dependencies
- `docs`: Documentation
- `test`: Tests

Example:
```
feat(transcribe): add file upload endpoint
chore(deps): update express to v4.19
docs: add architecture diagram
```

## Testing

Run API tests before commits:
```bash
npm run test:api
```

## Questions?

Check `.planning/STATE.md` for project decisions and blockers.
```

4. Create `.planning/01-PHASE-SUMMARY.md`:
```markdown
# Phase 1 Execution Summary

**Date Completed:** 2026-04-19
**Status:** ✓ COMPLETE

## Deliverables

- [x] Git repository initialized
- [x] `.env.example` with all required keys
- [x] Backend skeleton (Express.js)
- [x] Frontend skeleton (React + TailwindCSS)
- [x] API credentials (Deepgram + Claude)
- [x] API test results: Both PASS
- [x] Documentation (README, ARCHITECTURE, CONTRIBUTING)

## Verification Results

```
✓ Backend health check: OK
✓ Frontend loads without errors: OK
✓ Deepgram API test: PASS
✓ Claude API test: PASS
✓ All files committed to git: OK
```

## Time Summary

| Task | Time | Status |
|------|------|--------|
| 1. Git setup | 0:30 | ✓ |
| 2. Backend skeleton | 1:00 | ✓ |
| 3. Frontend skeleton | 1:00 | ✓ |
| 4. API credentials | 0:30 | ✓ |
| 5. API tests | 1:00 | ✓ |
| 6. Documentation | 0:30 | ✓ |
| **Total** | **4:30** | ✓ |

## Key Decisions Made

1. **Backend:** Express.js (vs FastAPI) — Reason: Better Deepgram SDK, faster dev
2. **Frontend:** React (vs Vue) — Reason: Larger ecosystem, TailwindCSS integration
3. **ASR:** Deepgram (vs Google Cloud) — Reason: Cost/speed balance, good for MVP
4. **LLM:** Claude Sonnet (vs GPT-4) — Reason: JSON output, cost-effective

## Next Phase: Phase 2

Start Phase 2 once verified:
- [x] All tests pass
- [x] Both servers start without errors
- [x] Backend responds to requests
- [x] Frontend loads and detects backend

See `ROADMAP.md` Phase 2 for detailed task breakdown.
```

5. Commit everything:
```bash
git add README.md docs/ .planning/01-PHASE-SUMMARY.md
git commit -m "docs: add project documentation and setup guides"
git log --oneline  # Should see multiple commits
```

**Verification:**
```bash
# Check README exists
test -f README.md && echo "✓ README present"

# Check docs folder
test -d docs && test -f docs/ARCHITECTURE.md && echo "✓ Architecture docs present"

# Check git history
git log --oneline | head -5
```

---

## Execution Order

Execute tasks in this order (they have dependencies):

1. **Task 1** (Git setup) — Foundation, must be first
2. **Task 2** (Backend skeleton) — Independent after Task 1
3. **Task 3** (Frontend skeleton) — Independent after Task 1
4. **Task 4** (API credentials) — Can run in parallel with Tasks 2-3
5. **Task 5** (API tests) — Requires Task 4 and Task 2
6. **Task 6** (Documentation) — Can run anytime, last for safety

**Parallel Execution (recommended):**
- Terminal 1: Task 2 (backend setup)
- Terminal 2: Task 3 (frontend setup)
- Terminal 3: Task 4 (get API credentials, Task 1 must complete first)
- Then: Task 5 (test APIs)
- Finally: Task 6 (document)

---

## Verification Checklist

Before moving to Phase 2, verify:

```bash
# 1. Backend health
curl http://localhost:3000/health
# Should return: { "status": "ok", ... }

# 2. Frontend loads
curl -s http://localhost:5173 | grep -c "Transcription AI Service"
# Should return: 1 (page loaded)

# 3. API tests pass
cd backend && npm run test:api
# Should show: All API tests passed!

# 4. Git history
git log --oneline | wc -l
# Should be: ≥ 2 commits

# 5. Files exist
test -f .env && test -f README.md && test -d docs && echo "✓ All files present"

# 6. Node modules present
test -d backend/node_modules && test -d frontend/node_modules && echo "✓ Dependencies installed"
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Backend won't start | Check port 3000 is not in use: `lsof -i :3000` |
| Frontend shows error | Clear node_modules: `rm -rf node_modules && npm install` |
| API keys rejected | Verify keys in `.env` (copy from provider dashboard, no spaces) |
| Port already in use | Change PORT in `.env` to unused port (e.g., 3001) |
| Git not initialized | Run: `git init` in project root |
| Node version issue | Check `node --version` (should be 18+) |

---

## Success Criteria

Phase 1 is complete when:

1. ✓ Git repository has 2+ commits
2. ✓ Backend server starts and responds to `/health`
3. ✓ Frontend dev server starts and loads without errors
4. ✓ Deepgram API test passes
5. ✓ Claude API test passes
6. ✓ `.env` file is present with valid API keys
7. ✓ `.env` is in `.gitignore` (no secrets in git)
8. ✓ Documentation is complete (README, ARCHITECTURE, CONTRIBUTING)
9. ✓ All code is committed to git

**Estimated time:** 4-6 hours

---

## What's NOT Included in Phase 1

These will be in Phase 2+:

- ✗ Database setup (will use in-memory for Phase 1 testing)
- ✗ File upload endpoint (Phase 2)
- ✗ Transcription integration (Phase 2)
- ✗ Analysis pipeline (Phase 3)
- ✗ Frontend upload UI (Phase 2)
- ✗ Job tracking (Phase 2)
- ✗ Authentication (Phase 4+)
- ✗ Deployment (Phase 6)

---

## Key References

- **Deepgram Docs:** https://developers.deepgram.com/
- **Anthropic Claude Docs:** https://docs.anthropic.com/
- **Express.js Docs:** https://expressjs.com/
- **React Docs:** https://react.dev/
- **TailwindCSS Docs:** https://tailwindcss.com/
- **Bull.js Docs:** https://docs.bullmq.io/

---

**Phase 1 Plan Created:** 2026-04-19
**Status:** Ready for execution
**Next:** Start with Task 1
