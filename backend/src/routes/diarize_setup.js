const express = require('express');
const axios = require('axios');

const router = express.Router();
const servicePort = process.env.GIGAAM_SERVICE_PORT || '17801';
const serviceUrl = `http://127.0.0.1:${servicePort}`;

// Community-1 and its Python dependencies are bundled with the application.
// HF authorization is injected from Electron's DPAPI-protected user config.
router.get('/status', async (_req, res) => {
  try {
    const response = await axios.get(`${serviceUrl}/health`, { timeout: 3000 });
    const asr = response.data || {};
    res.json({
      python: 'bundled',
      pyannote: true,
      hfToken: Boolean(process.env.HF_TOKEN),
      ready: Boolean(asr.diarization),
      error: asr.diarization_error || null,
    });
  } catch (error) {
    res.status(503).json({
      python: 'bundled',
      pyannote: true,
      hfToken: Boolean(process.env.HF_TOKEN),
      ready: false,
      error: error.message,
    });
  }
});

module.exports = router;
