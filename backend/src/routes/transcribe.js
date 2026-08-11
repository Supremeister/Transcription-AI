const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const router = express.Router();
const GIGAAM_SERVICE_PORT = process.env.GIGAAM_SERVICE_PORT || '17801';
const GIGAAM_SERVICE = `http://127.0.0.1:${GIGAAM_SERVICE_PORT}`;
const LOCAL_UPLOAD_LIMIT_BYTES = 500 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
];

function getErrorMessage(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.error ||
    error.response?.data?.message ||
    (error.code === 'ECONNREFUSED'
      ? 'Локальный сервис GigaAM не запущен'
      : error.message)
  );
}

function normalizeSpeakerMode(value) {
  const mode = String(value || 'auto').trim().toLowerCase();
  return ['auto', '1', '2', '3', '4', '4+'].includes(mode) ? mode : 'auto';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: LOCAL_UPLOAD_LIMIT_BYTES },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(extension)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        `Формат не поддерживается. Допустимые: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  },
});

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, error: 'Аудиофайл не передан' });
  }

  const audioPath = req.file.path;
  const jobId = req.file.filename;
  const speakerMode = normalizeSpeakerMode(req.body.speakerMode);

  console.log(`\nGigaAM transcription: ${jobId} [speakers=${speakerMode}]`);

  try {
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath), req.file.originalname);
    form.append('speaker_mode', speakerMode);

    const response = await axios.post(`${GIGAAM_SERVICE}/transcribe`, form, {
      headers: form.getHeaders(),
      timeout: 65 * 60 * 1000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const result = response.data;
    console.log(
      `GigaAM complete: ${result.words?.length || 0} words, ` +
        `${result.segments?.length || 0} blocks, ` +
        `${result.speaker_count || 0} speakers`
    );

    return res.json({
      ...result,
      jobId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`GigaAM transcription error: ${message}`);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: message,
      jobId,
    });
  } finally {
    fs.unlink(audioPath, () => {});
  }
});

router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${GIGAAM_SERVICE}/health`, {
      timeout: 3000,
    });
    if (response.data?.model_id !== 'v3_rnnt') {
      return res.status(503).json({
        status: 'error',
        code: 'GIGAAM_PORT_CONFLICT',
        asr: {
          status: 'error',
          model: 'GigaAM-v3-RNNT',
          error: `Порт ${GIGAAM_SERVICE_PORT} занят другим локальным сервисом`,
        },
      });
    }
    const ready = response.data?.status === 'ok';
    return res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ok' : 'error', asr: response.data });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      asr: {
        status: 'error',
        model: 'GigaAM-v3-RNNT',
        error: getErrorMessage(error),
      },
    });
  }
});

module.exports = router;
