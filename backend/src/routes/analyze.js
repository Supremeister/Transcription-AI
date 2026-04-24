const express = require('express');
const axios = require('axios');

const router = express.Router();
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:3b';

const PROMPTS = {
  correct: (text) =>
    `Ты редактор транскрипта. Исправь орфографические ошибки и неправильно распознанные слова (особенно английские термины и названия). Сохрани оригинальный смысл и структуру разговора. Верни только исправленный текст без пояснений.\n\nТекст:\n${text}`,

  tasks: (text) =>
    `Проанализируй транскрипт разговора и выдели все задачи, договорённости и действия которые нужно выполнить. Оформи нумерованным списком. Если задач нет — напиши "Задачи не найдены". Только список, без вводных фраз.\n\nТранскрипт:\n${text}`,

  keypoints: (text) =>
    `Проанализируй транскрипт разговора и выдели 3–7 ключевых мыслей и важных тезисов. Оформи нумерованным списком. Только список, без вводных фраз.\n\nТранскрипт:\n${text}`
};

// POST /api/analyze
router.post('/', async (req, res) => {
  const { transcript, action, apiKey, apiEndpoint, apiModel } = req.body;

  if (!transcript || !action) {
    return res.status(400).json({ success: false, error: 'Нужен transcript и action' });
  }

  if (!PROMPTS[action]) {
    return res.status(400).json({ success: false, error: 'Неизвестный action' });
  }

  const prompt = PROMPTS[action](transcript);

  // Режим API ключа (OpenAI-совместимый)
  if (apiKey) {
    const endpoint = (apiEndpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = apiModel || 'gpt-4o-mini';
    try {
      const response = await axios.post(`${endpoint}/chat/completions`, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      const result = response.data.choices?.[0]?.message?.content?.trim();
      return res.json({ success: true, result });
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      return res.status(500).json({ success: false, error: `API ошибка: ${msg}` });
    }
  }

  // Режим локальной Ollama
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false
    }, { timeout: 120000 });

    res.json({ success: true, result: response.data.response.trim() });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ success: false, error: 'ollama_not_running' });
    }
    if (error.response?.status === 404) {
      return res.status(503).json({ success: false, error: 'model_not_found' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analyze/health
router.get('/health', async (req, res) => {
  try {
    const resp = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    const models = resp.data?.models?.map(m => m.name) || [];
    const hasModel = models.some(m => m.startsWith('qwen2.5:3b'));
    res.json({ ollama: true, hasModel });
  } catch {
    res.json({ ollama: false, hasModel: false });
  }
});

module.exports = router;
