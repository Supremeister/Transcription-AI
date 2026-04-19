const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed: ${allowedExts.join(', ')}`));
    }
  }
});

/**
 * POST /api/transcribe
 * Upload and transcribe audio file using Faster-Whisper
 */
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const audioPath = req.file.path;
  const jobId = req.file.filename;
  const language = req.body.language || 'en';

  console.log(`\n📝 Transcribing: ${jobId}`);
  console.log(`📁 File: ${audioPath}`);
  console.log(`🌍 Language: ${language}`);

  try {
    const transcript = await transcribeWithFasterWhisper(audioPath, language);

    console.log(`✅ Transcription complete!`);

    // Clean up temp file
    fs.unlink(audioPath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.json({
      success: true,
      jobId,
      transcript,
      language,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);

    // Clean up on error
    fs.unlink(audioPath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.status(500).json({
      success: false,
      error: error.message,
      jobId
    });
  }
});

/**
 * Transcribe audio using Faster-Whisper (Python)
 */
function transcribeWithFasterWhisper(audioPath, language = 'en') {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
from faster_whisper import WhisperModel

try:
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    # Detect available device and compute type
    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
    except:
        device = "cpu"
        compute_type = "int8"

    # Load model - base model balances quality and speed
    model = WhisperModel("base", device=device, compute_type=compute_type)

    # Transcribe audio
    segments, info = model.transcribe(audio_path, language=language)

    # Combine segments into full transcript
    transcript = ""
    for segment in segments:
        transcript += segment.text + " "

    print(json.dumps({
        "success": True,
        "transcript": transcript.strip(),
        "language": info.language,
        "duration": info.duration
    }))

except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
`;

    const python = spawn('python', ['-c', pythonScript, audioPath, language]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      try {
        const result = JSON.parse(output);
        if (result.success) {
          resolve(result.transcript);
        } else {
          reject(new Error(result.error || 'Transcription failed'));
        }
      } catch (e) {
        if (error) {
          reject(new Error(`Python error: ${error}`));
        } else {
          reject(new Error(`Parse error: ${output}`));
        }
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Process error: ${err.message}`));
    });
  });
}

/**
 * GET /api/transcribe/health
 * Check if transcription service is ready
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'Faster-Whisper (local)',
    max_file_size: '100MB',
    supported_formats: ['mp3', 'wav', 'ogg', 'm4a'],
    supported_languages: ['en', 'ru', 'and 99+ more']
  });
});

module.exports = router;
