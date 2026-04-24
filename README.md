# Транскрибатор — локальный AI Speech-to-Text

Десктопное приложение для транскрибации аудио с AI-анализом. Работает полностью локально — без интернета, без API ключей, бесплатно.

## Что умеет

- Транскрибация MP3, WAV, OGG, M4A (до 100 МБ)
- Выбор языка (русский, английский и другие)
- AI-анализ: исправление текста, задачи, ключевые мысли
- CPU и GPU (CUDA 12) режимы

## Технологии

| Компонент | Стек |
|-----------|------|
| Интерфейс | React + Vite + Tailwind |
| Десктоп | Electron |
| Backend | Node.js + Express |
| Транскрибация | Faster-Whisper (small model) |
| AI-анализ | Ollama (qwen2.5:3b, локально) |

---

## Установка (Windows)

### Требования

- Node.js 18+
- Python 3.9–3.13
- Git

### Быстрый старт

```powershell
git clone https://github.com/Supremeister/Transcription-AI.git
cd Transcription-AI
.\setup.ps1
```

Скрипт установит всё автоматически: Python пакеты, npm зависимости, соберёт `whisper_service.exe`.

### Ручная установка

```powershell
# Python зависимости
python -m pip install faster-whisper flask flask-cors

# npm зависимости
cd backend && npm install && cd ..
cd frontend && npm install && npm run build && cd ..
cd electron && npm install && cd ..

# Скопировать node.exe
$nodePath = (Get-Command node).Path
Copy-Item $nodePath electron\resources\node.exe

# Собрать whisper_service.exe (~5 минут)
python -m PyInstaller whisper_service.spec --noconfirm
```

---

## Запуск

```powershell
# Режим разработки
cd electron && npm start

# Собрать .exe
cd electron && npm run build
# → dist-exe\win-unpacked\Транскрибатор.exe
```

---

## GPU ускорение (опционально)

По умолчанию CPU. Для GPU нужен CUDA 12:

1. Установи CUDA Toolkit 12 с сайта NVIDIA
2. В `whisper_service.py` строка 25:
   ```python
   MODEL = WhisperModel("small", device="cuda", compute_type="float16")
   ```
3. Пересобери: `python -m PyInstaller whisper_service.spec --noconfirm`

---

## AI-анализ (опционально)

Нужен Ollama (ollama.com):

```powershell
ollama pull qwen2.5:3b
```

Приложение автоматически определит Ollama при запуске.

---

## Структура проекта

```
├── backend/              # Node.js API
├── frontend/             # React UI
├── electron/             # Electron shell
├── whisper_service.py    # Faster-Whisper сервис
├── whisper_service.spec  # PyInstaller конфиг
└── setup.ps1             # Скрипт автоустановки
```
