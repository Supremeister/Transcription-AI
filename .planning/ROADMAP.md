# Transcription AI Service — Roadmap

**Status:** Phase Planning
**Timeline:** 1-2 weeks (MVP)
**Owner:** User

---

## Phase Structure

### Phase 1: Foundation Setup (Days 1-2)
**Goal:** Project structure, API keys, local development environment

**Tasks:**
- [ ] Initialize Git repo, project structure (.env, config files)
- [ ] Set up Deepgram API account + test credentials
- [ ] Set up Claude Sonnet API account + test credentials
- [ ] Create basic Express/FastAPI backend skeleton
- [ ] Set up frontend project (React or similar)

**Deliverables:**
- Working dev environment
- API credentials configured
- Basic server running locally

**Success Criteria:**
- Backend starts without errors
- Frontend dev server runs
- Can hit test endpoints

---

### Phase 2: Audio Upload & Transcription (Days 2-3)
**Goal:** File upload → Deepgram transcription → Retrieve transcript

**Tasks:**
- [ ] Build file upload endpoint (multipart form)
- [ ] Integrate Deepgram API (async job handling)
- [ ] Implement job tracking (store job_id, status)
- [ ] Create results retrieval endpoint
- [ ] Add fallback to Faster-Whisper if needed
- [ ] Frontend: Upload UI + progress indicator

**Deliverables:**
- Functional audio-to-text pipeline
- Job status tracking system
- Basic results display

**Success Criteria:**
- Upload 30-second voice memo
- Get accurate transcript in <1 min
- Progress bar shows real-time status

---

### Phase 3: Content Analysis (Days 4-5)
**Goal:** Transcript → Claude Sonnet analysis → Extract goals, tasks, summary

**Tasks:**
- [ ] Integrate Claude Sonnet API
- [ ] Build analysis prompt (goals, tasks, key points, summary)
- [ ] Parse JSON responses from Claude
- [ ] Add error handling & retries
- [ ] Frontend: Display analysis panel (goals, tasks, summary)

**Deliverables:**
- End-to-end pipeline: Audio → Transcript → Analysis
- Analysis UI with structured output
- Export to JSON

**Success Criteria:**
- Analysis results appear automatically after transcription
- Goals/tasks/summary are clearly visible
- Can export as JSON

---

### Phase 4: Polish & UI (Days 5-7)
**Goal:** Frontend design, error handling, performance tuning

**Tasks:**
- [ ] Design responsive UI (desktop, mobile)
- [ ] Implement error messages + retry logic
- [ ] Add loading states, animations
- [ ] Optimize for performance (lazy loading, caching)
- [ ] Basic mobile responsiveness

**Deliverables:**
- Production-ready UI
- Graceful error handling
- Performance baseline

**Success Criteria:**
- UI is intuitive and responsive
- Clear error messages for failures
- Load time < 2 seconds for typical file

---

### Phase 5: Obsidian Integration (Days 7-8)
**Goal:** Export to Obsidian vault with metadata

**Tasks:**
- [ ] Build Obsidian export endpoint
- [ ] Create markdown template (title, transcript, analysis, tags)
- [ ] Test with actual Obsidian vault
- [ ] Document integration steps

**Deliverables:**
- Working Obsidian export
- Integration guide

**Success Criteria:**
- Can export to Obsidian vault
- Files appear with correct metadata
- User can customize template

---

### Phase 6: Testing & Launch (Days 9-14)
**Goal:** QA, documentation, public launch

**Tasks:**
- [ ] End-to-end testing (multiple files, edge cases)
- [ ] Russian + English testing (accuracy validation)
- [ ] Load testing (5-10 concurrent uploads)
- [ ] Documentation (README, API docs, user guide)
- [ ] Deploy to production (AWS/Vercel/Railway)
- [ ] User testing with real voice memos

**Deliverables:**
- Production deployment
- Documentation
- User feedback integration

**Success Criteria:**
- Zero critical bugs
- 2+ users test with real data
- Docs are clear and complete

---

## Tech Stack (Finalized)

### Backend
- **Framework:** Express.js (Node)
- **Rationale:** Better Deepgram SDK, async-first, faster MVP
- **Async jobs:** Bull.js (Redis-backed)
- **Database:** SQLite (MVP) → PostgreSQL (Phase 2)
- **LLM Integration:**
  - Ollama (local Mistral 7B) for quick analysis
  - Cloud Pro Claude API (optional, user's account) for detailed analysis

### Frontend
- **Framework:** React 18 + Vite
- **UI:** TailwindCSS
- **State:** React Context
- **Audio player:** HTML5 native

### Local Development
- **Backend:** Node.js + Express on port 3000
- **Frontend:** Vite on port 5173
- **Ollama:** Optional, runs on port 11434

### Deployment (Optional)
- **Backend:** Railway.app or Render
- **Frontend:** Vercel
- **Storage:** Local filesystem (MVP)

### APIs (Free/Included)
- **Transcription:** Deepgram (free tier: 25 hrs/month)
- **Quick Analysis:** Ollama (free, local)
- **Detailed Analysis:** Cloud Pro Claude (user's own account, optional)
- **Files:** Local filesystem

---

## Dependencies & Blockers

| Phase | Blocker | Mitigation |
|-------|---------|-----------|
| 1 | API credentials | Request immediately, use free tier if available |
| 2 | Deepgram rate limits | Start with free tier (25 hrs/month) |
| 3 | Claude API rate limits | Use batch mode for cost savings, queue requests |
| 4 | Browser file upload size | Chunk large files, implement resumable uploads (Phase 2) |

---

## Success Metrics

- **Launch criteria:**
  - MVP features working (upload → transcribe → analyze)
  - Accuracy: ≥95% on English, ≥94% on Russian
  - Performance: <2min for typical voice memo
  - No critical bugs in end-to-end flow

- **User satisfaction:**
  - 2+ beta users testing
  - Positive feedback on accuracy
  - Obsidian integration working

### Phase 7: Fix CUDA transcription timeout issue

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 7 to break down)

---

## Post-MVP Roadmap (Phase 2+)

- [ ] Batch processing (upload 10+ files at once)
- [ ] Advanced speaker identification & attribution
- [ ] Custom templates for analysis
- [ ] Real-time transcription (streaming audio)
- [ ] Premium tier (higher usage limits)
- [ ] Mobile app (React Native or native)
- [ ] Fine-tuned LLM for domain-specific analysis

### Phase 07.1: Fix installer: CORS, env vars, Groq key UI, CUDA detection, HF token, auto-update (INSERTED)

**Goal:** Commit pending telegram_bot.py fix, verify all installer fixes (CORS, env vars, Groq key UI, CUDA detection, HF token, auto-update), build NSIS installer, and test end-to-end.
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 1 plan

Plans:
- [ ] PLAN.md — Finalize, Verify, and Ship Installer Fixes (6 tasks)
