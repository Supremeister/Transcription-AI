# Quick Start Guide

**Phase 1 Planning Complete** ✅
**Ready to Execute:** Now

---

## The Plan

Full plan: `.planning/01-PLAN.md` (3500+ lines, every detail covered)

**6 tasks, 4-6 hours, Days 1-2**

---

## Task Summary

| # | Task | Time | Status |
|---|------|------|--------|
| 1 | Initialize Git & project structure | 30 min | 📋 Ready |
| 2 | Backend setup (Express.js) | 1 hour | 📋 Ready |
| 3 | Frontend setup (React + TailwindCSS) | 1 hour | 📋 Ready |
| 4 | Get API credentials (Deepgram + Claude) | 30 min | 📋 Ready |
| 5 | Test APIs (verify they work) | 1 hour | 📋 Ready |
| 6 | Documentation (README, guides) | 30 min | 📋 Ready |

**Total: 4-6 hours**

---

## Technology Stack (Locked)

```
Frontend:           Backend:            APIs:
React 18            Express.js          Deepgram (ASR)
TailwindCSS         Node.js             Claude Sonnet (LLM)
(port 5173)         (port 3000)
                                        Queue:
                                        Bull.js

                    Database:
                    PostgreSQL / SQLite
```

---

## How to Execute

### 1. Read the Full Plan
```bash
cat .planning/01-PLAN.md | less
# Or open in editor: code .planning/01-PLAN.md
```

### 2. Follow Each Task
Each task in `01-PLAN.md` has:
- ✅ Objective
- ✅ Time estimate
- ✅ Step-by-step instructions
- ✅ Code templates
- ✅ Verification commands
- ✅ Expected output

### 3. Run Verification
```bash
# After each task, verify:
curl http://localhost:3000/health
npm run test:api  # After Task 5
```

### 4. Commit to Git
```bash
git add .
git commit -m "task: [task name]"
```

---

## Success Checklist

Before Phase 2, verify:

```bash
# 1. Git initialized
ls -la .git/

# 2. Backend running
curl http://localhost:3000/health
# Should return: { "status": "ok", ... }

# 3. Frontend running
curl http://localhost:5173
# Should load React app

# 4. APIs working
npm run test:api
# Should show: ✓ All API tests passed

# 5. Files exist
test -f .env && echo "✓ .env"
test -f README.md && echo "✓ README"
test -d docs && echo "✓ docs"

# 6. Git history
git log --oneline | head -3
# Should show 2-3 commits
```

---

## Key Files

| File | What | Use |
|------|------|-----|
| `01-PLAN.md` | **MAIN PLAN** — read this first | Detailed execution |
| `ROADMAP.md` | Why 6 phases | Context |
| `REQUIREMENTS.md` | What we're building | Reference |
| `research/asr.md` | Why Deepgram | Context |
| `research/llm_analysis.md` | Why Claude Sonnet | Context |

---

## API Keys Needed

1. **Deepgram** — https://console.deepgram.com
   - Free tier: 25 hours/month
   - Set in `.env`: `DEEPGRAM_API_KEY`

2. **Claude (Anthropic)** — https://console.anthropic.com
   - Set in `.env`: `ANTHROPIC_API_KEY`

**⚠️ IMPORTANT:** Never commit `.env` to git (it's in `.gitignore`)

---

## Parallel Execution

Run these in parallel (separate terminals):

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: API test (after both servers start)
cd backend && npm run test:api
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Port 3000 in use | `lsof -i :3000` to find what's using it |
| Module not found | `npm install` in that directory |
| API key rejected | Check copy/paste (no spaces) |
| Frontend 404 | Check port (may be 5173 or 3000) |

See `01-PLAN.md` troubleshooting section for more.

---

## What You'll Have After Phase 1

✅ Git repository with clean history
✅ Working Express.js backend server
✅ Working React frontend app
✅ Verified Deepgram API access
✅ Verified Claude API access
✅ Complete documentation
✅ `.env` template for future contributors

---

## What's Next (Phase 2)

Once Phase 1 is complete:

1. File upload endpoint
2. Deepgram transcription integration
3. Job tracking
4. Frontend upload UI
5. Results display

See `ROADMAP.md` Phase 2 section.

---

## Time Estimate

- Phase 1: **4-6 hours** (Days 1-2)
- Phase 2: **4-6 hours** (Days 2-3)
- Phase 3-6: **6-8 hours** (Days 4-7)

**MVP launch: 1-2 weeks**

---

## Before You Start

- [ ] Read `.planning/01-PLAN.md` completely
- [ ] Have API provider dashboards ready
- [ ] Have Node.js 18+ installed
- [ ] Have npm or yarn installed
- [ ] Have 1-2 hours uninterrupted time

---

## Go!

```bash
# Start here:
cat .planning/01-PLAN.md

# Then begin Task 1:
git init
```

**Estimated completion:** Today or tomorrow (4-6 hours)

---

**Last Updated:** 2026-04-19
**Status:** Ready to execute
**Next:** Start Phase 1 Task 1
