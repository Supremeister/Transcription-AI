# Setup Instructions

Complete guide to set up the Transcription AI Service for development.

## Prerequisites

- **Node.js 18+** - Download from https://nodejs.org/
- **npm 9+** - Included with Node.js
- **Git** - For version control
- **Code Editor** - VS Code recommended
- **API Keys** - Deepgram and Claude (see API-SETUP.md)

### Verify Prerequisites

```bash
node --version     # Should be v18 or higher
npm --version      # Should be v9 or higher
git --version      # Should be v2 or higher
```

## Step 1: Clone and Initialize Project

```bash
# Clone the repository
git clone https://github.com/yourname/transcription-service.git
cd transcription-service

# Copy environment template
cp .env.example .env
```

## Step 2: Get API Keys

See `docs/API-SETUP.md` for detailed instructions.

**Quick Summary:**
1. Get Deepgram key from https://console.deepgram.com
2. Get Claude key from https://console.anthropic.com
3. Add both to `.env` in project root

```bash
# Edit .env and add your keys
nano .env
```

Expected format:
```
DEEPGRAM_API_KEY=sk-xxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

## Step 3: Install Backend Dependencies

```bash
# Navigate to backend
cd backend

# Install npm packages
npm install

# Return to project root
cd ..
```

**Expected output:** "added XXX packages"

If you see errors, try:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
cd ..
```

## Step 4: Install Frontend Dependencies

```bash
# Navigate to frontend
cd frontend

# Install npm packages
npm install

# Return to project root
cd ..
```

**Expected output:** "added XXX packages"

If you see errors, try:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

## Step 5: Verify Backend Setup

```bash
# Terminal 1: Start backend
cd backend
npm run dev
```

**Expected output:**
```
✓ Server running on http://localhost:3000
✓ Environment: development
✓ Health check: http://localhost:3000/health
```

**Verify it's working:**
```bash
# Terminal 2: Test health endpoint
curl http://localhost:3000/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-04-19T08:10:56.569Z","uptime":1.401009,"environment":"development"}
```

## Step 6: Verify Frontend Setup

```bash
# Terminal 2 (or new terminal): Start frontend
cd frontend
npm run dev
```

**Expected output:**
```
✓ Local:   http://localhost:5173/
```

**Verify it's working:**
- Open http://localhost:5173 in browser
- Should see: "Transcription AI Service" heading
- Should show: "✓ Backend is healthy" message

## Step 7: Test API Credentials

Once both backend and frontend are running:

```bash
# Terminal 3: Test API credentials
cd backend
npm run test:api
```

**Expected output (if keys are configured):**
```
✓ Deepgram API working
✓ Claude API working
All API tests passed! Ready for Phase 2.
```

If tests fail, check:
1. API keys in `.env` are correct
2. Keys have no extra spaces
3. Internet connection is working
4. API quotas are available

## Development Workflow

### Running Both Servers

You need two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the application:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health check: http://localhost:3000/health

### Making Changes

**Backend changes:**
1. Edit files in `backend/src/`
2. Nodemon auto-restarts server
3. Test with curl or frontend

**Frontend changes:**
1. Edit files in `frontend/src/`
2. Vite hot-reloads in browser
3. Check console for errors

### Stopping Servers

Press `Ctrl+C` in each terminal to stop the servers.

## Project Structure

```
transcription-service/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app
│   │   ├── routes/            # API routes
│   │   │   ├── transcribe.js
│   │   │   └── analyze.js
│   │   ├── utils/             # Helpers
│   │   │   └── api-test.js
│   │   └── middleware/        # Middleware
│   ├── package.json
│   ├── .env                   # Local (git ignored)
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # Entry point
│   │   ├── App.jsx            # Root component
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Helpers
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .gitignore
│
├── docs/
│   ├── ARCHITECTURE.md        # System design
│   ├── API-SETUP.md          # API key setup
│   ├── CONTRIBUTING.md        # Development guide
│   └── SETUP.md              # This file
│
├── .env                       # Environment variables (git ignored)
├── .env.example              # Template
├── .gitignore
├── README.md
└── .planning/
    ├── STATE.md
    ├── ROADMAP.md
    └── REQUIREMENTS.md
```

## Environment Variables

See `.env.example` for all available variables.

**Key variables for Phase 1:**

| Variable | Purpose | Example |
|----------|---------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Backend port | 3000 |
| DEEPGRAM_API_KEY | Speech-to-text | sk-xxx... |
| ANTHROPIC_API_KEY | Analysis LLM | sk-ant-xxx... |
| REACT_APP_API_URL | Frontend API URL | http://localhost:3000/api |

## Troubleshooting

### Backend won't start

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:** Port 3000 is already in use.
```bash
# Option 1: Stop other service on port 3000
lsof -i :3000
kill -9 <PID>

# Option 2: Use different port
PORT=3001 npm run dev
```

**Error:** `Cannot find module 'express'`

**Solution:** Dependencies not installed.
```bash
cd backend
npm install
```

### Frontend won't load

**Error:** `Failed to load module`

**Solution:** Dependencies not installed or build failed.
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Blank page or 404:**

**Solution:** Check that backend is running.
```bash
# Terminal 1: Make sure backend is running
cd backend
npm run dev

# Terminal 2: Check health endpoint
curl http://localhost:3000/health
```

### API tests fail

**Error:** `DEEPGRAM_API_KEY not set`

**Solution:** `.env` file missing or not configured.
```bash
# Check .env exists
ls -la .env

# Check keys are set
grep DEEPGRAM_API_KEY .env
grep ANTHROPIC_API_KEY .env
```

**Error:** `401 Unauthorized`

**Solution:** API keys are invalid or expired.
1. Check keys in provider dashboards (Deepgram, Anthropic)
2. Generate new keys if needed
3. Update `.env`
4. Restart backend: `npm run dev`

### Node version issues

**Error:** `node: command not found`

**Solution:** Node.js not installed.
1. Download Node.js 18+ from https://nodejs.org/
2. Install and restart terminal
3. Verify: `node --version`

**Error:** `npm: command not found`

**Solution:** npm not installed (should come with Node.js).
1. Reinstall Node.js from https://nodejs.org/
2. Make sure to check "npm" during installation
3. Restart terminal and verify: `npm --version`

### Git initialization issues

**Error:** `not a git repository`

**Solution:** Initialize git.
```bash
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit"
```

## Verification Checklist

Before moving to Phase 2, verify:

```bash
# 1. Backend running and responsive
curl http://localhost:3000/health

# 2. Frontend loads without errors
open http://localhost:5173

# 3. Git history exists
git log --oneline | head -3

# 4. Dependencies installed
test -d backend/node_modules && echo "Backend OK"
test -d frontend/node_modules && echo "Frontend OK"

# 5. API test infrastructure ready (keys needed to pass)
cd backend && npm run test:api

# 6. Environment configured
test -f .env && echo ".env exists"
grep DEEPGRAM_API_KEY .env > /dev/null && echo "Deepgram key set"
grep ANTHROPIC_API_KEY .env > /dev/null && echo "Claude key set"
```

## Next Steps

Phase 1 is complete when:
- ✓ Both servers start without errors
- ✓ Backend responds to health check
- ✓ Frontend loads and detects backend
- ✓ API keys are configured (in `.env`)
- ✓ Documentation is complete

**Ready for Phase 2:** File upload endpoint and transcription integration.

See `.planning/ROADMAP.md` for Phase 2 details.

## Getting Help

1. **Check CONTRIBUTING.md** - Development standards and troubleshooting
2. **Check ARCHITECTURE.md** - System design explanation
3. **Check .planning/STATE.md** - Project decisions and status
4. **Read error messages carefully** - They often point to the solution

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/)
- [Deepgram API Reference](https://developers.deepgram.com/)
- [Anthropic Claude API Reference](https://docs.anthropic.com/)

---

**Phase 1 Setup Complete!**

Your development environment is ready. Both servers should run without errors, and the application should be accessible.

**Next:** See `.planning/ROADMAP.md` for Phase 2 implementation details.
