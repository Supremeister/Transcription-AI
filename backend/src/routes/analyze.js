const express = require('express');
const axios = require('axios');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_TRANSCRIPT_CHARS = 20000; // ~5500 токенов, в рамках лимита Groq

const PROMPTS = {
  correct: (text) =>
    `Ты редактор транскрипта. Исправь орфографические ошибки и неправильно распознанные слова (особенно английские термины и названия). Сохрани оригинальный смысл и структуру разговора. Верни только исправленный текст без пояснений.\n\nТекст:\n${text}`,

  tasks: (text) =>
    `Проанализируй транскрипт разговора и выдели все задачи, договорённости и действия которые нужно выполнить. Оформи нумерованным списком. Если задач нет — напиши "Задачи не найдены". Только список, без вводных фраз.\n\nТранскрипт:\n${text}`,

  keypoints: (text) =>
    `Проанализируй транскрипт разговора и выдели 3–7 ключевых мыслей и важных тезисов. Оформи нумерованным списком. Только список, без вводных фраз.\n\nТранскрипт:\n${text}`,

  full: (text) =>
    `Ты аналитик бизнес-разговоров. Проанализируй транскрипт и составь структурированный отчёт.

Правила анализа:
- ЗАДАЧИ: только конкретные действия — кто делает, что делает, к какому сроку (если упомянут). Не абстракции и не пересказ темы разговора.
- МЕТРИКИ: только оцифрованные показатели с числами (%, штуки, дни, минуты, рубли). Строго: метрика ≠ результат ≠ план ≠ приём. Если участник путает эти категории — укажи в зонах роста.
- ТРИ КОМПОНЕНТА любой работы — проверь наличие всех трёх:
  1. Бизнес-логика: есть ли чёткий алгоритм действий (что делаем)?
  2. Результат: определён ли конкретный результат каждого этапа (что получаем)?
  3. Измерение: есть ли оцифрованные метрики (в чём измеряем)?
  Если хотя бы один компонент отсутствует — укажи это в зонах роста.
- ПОСТАНОВКА ЗАДАЧ: проверь по формуле — мы делаем X → для чего → потому что → что получится → что это решает. Размытые формулировки — зона роста.
- Если участник только начинает направление (стадия "набрать количество") — не требуй качественных метрик, это норма.
- Пиши кратко, только факты из разговора, без вводных фраз.

Транскрипт:
${text}

---
Отчёт строго в этом формате:

## Задачи и договорённости
(кто + что + когда; если нет — "Не найдены")

## Цели разговора
(чего хотели достичь в этом разговоре)

## Ключевые метрики
(только оцифрованные: название — значение — единица; если нет — "Не упомянуты")

## Ключевые выводы и принципы
(важные инсайты, концептуальные различия, принципы — 3–6 пунктов)

## Зоны роста участников
Проверь обязательно:
- Все ли три компонента проработаны (логика / результат / измерение)?
- Не путает ли участник метрику с результатом, планом или приёмом?
- Мыслит ли системно или ситуационно?
- Конкретны ли формулировки задач (формула: X → зачем → почему → что получится → что решает)?
(если разговор не про работу или обучение — пропусти раздел)

## Динамика
(если есть история предыдущих сессий — сравни зоны роста: прогресс / без изменений / регресс по каждой; если истории нет — напиши "Первая сессия")

## Открытые вопросы
(что осталось нерешённым; если нет — "Нет")`,

  full_client: (text) =>
    `Ты аналитик переговоров. Проанализируй транскрипцию диалога с клиентом строго по структуре ниже.
Отвечай кратко, только факты из текста. Если информация не упоминается — пиши «не упоминается».

## 1. КОНТЕКСТ
- Касание: № (1 / 2 / 3 / 4 / 5 / не определено)
- Тип отношений: удерживающий / поддерживающий / растущий
- Этап воронки: первый контакт / сбор данных / согласование / договор / подписание

## 2. ПРОДВИЖЕНИЕ
- Продвинулись? ДА / НЕТ / ОТКАТ
- С какого этапа на какой
- Причина (одна строка)

## 3. ЗАПАДАЮЩИЕ ЗОНЫ
Что упустил, не закрыл, облажался — список пунктами. Если всё ок — "нет".

## 4. ИНСАЙТЫ О КЛИЕНТЕ
- Что реально хочет (за словами)
- Скрытые возражения или сигналы
- Паттерн принятия решений

## 5. СЛЕДУЮЩИЙ ШАГ
- Действие: (конкретно)
- Формат: звонок / сообщение / встреча / документ
- Срок: (если упомянут)

## 6. ДАНО → РЕШЕНИЕ → РЕЗУЛЬТАТ
- Дано: с чем пришёл в разговор (запрос, ситуация, этап)
- Решение: что сделал / предложил в ходе диалога
- Результат: что фактически получилось на выходе

## 7. ОЦЕНКА РАЗГОВОРА
Скор: X / 10
Обоснование: (2–3 строки — за что сняты баллы, что сделано хорошо)

Транскрипция:
${text}`,

  full_mentor: (text) =>
    `Ты аналитик коучинговых сессий. Проанализируй транскрипцию беседы с ментором / руководителем строго по структуре ниже.
Отвечай кратко, только факты из текста. Если информация не упоминается — пиши «не упоминается».

## 1. КЛЮЧЕВЫЕ СОВЕТЫ И РЕШЕНИЯ
Список: что ментор рекомендовал, что было решено.

## 2. КУДА НАПРАВЛЯЕТ МЫШЛЕНИЕ
В чём главный сдвиг, который ментор хочет создать (1–2 строки).

## 3. ЗАПАДАЮЩИЕ ЗОНЫ (по мнению ментора)
Что он видит как проблему или слабость — список пунктами.

## 4. ИНСАЙТЫ И ПАТТЕРНЫ
- Новое: принципы или идеи, прозвучавшие впервые
- Повторяющееся: что ментор говорит снова (паттерн)

## 5. СЛЕДУЮЩИЙ ШАГ
- Задача: (конкретно)
- Критерий выполнения: как понять, что сделано
- Срок: (если назван)

## 6. ДАНО → РЕШЕНИЕ → РЕЗУЛЬТАТ
- Дано: с какой ситуацией / вопросом пришёл на сессию
- Решение: что ментор предложил или на что направил
- Результат: что изменилось в понимании / появилась конкретная задача

## 7. ОЦЕНКА СЕССИИ
Скор: X / 10
Обоснование: насколько глубоко зашли, что вынес, что осталось нераскрытым

Транскрипция:
${text}`
};

function buildContextPrefix(userContext, history) {
  let prefix = '';
  if (userContext) {
    prefix += `Контекст пользователя:\n${userContext}\n\n---\n\n`;
  }
  if (history && history.length > 0) {
    prefix += `Предыдущие сессии пользователя (для отслеживания динамики зон роста):\n`;
    history.forEach((h, i) => {
      const date = h.date ? new Date(h.date).toLocaleDateString('ru') : `Сессия ${i + 1}`;
      const filename = h.filename || 'неизвестно';
      prefix += `[${date}, файл: ${filename}]\n${h.summary}\n\n`;
    });
    prefix += `---\n\n`;
  }
  return prefix;
}

async function callGroq(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(`${GROQ_ENDPOINT}/chat/completions`, {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return response.data.choices?.[0]?.message?.content?.trim();
    } catch (err) {
      const status = err.response?.status;
      const retryAfterMs = (() => {
        // Groq возвращает "Please try again in X.Xs"
        const msg = err.response?.data?.error?.message || '';
        const match = msg.match(/try again in ([\d.]+)s/);
        return match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 4000;
      })();
      if (status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, retryAfterMs));
        continue;
      }
      throw err;
    }
  }
}

// POST /api/analyze
router.post('/', async (req, res) => {
  const { transcript, action, apiKey, apiEndpoint, apiModel, userContext, history } = req.body;

  if (!transcript || !action) {
    return res.status(400).json({ success: false, error: 'Нужен transcript и action' });
  }

  if (!PROMPTS[action]) {
    return res.status(400).json({ success: false, error: 'Неизвестный action' });
  }

  const trimmedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[...транскрипт обрезан, показаны первые ~20 минут]'
    : transcript;
  const contextPrefix = buildContextPrefix(userContext, history);
  const prompt = contextPrefix + PROMPTS[action](trimmedTranscript);

  // 1. Пользовательский API ключ (OpenAI-совместимый)
  if (apiKey) {
    const endpoint = (apiEndpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = apiModel || 'gpt-4o-mini';
    try {
      const response = await axios.post(`${endpoint}/chat/completions`, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000
      });
      const result = response.data.choices?.[0]?.message?.content?.trim();
      return res.json({ success: true, result });
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      return res.status(500).json({ success: false, error: `API ошибка: ${msg}` });
    }
  }

  // Groq API
  try {
    const result = await callGroq(prompt);
    return res.json({ success: true, result });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.error('Groq API error:', msg);
    return res.status(500).json({ success: false, error: `Groq API: ${msg}` });
  }
});

// GET /api/analyze/health
router.get('/health', async (req, res) => {
  // NVIDIA всегда доступна (встроенный ключ)
  res.json({ ollama: true, hasModel: true, provider: 'nvidia' });
});

module.exports = router;
