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

**Location:** `frontend/src/`

**Responsibilities:**
- User interface for uploading audio files
- Display transcription results and analysis
- Real-time job status updates
- API communication with backend

**Structure:**
- `components/` - Reusable UI components
- `pages/` - Full page components
- `hooks/` - Custom React hooks
- `utils/` - Helper functions and API client
- `styles/` - Global styles (TailwindCSS)

**Technologies:**
- React 18
- TailwindCSS for styling
- Axios for HTTP requests
- Zustand for state management (optional, planned for Phase 2)

### Backend (Express.js)

**Location:** `backend/src/`

**Responsibilities:**
- REST API endpoints for transcription and analysis
- Deepgram API integration
- Claude API integration
- Job queue management
- Database operations
- Request validation and error handling

**Structure:**
- `routes/` - API endpoint definitions
- `services/` - Business logic
- `middleware/` - Express middleware
- `utils/` - Helper functions

**Technologies:**
- Express.js (web framework)
- Dotenv for environment variables
- Morgan for request logging
- Helmet for security headers
- CORS for cross-origin requests
- Axios for external API calls

### External APIs

#### Deepgram API

**Purpose:** Speech-to-text transcription

**Endpoint:** `https://api.deepgram.com/v1/listen`

**Authentication:** Token in Authorization header

**Features Used:**
- Nova-2 model (latest)
- English language support
- JSON response format

**Free Tier:**
- 25 hours/month transcription

#### Claude API (Anthropic)

**Purpose:** Content analysis and extraction

**Endpoint:** `https://api.anthropic.com/v1/messages`

**Authentication:** API key in x-api-key header

**Model:** Claude 3 Sonnet

**Features Used:**
- Structured text analysis
- JSON output
- Multi-language support

### Database

**Status:** Phase 2 implementation

**Options:**
- **PostgreSQL** (recommended for production)
  - JSONB support for flexible schemas
  - Relational integrity
  - Scalable for production

- **SQLite** (for MVP/testing)
  - Simple file-based database
  - No server setup needed
  - Good for local development

**Tables Planned:**
- `jobs` - Transcription job tracking
- `transcripts` - Raw transcription results
- `analyses` - Analysis results from Claude

### Job Queue System

**Status:** Phase 2 implementation

**Technology:** Bull.js with Redis

**Purpose:**
- Queue transcription and analysis tasks
- Handle long-running operations asynchronously
- Retry failed jobs
- Monitor job status

## Data Flow

### Transcription Flow

1. **User uploads audio file**
   - Frontend sends multipart form with audio
   - Backend validates file size and format

2. **File storage**
   - Save to temporary directory
   - Generate unique job ID

3. **Queue transcription job**
   - Bull.js adds job to Redis queue
   - Returns job ID to frontend

4. **Deepgram processing**
   - Backend worker processes job from queue
   - Sends audio to Deepgram API
   - Receives transcript

5. **Store transcript**
   - Save transcript to database
   - Mark job as complete

6. **Frontend polling**
   - Frontend polls `/api/transcribe/:jobId` for status
   - Displays transcript when available

### Analysis Flow

1. **Start analysis**
   - Frontend requests analysis for transcript
   - Backend queues analysis job

2. **Claude processing**
   - Backend worker processes analysis job
   - Sends transcript to Claude API
   - Receives analysis (goals, tasks, summary)

3. **Store analysis**
   - Save analysis to database
   - Link to original transcript

4. **Return results**
   - Frontend displays analysis results

## Technology Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TailwindCSS | Fast prototyping, popular, good component model |
| Backend | Express.js (Node.js) | Best Deepgram SDK, async-first, JSON-native |
| ASR | Deepgram API | Cost/speed/accuracy balance, good for MVP |
| LLM | Claude Sonnet API | JSON output, Russian support, cost-effective |
| Queue | Bull.js | Redis-backed, Node.js native, reliable |
| Database | PostgreSQL or SQLite | Flexible schema (JSONB), relational integrity |
| Server | Node.js | Single language, JavaScript/JSON throughout |

## Security Considerations

**Environment Variables:**
- All API keys stored in `.env` (not committed)
- Never log sensitive data
- Validate all user inputs

**API Security:**
- CORS headers configured (Helmet)
- Request size limits
- Rate limiting (to be implemented Phase 2)

**Database Security:**
- Parameterized queries (prevent SQL injection)
- Password hashing for authentication (Phase 4)

## Deployment Architecture

**Frontend:**
- Deploy to Vercel (free, git-based)
- Built as static site
- CDN delivery

**Backend:**
- Deploy to Railway.app (free tier available)
- Environment variables configured
- Auto-scaling optional

**Database:**
- PostgreSQL on Railway.app (free tier available)
- Automatic backups
- SSL connections

**External Services:**
- Deepgram API (usage-based billing)
- Claude API (usage-based billing)

## Scaling Considerations

**Phase 2-3 (MVP):**
- Single backend instance
- SQLite for database
- In-memory job queue (can upgrade to Redis)

**Phase 4+ (Production):**
- Multiple backend instances
- PostgreSQL for database
- Redis for job queue
- Load balancer (Railway handles this)
- Caching layer (optional)

## Performance Targets

- Backend health check: < 10ms
- Frontend initial load: < 2s
- Transcription time: depends on audio length
- Analysis time: < 5s for typical transcript
- API response: < 1s (excluding Deepgram/Claude processing)

## Error Handling Strategy

**Backend:**
- Try/catch for async operations
- Graceful error responses
- Logging for debugging
- User-friendly error messages

**Frontend:**
- Graceful fallbacks for failed requests
- Error boundary for React crashes
- User notifications for failures
- Retry logic for transient errors

## Next Steps (Phase 2+)

1. **Phase 2:** File upload endpoint, transcription integration
2. **Phase 3:** Analysis pipeline, results display
3. **Phase 4:** Database integration, job tracking
4. **Phase 5:** Authentication, user accounts
6. **Phase 6:** Testing, deployment, launch

See `.planning/ROADMAP.md` for detailed phase breakdown.
