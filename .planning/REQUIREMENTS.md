# Transcription AI Service — Requirements

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Approved for Phase 1 execution
**Timeline:** 1-2 weeks (MVP)

---

## Functional Requirements

### 1. Audio Upload & Processing
- **Input formats:** OGG, MP3, M4A (Telegram, iOS, Android)
- **File size limit:** Up to 100MB per upload
- **Max duration:** 2 hours per file
- **Storage:** Temporary storage during processing (auto-delete after 7 days)

### 2. Speech-to-Text Transcription
- **Engine:** Deepgram API (primary) + Faster-Whisper (fallback/local)
- **Languages supported:** Russian, English (auto-detect)
- **Output:** Full transcript with timestamps
- **Features:**
  - Speaker diarization (optional labeling)
  - Punctuation & capitalization
  - 3-4% WER (Deepgram) / 4-6% WER (Faster-Whisper)

### 3. Content Analysis (Post-Transcription)
**Hybrid Engine:**
- **Quick Analysis:** Ollama (Mistral 7B) — local, instant
  - Extract: Goals, action items, key points
  - Output: JSON with basic structure

- **Detailed Analysis:** Cloud Pro Claude (this chat) — via backend API
  - Extract: In-depth analysis, nuanced understanding
  - Trigger: User clicks "Deep Analysis" or auto for important items
  - Output: Enriched JSON with detailed insights

**Extract automatically:**
- **Goals/Objectives** — What the speaker wanted to accomplish
- **Action Items/Tasks** — Specific to-dos with owners (if mentioned)
- **Key Points** — Main topics discussed (3-5 bullets)
- **Summary** — 1-3 sentence abstract
- **Output format:** JSON with structured fields

### 4. User Interface
**MVP scope:** Web-based single-page app
- **Upload interface:** Drag-and-drop, file picker, or paste URL
- **Progress tracking:** Real-time status (uploading → transcribing → analyzing)
- **Results view:**
  - Transcript (with timeline scrubber, optional speaker labels)
  - Analysis panel (goals, tasks, summary, key points)
  - Export options: JSON, Markdown, PDF (nice-to-have)

### 5. API Endpoints
For future integrations (Obsidian, etc.):
```
POST /api/transcribe
  - Input: audio file or URL
  - Output: job_id

GET /api/transcribe/{job_id}
  - Status, transcript, analysis

POST /api/export/{job_id}?format=obsidian|json|md
  - Export processed data
```

### 6. Obsidian Integration (Future)
- One-click save to Obsidian vault
- Template: `# Transcript: [Title]\n\n## Transcript\n[...]\n\n## Analysis\n...`
- Metadata: tags, date, source

---

## Non-Functional Requirements

### Performance
- **Upload:** < 10s for 50MB file
- **Transcription:** < 1min for 10min audio (batch, Deepgram)
- **Analysis:** < 30s for 5000-word transcript (Claude API)
- **End-to-end:** < 2min for typical voice memo

### Reliability
- **Uptime:** 99% during MVP phase
- **Error handling:** Graceful fallbacks, user-friendly error messages
- **Rate limiting:** Handle API quota exhaustion (Deepgram, Claude)

### Security
- **File security:** HTTPS uploads, no plaintext logs
- **API keys:** Environment variables, not hardcoded
- **User data:** Optional auth (MVP can be anonymous)
- **Privacy:** Option to process locally (Faster-Whisper)

### Scalability
- **MVP load:** 100 concurrent uploads
- **Cost-effective:** Keep API calls < $0.50 per transcription

---

## User Stories (MVP)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| 1 | As a user, I want to upload a voice memo and see it transcribed | Upload succeeds, transcript appears in <2min, accuracy ≥96% |
| 2 | As a user, I want goals & tasks automatically extracted | Analysis panel shows 3+ goals, 3+ tasks, formatted clearly |
| 3 | As a user, I want a summary of the conversation | Summary is 1-3 sentences, captures main idea |
| 4 | As a user, I want to export results | Can save as JSON or copy to clipboard |
| 5 | As a user, I want Russian & English support | Auto-detect language, both work equally well |
| 6 | As a power user, I want Obsidian integration | One-click save to vault with metadata |

---

## Known Constraints

- **1-2 week timeline:** No complex auth system, advanced ML, or premium features
- **Cost:** $0 for Deepgram free tier (25 hrs/month) + Ollama (free, local)
  - Optional: Cloud Pro Claude for detailed analysis (user's own account)
- **Infrastructure:** Local dev + Vercel frontend, Railway backend (optional)
- **Tech debt:** MVP-quality code; refactor in Phase 2 if product gains traction
- **Ollama requirement:** User must have Ollama installed locally for analysis
  - Fallback: Disable local analysis, use Cloud Pro only

---

## Out of Scope (Phase 2+)

- [ ] Batch processing for 100+ files
- [ ] Custom LLM fine-tuning for domain-specific analysis
- [ ] Advanced speaker identification & attribution
- [ ] Real-time transcription (streaming audio)
- [ ] Multi-language mixing in single file
- [ ] Premium subscription model
- [ ] Mobile app (web-responsive first)
