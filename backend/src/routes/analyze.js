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
    `Ты бизнес-аналитик. Твоя задача — извлечь структурированную информацию из любого текста делового характера: личная заметка, монолог, совещание, разбор чужого материала, идеи вслух.

ПРАВИЛА:

1. ЗАДАЧИ — любое действие, которое нужно выполнить (кому угодно, включая самого говорящего).
   Сигналы: "надо", "нужно", "важно", "хочу", "планирую", "надо разобраться", "сходить", "позвонить", "иметь понимание", "завтра X", "к X числу", "до конца недели" — всё это задачи.
   Формат: [исполнитель если ясен] → [задача] → [срок если упомянут]
   Не додумывай детали, записывай близко к тексту.

2. МЕТРИКИ И ЦИФРЫ — любые числа, показатели, суммы, даты, проценты, сроки из текста.
   Если цифр нет — раздел пропусти.

3. КЛЮЧЕВЫЕ МЫСЛИ — важные идеи, выводы, принципы, решения, инсайты.
   Только то, что реально прозвучало, 3–7 пунктов.

4. ОТКРЫТЫЕ ВОПРОСЫ — что упомянуто, но не закрыто, не решено, требует уточнения.

Транскрипт:
${text}

---
Отчёт строго в этом формате (разделы без лишних слов):

## ✅ Задачи
(если нет — "Не найдены")

## 📊 Метрики и цифры
(если нет — пропусти раздел)

## 💡 Ключевые мысли

## ❓ Открытые вопросы
(если нет — "Нет")`,

  full_client: (text) =>
    `Ты аналитик переговоров. Проанализируй транскрипцию диалога строго по структуре ниже.

ВАЖНО — перед анализом определи роли:
- МЕНЕДЖЕР: тот, кто продаёт, предлагает, ведёт переговоры (инициатор звонка или тот, кто презентует)
- КЛИЕНТ: тот, кому продают, у кого есть запрос или объект

Все секции анализируй через реальные цитаты и факты из текста.
Если информация не упоминается — пиши «не упоминается», не додумывай.

## 0. РОЛИ
- Менеджер: (имя / Собеседник X) — одна строка кто это и что делает
- Клиент: (имя / Собеседник X) — одна строка кто это и какой у него запрос
- Третьи лица: (кто ещё упоминается, их роль в сделке — или "нет")

## 1. КОНТЕКСТ
- Касание: № — определи по фразам в тексте ("первый диалог", "как мы обсуждали" = не первый; если явных признаков нет — "не определено")
- Тип отношений: удерживающий / поддерживающий / растущий
- Этап воронки: первый контакт / квалификация / презентация / работа с возражениями / согласование условий / закрытие

## 2. ПРОДВИЖЕНИЕ
- Продвинулись? ДА / НЕТ / ОТКАТ
- С какого этапа на какой (конкретно)
- Что сдвинуло (одна строка — конкретный момент из разговора)

## 3. ЗАПАДАЮЩИЕ ЗОНЫ МЕНЕДЖЕРА
Что конкретно упустил в ЭТОМ разговоре — ссылайся на реплики. Примеры того, что искать:
- Неотработанные возражения или сигналы клиента
- Третьи лица, которых не включил в работу
- Договорённости без чёткого следующего шага
- Вопросы клиента, оставшиеся без ответа
- Риски сделки, которые не обсудил
Если всё ок — "нет".

## 4. ИНСАЙТЫ О КЛИЕНТЕ
- Что реально хочет (за словами, не то что говорит, а что стоит за этим)
- Скрытые сигналы или возражения (конкретные фразы из текста)
- Паттерн принятия решений клиента (медленный/быстрый, единолично/с кем-то, по логике/по доверию)
- Риск срыва сделки (что может помешать)

## 5. СЛЕДУЮЩИЙ ШАГ
- Действие менеджера: (конкретно что должен сделать)
- Действие клиента: (что ожидается от него)
- Формат: звонок / сообщение / встреча / документ
- Срок: (точная дата или "не назван")

## 6. ДАНО → РЕШЕНИЕ → РЕЗУЛЬТАТ
- Дано: ситуация на входе в разговор (этап, запрос, контекст)
- Решение: что предложил / сделал менеджер
- Результат: что получилось на выходе (конкретно)

## 7. ОЦЕНКА РАЗГОВОРА
Скор: X / 10
Сильные стороны: (что менеджер сделал хорошо — конкретно)
Слабые стороны: (за что снижен балл — конкретно)

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
        max_tokens: 2048,
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

  // 2. Groq API (если ключ задан)
  if (GROQ_API_KEY) {
    try {
      const result = await callGroq(prompt);
      return res.json({ success: true, result });
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      console.error('Groq API error:', msg);
      return res.status(500).json({ success: false, error: `Groq API: ${msg}` });
    }
  }

  // Нет ключа
  return res.status(400).json({ success: false, error: 'Введите Groq API ключ в Настройках → AI Анализ (Groq)' });
});

// GET /api/analyze/health
router.get('/health', async (req, res) => {
  const groqReady = !!GROQ_API_KEY;
  res.json({ groq: groqReady, ollama: false, hasModel: groqReady, provider: groqReady ? 'groq' : 'none' });
});

module.exports = router;
