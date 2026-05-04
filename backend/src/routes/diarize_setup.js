const express = require('express');
const { execFile, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const router = express.Router();

// ─── Поиск Python ──────────────────────────────────────────────────────────

function findPython() {
  const username = os.userInfo().username;
  const candidates = [
    `C:\\Users\\${username}\\AppData\\Local\\Python\\bin\\python.exe`,
    `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
    `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`,
    `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python310\\python.exe`,
    `C:\\Python312\\python.exe`,
    `C:\\Python311\\python.exe`,
    `C:\\Python310\\python.exe`,
  ];

  for (const p of candidates) {
    try { fs.accessSync(p); return p; } catch {}
  }

  // Пробуем через PATH
  try {
    const result = require('child_process').execSync('where python', { timeout: 3000, windowsHide: true }).toString().trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}

  return null;
}

function checkPyannote(pythonPath) {
  return new Promise((resolve) => {
    execFile(pythonPath, ['-c', 'import pyannote.audio; print("ok")'], { timeout: 10000, windowsHide: true }, (err, stdout) => {
      resolve(!err && stdout.trim() === 'ok');
    });
  });
}

function readEnvToken() {
  try {
    const envPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../.env')
      : path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^HF_TOKEN\s*=\s*(.+)$/);
        if (m) return m[1].trim();
      }
    }
  } catch {}
  return null;
}

function writeEnvToken(token) {
  const envPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../.env')
    : path.join(__dirname, '../../.env');
  let content = '';
  try { content = fs.readFileSync(envPath, 'utf8'); } catch {}

  if (/^HF_TOKEN\s*=/m.test(content)) {
    content = content.replace(/^HF_TOKEN\s*=.*$/m, `HF_TOKEN=${token}`);
  } else {
    content = content.trimEnd() + `\nHF_TOKEN=${token}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

// ─── GET /api/diarize/status ───────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const python = findPython();
  const hfToken = !!readEnvToken();
  const pyannote = python ? await checkPyannote(python) : false;

  res.json({
    python: python || null,
    pyannote,
    hfToken,
    ready: !!(python && pyannote && hfToken),
  });
});

// ─── POST /api/diarize/token ───────────────────────────────────────────────

router.post('/token', (req, res) => {
  const { token } = req.body;
  if (!token?.startsWith('hf_')) {
    return res.status(400).json({ success: false, error: 'Неверный формат токена (должен начинаться с hf_)' });
  }
  try {
    writeEnvToken(token);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /api/diarize/install — SSE stream прогресса ────────────────────

router.post('/install', (req, res) => {
  const python = findPython();
  if (!python) {
    return res.status(400).json({ success: false, error: 'Python не найден. Установите Python 3.10+ с python.org' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg, pct) => res.write(`data: ${JSON.stringify({ msg, pct })}\n\n`);

  send('Устанавливаем pyannote.audio...', 10);

  const pip = execFile(python, ['-m', 'pip', 'install', 'pyannote.audio', '--quiet'], {
    timeout: 10 * 60 * 1000, windowsHide: true
  });

  pip.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line.includes('Downloading')) send(line.slice(0, 60) + '...', 40);
    else if (line.includes('Installing')) send('Устанавливаем пакеты...', 70);
  });

  pip.on('close', async (code) => {
    if (code !== 0) {
      send('Ошибка установки. Попробуйте вручную: pip install pyannote.audio', 0);
      res.write(`data: ${JSON.stringify({ done: true, success: false })}\n\n`);
      res.end();
      return;
    }

    // Проверяем что всё установилось
    const ok = await checkPyannote(python);
    if (ok) {
      send('✅ pyannote.audio установлен!', 100);
    } else {
      send('⚠️ Установка завершена, но импорт не работает. Перезапустите приложение.', 90);
    }
    res.write(`data: ${JSON.stringify({ done: true, success: ok })}\n\n`);
    res.end();
  });
});

module.exports = router;
