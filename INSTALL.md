# Инструкция по установке

---

## Требования

| | |
|---|---|
| OS | Windows 10 / 11 (x64) |
| Node.js | 18 или выше → [nodejs.org](https://nodejs.org) |
| Python | 3.10 – 3.13 → [python.org](https://www.python.org/downloads/) |
| Git | любая версия → [git-scm.com](https://git-scm.com) |
| RAM | 4 ГБ минимум, 8 ГБ рекомендуется |

> При установке Python обязательно отметь **"Add Python to PATH"**

---

## Шаг 1 — Клонировать репозиторий

```powershell
git clone https://github.com/Supremeister/Transcription-AI.git
cd Transcription-AI
```

---

## Шаг 2 — Установить зависимости

```powershell
.\setup.ps1
```

Скрипт сделает всё автоматически:
- установит Python-пакеты (faster-whisper и зависимости)
- установит npm-пакеты для backend, frontend, electron
- скопирует `node.exe` из системного Node.js
- соберёт `whisper_service.exe` через PyInstaller (3–5 мин)

---

## Шаг 3 — Запустить приложение

```powershell
cd electron
npm start
```

**При первом запуске** скачается модель Whisper (~800 МБ) — это займёт несколько минут. Последующие запуски — мгновенные.

---

## Шаг 4 — GPU-ускорение (если есть NVIDIA)

```
setup.bat
```

Скрипт автоматически:
1. Определит NVIDIA-карту через `nvidia-smi`
2. Спросит — устанавливать CUDA torch (~1.5 ГБ)
3. После установки Whisper переключится на GPU — скорость вырастет в **3–10 раз**

> Если GPU нет — скрипт просто пропустит этот шаг.

---

## Шаг 5 — Диаризация спикеров (опционально)

Тот же `setup.bat` — установит `pyannote.audio` (~400 МБ).

После установки в приложении:

1. Открой **Настройки**
2. Введи HuggingFace токен
   - Создай аккаунт: [huggingface.co](https://huggingface.co)
   - Получи токен: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Прими лицензию модели: [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)

---

## AI-анализ (Groq API)

1. Создай аккаунт: [console.groq.com](https://console.groq.com) — бесплатный тариф есть
2. Скопируй API-ключ
3. В приложении → **Профиль** → вставь ключ

---

## Telegram-бот (опционально)

1. Создай бота через [@BotFather](https://t.me/BotFather), получи токен
2. В файле `backend/.env` добавь:

```
TELEGRAM_BOT_TOKEN=ваш_токен_здесь
```

3. Перезапусти приложение — бот стартует автоматически

---

## Сборка установщика `.exe`

```powershell
# 1. Собрать CPU-версию whisper_service (~400 МБ вместо 2.4 ГБ)
.\build_cpu.bat

# 2. Заменить whisper_service для сборки
xcopy dist_cpu\whisper_service dist\whisper_service /E /I /Y

# 3. Собрать установщик
cd electron
npm run build
# → ..\dist-exe\Транскрибатор-Setup-x.x.x.exe
```

---

## Частые проблемы

**Python не найден**
Переустанови Python с галочкой "Add Python to PATH" и перезапусти терминал.

**Ошибка при сборке whisper_service**
Убедись что установлен `pyinstaller`:
```powershell
pip install pyinstaller
```

**Приложение стартует, но Whisper не готов долго**
Первый запуск скачивает модель (~800 МБ). Проверь интернет-соединение.

**GPU не используется после установки CUDA**
Перезапусти приложение полностью. Статус GPU виден в шапке: `● GPU (CUDA)`.
