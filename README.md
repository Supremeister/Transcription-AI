# Transcription Service — Local AI Speech-to-Text

Fast, free, offline transcription using Faster-Whisper. No API limits, no costs, no external dependencies.

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- pip (Python package manager)
- faster-whisper library: `pip install faster-whisper`

### Installation

1. **Install Python dependencies:**
```bash
pip install faster-whisper torch pyttsx3
```

2. **Install Node dependencies:**
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

3. **Start the service:**
```bash
# Terminal 1: Backend server (port 3000)
cd backend && npm run dev

# Terminal 2: Frontend server (port 5173)
cd frontend && npm run dev
```

4. **Open in browser:**
Visit `http://localhost:5173`

5. **Test the system:**
```bash
# In a new terminal, run:
python test-with-speech.py
```

Expected output:
```
Status: 200
Transcript: "Hello, this is a test of the transcription service..."
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

## Phase 1 Status: Complete ✓ WORKING

- [x] Express.js backend running on localhost:3000
- [x] React + Vite frontend running on localhost:5173
- [x] Audio file upload with validation (MP3, WAV, OGG, M4A)
- [x] Faster-Whisper transcription engine (local, CPU/GPU)
- [x] Multi-language support (English, Russian, Spanish, French, German)
- [x] Error handling and cleanup
- [x] End-to-end testing validated
- [x] Full documentation complete

See `PHASE1-SUMMARY.md` for detailed completion report.

## Next Steps: Phase 2

In Phase 2, you'll add:
- GPU optimization (CUDA setup guide in `.planning/GPU-OPTIMIZATION.md`)
- SQLite database for transcript history
- Ollama/Qwen for goal/task extraction from transcripts
- Performance tuning and profiling
- UI enhancements (progress bar, file preview)

See `.planning/ROADMAP.md` for the full roadmap.

## API Reference

### Transcription Endpoint

**POST** `/api/transcribe`

Upload an audio file for transcription.

**Request:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F "audio=@recording.mp3" \
  -F "language=en"
```

**Request Body (multipart/form-data):**
- `audio` (file, required): Audio file (MP3, WAV, OGG, M4A, AAC - max 100MB)
- `language` (string, optional): Language code (default: "en")

**Response:**
```json
{
  "success": true,
  "jobId": "audio-1776589073701-410192842.wav",
  "transcript": "Hello, this is a test of the transcription service...",
  "language": "en",
  "timestamp": "2026-04-19T08:57:59.858Z"
}
```

### Health Check

**GET** `/health`

Check backend status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-19T08:59:29.783Z",
  "uptime": 212.1107902,
  "environment": "development"
}
```

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Optional: GPU acceleration (Phase 2)
DEEPGRAM_API_KEY=your_key_here
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen:2.5b
DATABASE_URL=sqlite:./data/transcription.db
```

See `.env.example` for template.

## Troubleshooting

### "Library cublas64_12.dll is not found"
GPU CUDA libraries are not installed. The system will fall back to CPU automatically. For GPU support, see `.planning/GPU-OPTIMIZATION.md`

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

### Empty transcripts
Ensure your audio file contains actual speech. Test with:
```bash
python generate-test-audio.py
python test-with-speech.py
```

## Architecture

```
User Browser (React)
        ↓
  http://localhost:5173
        ↓
  [Upload Audio File]
        ↓
  POST /api/transcribe
        ↓
  Express.js Backend
  (Node.js)
        ↓
  Spawn Python Process
        ↓
  Faster-Whisper
  (Local Model)
        ↓
  Transcribed Text
        ↓
  JSON Response
        ↓
  Display in UI
```

## Performance

- **CPU Mode:** 5-15 seconds per minute of audio (RTX 3050)
- **GPU Mode (with CUDA):** 2-5 seconds per minute of audio
- **Model Size:** Base model ~141MB
- **Memory:** ~2GB RAM (CPU), ~4GB VRAM (GPU)

## Key Technologies

- **Backend:** Node.js + Express.js
- **Frontend:** React 18 + Vite + TailwindCSS
- **Transcription:** Faster-Whisper (OpenAI Whisper optimized)
- **File Upload:** Multer
- **Styling:** TailwindCSS v4
- **Testing:** Python requests + pyttsx3

## License

MIT

## Next Updates

- [ ] Phase 2: GPU optimization and database
- [ ] Phase 3: Goal extraction with Ollama
- [ ] Phase 4: Web deployment (Docker)
- [ ] Phase 5: Production hardening

For detailed planning, see `.planning/ROADMAP.md`
