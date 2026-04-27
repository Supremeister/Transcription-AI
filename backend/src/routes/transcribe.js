const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { execFile } = require('child_process');

const router = express.Router();
const WHISPER_SERVICE = 'http://127.0.0.1:8001';

// Читаем HF_TOKEN из .env рядом с этим файлом
function getHfToken() {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^HF_TOKEN\s*=\s*(.+)$/);
        if (m) return m[1].trim();
      }
    }
  } catch(e) {}
  return process.env.HF_TOKEN || null;
}

// Запускаем diarize.py через системный Python
function runDiarize(audioPath, whisperSegments) {
  return new Promise((resolve) => {
    const hfToken = getHfToken();
    if (!hfToken) { resolve([]); return; }

    const pythonCandidates = [
      'C:\\Users\\MSI\\AppData\\Local\\Python\\bin\\python.exe',
      'python',
      'python3',
    ];
    const python = pythonCandidates.find(p => {
      try { require('fs').accessSync(p); return true; } catch { return p === 'python' || p === 'python3'; }
    }) || 'python';

    const scriptPath = path.join(__dirname, '../diarize.py');
    const args = [scriptPath, audioPath, JSON.stringify(whisperSegments), hfToken];

    console.log('⏳ Диаризация через diarize.py...');
    execFile(python, args, { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) { console.error('⚠️ diarize.py ошибка:', err.message); resolve([]); return; }
      try {
        const result = JSON.parse(stdout);
        if (result.error) { console.error('⚠️ diarize.py:', result.error); resolve([]); return; }
        console.log(`✅ Диаризация: ${result.segments.length} блоков`);
        resolve(result.segments);
      } catch { resolve([]); }
    });
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) cb(null, true);
    else cb(new Error(`Формат не поддерживается. Допустимые: ${allowedExts.join(', ')}`));
  }
});

/**
 * POST /api/transcribe
 */
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Аудио файл не передан' });
  }

  const audioPath = req.file.path;
  const jobId = req.file.filename;
  const language = req.body.language || 'ru';
  const apiKey = req.body.apiKey;
  const apiEndpoint = req.body.apiEndpoint || 'https://api.openai.com/v1';

  console.log(`\n📝 Транскрибируем: ${jobId}${apiKey ? ' [API]' : ' [локально]'}`);

  try {
    let transcript;
    let segments = [];
    let diarized = false;

    if (apiKey) {
      // Удалённый Whisper API (OpenAI / Groq)
      const endpoint = apiEndpoint.replace(/\/$/, '');
      const form = new FormData();
      form.append('file', fs.createReadStream(audioPath), req.file.originalname);
      form.append('model', 'whisper-large-v3');
      form.append('language', language);

      const response = await axios.post(`${endpoint}/audio/transcriptions`, form, {
        headers: { ...form.getHeaders(), 'Authorization': `Bearer ${apiKey}` },
        timeout: 120000
      });
      transcript = response.data.text;
    } else {
      // Локальный Whisper EXE
      const form = new FormData();
      form.append('audio', fs.createReadStream(audioPath), req.file.originalname);
      form.append('language', language);

      const response = await axios.post(`${WHISPER_SERVICE}/transcribe`, form, {
        headers: form.getHeaders(),
        timeout: 30 * 60 * 1000 // 30 минут для длинных файлов
      });
      transcript = response.data.transcript;

      if (response.data.diarized) {
        // Диаризация уже выполнена whisper_service (dev/py режим)
        segments = response.data.segments;
        diarized = true;
      } else if (response.data.whisper_segments?.length) {
        // Exe режим — вызываем diarize.py через системный Python
        segments = await runDiarize(audioPath, response.data.whisper_segments);
        diarized = segments.length > 0;
      }
    }

    console.log(`✅ Готово!${diarized ? ` [диаризация: ${segments.length} блоков]` : ''}`);
    res.json({ success: true, jobId, transcript, segments: diarized ? segments : undefined, diarized, language, timestamp: new Date().toISOString() });

  } catch (error) {
    const msg = error.response?.data?.error?.message
      || error.response?.data?.error
      || (error.code === 'ECONNREFUSED' ? 'Whisper сервис не запущен' : error.message);
    console.error(`❌ Ошибка: ${msg}`);
    res.status(500).json({ success: false, error: msg, jobId });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

/**
 * GET /api/transcribe/health
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${WHISPER_SERVICE}/health`, { timeout: 3000 });
    res.json({ status: 'ok', whisper: response.data });
  } catch {
    res.status(503).json({ status: 'error', whisper: 'не запущен' });
  }
});

module.exports = router;
