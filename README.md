# Транскрибатор

> Локальная транскрибация аудио и видео с AI-анализом. Без облаков, без подписок.

---

## Что умеет

### Транскрибация
- Форматы: MP3, WAV, OGG, M4A, AAC, **MP4, MOV, MKV, AVI** (до 500 МБ)
- Модель **Faster-Whisper large-v3-turbo** — высокая точность на русском и английском
- Работает полностью офлайн — аудио никуда не уходит
- GPU-ускорение через CUDA (в 3–10 раз быстрее CPU)

### AI-анализ
- Автоматически после транскрибации: исправление текста, задачи, ключевые мысли
- **Groq API** (llama-3.3-70b) — быстро, бесплатный тариф
- Поддержка любого OpenAI-совместимого API

### Диаризация спикеров
- Определяет, кто и когда говорил: `Speaker 1`, `Speaker 2`
- Через pyannote.audio — устанавливается одной командой

### Telegram-бот
- Отправь аудио в бот → получи транскрипт + AI-анализ прямо в Telegram
- Работает пока приложение запущено
- Ограничение Telegram: файлы до 20 МБ (~15 мин MP3)

---

## Быстрый старт

```powershell
git clone https://github.com/Supremeister/Transcription-AI.git
cd Transcription-AI
.\setup.ps1
cd electron && npm start
```

Подробная инструкция — **[INSTALL.md](INSTALL.md)**

---

## Планы

- [ ] Сборка готового `.exe` установщика (релиз на GitHub)
- [ ] Поддержка дополнительных языков в UI
- [ ] История транскрипций с поиском
- [ ] Пакетная обработка нескольких файлов
- [ ] Экспорт в `.docx` / `.pdf`
- [ ] Поддержка Whisper medium / small для слабых машин
- [ ] Облачный режим (без локального Python)

---

## Стек

| Компонент | Технология |
|-----------|-----------|
| Интерфейс | React + Vite + Tailwind CSS |
| Десктоп | Electron |
| Backend | Node.js + Express |
| Транскрибация | Faster-Whisper (large-v3-turbo) |
| Диаризация | pyannote.audio 3.1 |
| AI-анализ | Groq API / OpenAI-совместимый |
| GPU | CUDA 12 через ctranslate2 |
| Telegram | python-telegram-bot |

---

## Структура проекта

```
├── backend/                 # Node.js API (Express)
│   ├── src/
│   ├── whisper_service.py   # Faster-Whisper HTTP-сервис
│   └── diarize.py           # Диаризация спикеров
├── frontend/                # React + Vite + Tailwind
├── electron/                # Electron shell + упаковка
├── telegram_bot.py          # Telegram-бот
├── setup.bat                # Установка CUDA + pyannote (пользователи)
├── setup.ps1                # Полная установка из исходников (разработчики)
├── build_cpu.bat            # Сборка лёгкого CPU whisper_service
├── whisper_service.spec     # PyInstaller GPU-сборка
└── whisper_service_cpu.spec # PyInstaller CPU-сборка
```

---

Developed by [Supremeister](https://github.com/Supremeister)
