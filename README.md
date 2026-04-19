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

See `docs/CONTRIBUTING.md` for development guidelines.

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
