# Транскрибатор

Десктопное приложение для транскрибации аудио и видео с AI-анализом.
Транскрибация — локально и офлайн. AI-анализ — через Groq API (бесплатно).

---

## Скачать и запустить (Windows)

### Вариант 1 — Готовый установщик (рекомендуется)

1. Перейди на страницу [Releases](https://github.com/Supremeister/Transcription-AI/releases)
2. Скачай `Транскрибатор-Setup-x.x.x.exe`
3. Запусти установщик и следуй шагам
4. Запусти приложение — **при первом запуске скачается модель Whisper (~800 МБ)**, это займёт несколько минут

> **Хочешь GPU-ускорение или диаризацию?**
> Запусти `setup.bat` из папки установки (`C:\Program Files\Транскрибатор\resources\setup.bat`).
> Скрипт сам найдёт NVIDIA-карту и предложит включить CUDA.

---

### Вариант 2 — Запуск из исходников (для разработки)

#### Требования

| | |
|---|---|
| OS | Windows 10 / 11 (x64) |
| Node.js | 18 или выше |
| Python | 3.10 – 3.13 |

#### Установка

```powershell
git clone https://github.com/Supremeister/Transcription-AI.git
cd Transcription-AI
.\setup.ps1
```

Скрипт сделает всё автоматически:
- установит Python-зависимости (faster-whisper и др.)
- установит npm-пакеты для backend / frontend / electron
- скопирует `node.exe`
- соберёт `whisper_service.exe` через PyInstaller (~3-5 мин)

#### Запуск

```powershell
cd electron
npm start
```

---

## GPU-ускорение (CUDA)

По умолчанию транскрибация работает на CPU.
Если есть NVIDIA-видеокарта — запусти `setup.bat`:

```
setup.bat
```

Скрипт:
- Определит карту через `nvidia-smi`
- Спросит, устанавливать ли CUDA torch (~1.5 ГБ)
- После установки Whisper автоматически переключится на GPU

Скорость с GPU быстрее в 3–10 раз.

---

## Диаризация — разделение по спикерам (опционально)

Определяет, кто и когда говорил (Speaker 1, Speaker 2 и т.д.).

Тот же `setup.bat` — установит `pyannote.audio` (~400 МБ).
После установки в настройках приложения введи HuggingFace токен:

1. Создай аккаунт на [huggingface.co](https://huggingface.co)
2. Получи токен: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
3. Прими лицензию модели: [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
4. Вставь токен в **Настройки → HuggingFace токен**

---

## AI-анализ

По умолчанию — **Groq API** (бесплатный тариф).
Ключ — на [console.groq.com](https://console.groq.com), вставить в раздел **Профиль** внутри приложения.

Поддерживается любой OpenAI-совместимый API — укажи endpoint + ключ в профиле.

---

## Telegram-бот

Бот стартует автоматически при запуске приложения, если задан токен в `.env`:

```
TELEGRAM_BOT_TOKEN=your_token_here
```

**Ограничение Telegram Bot API: файлы до 20 МБ** (~15 мин MP3).
Большие файлы — через приложение напрямую.

---

## Сборка установщика из исходников

```powershell
# 1. Собрать CPU-версию whisper_service (~400 МБ вместо 2.4 ГБ)
build_cpu.bat
# → dist_cpu\whisper_service\

# 2. Заменить whisper_service для сборки
xcopy dist_cpu\whisper_service dist\whisper_service /E /I /Y

# 3. Собрать установщик
cd electron
npm run build
# → ..\dist-exe\Транскрибатор-Setup-x.x.x.exe
```

---

## Что умеет

- Форматы: MP3, WAV, OGG, M4A, AAC, MP4, MOV, MKV, AVI (до 500 МБ)
- Модель: Faster-Whisper **large-v3-turbo** — высокая точность, русский и английский
- AI-анализ: исправление текста, задачи, ключевые мысли, полный отчёт
- Диаризация: разделение по спикерам (через pyannote.audio)
- GPU: автоматически если доступна CUDA
- Telegram-бот: транскрипт + анализ прямо в чате

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
├── setup.bat                # Установка CUDA + pyannote (для пользователей)
├── setup.ps1                # Полная установка из исходников (для разработчиков)
├── build_cpu.bat            # Сборка лёгкого CPU whisper_service
├── whisper_service.spec     # PyInstaller GPU-сборка
└── whisper_service_cpu.spec # PyInstaller CPU-сборка (для установщика)
```

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
