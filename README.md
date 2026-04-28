# Транскрибатор

Десктопное приложение для локальной транскрибации аудио и видео с AI-анализом.
Работает полностью офлайн — без интернета, без API-ключей, бесплатно.

---

## Что умеет

### Транскрибация
- Поддерживает MP3, WAV, OGG, M4A, MP4 (до 100 МБ)
- Модель Faster-Whisper medium — высокая точность на русском и английском
- Выбор языка вручную или автоопределение
- Показывает время транскрибации и режим (GPU / CPU)

### Диаризация (разделение по спикерам)
- Определяет, кто и когда говорил
- Метки вида `[Speaker 1]`, `[Speaker 2]` в тексте
- Работает через pyannote.audio (требует HuggingFace токен)

### AI-анализ текста
- Несколько режимов анализа: исправление, задачи, ключевые мысли, резюме и др.
- Работает через локальную модель Ollama (qwen2.5:3b, ~2 ГБ)
- Устанавливается в один клик прямо из приложения

### Ускорение на GPU
- Автоматически использует CUDA если доступна
- Поддержка NVIDIA GPU (CUDA 12)
- Fallback на CPU если GPU нет

---

## Установка (Windows)

### Требования

| | |
|---|---|
| OS | Windows 10 / 11 (x64) |
| Node.js | 18 или выше |
| Python | 3.10 – 3.13 |
| Git | любая версия |
| RAM | 4 ГБ минимум (8 ГБ рекомендуется) |

### Быстрый старт

```powershell
git clone https://github.com/Supremeister/Transcription-AI.git
cd Transcription-AI
.\setup.ps1
```

Скрипт установит всё автоматически:
- Python-пакеты (faster-whisper, flask, flask-cors)
- npm-зависимости для backend / frontend / electron
- Скопирует `node.exe` из системного Node.js
- Соберёт `whisper_service` через PyInstaller (~3-5 минут)

После этого запуск:

```powershell
cd electron
npm start
```

### Сборка .exe для распространения

```powershell
# Сначала собери frontend
cd frontend && npm run build && cd ..

# Собери приложение
cd electron && npm run build
# → dist-exe\Транскрибатор.exe
```

---

## Диаризация (опционально)

Разделение по спикерам требует дополнительных зависимостей.
Запусти **`setup.bat`** — он установит pyannote.audio (~400 МБ):

```
setup.bat
```

Затем в приложении:
1. Откройте вкладку **Настройки**
2. Введите токен HuggingFace (бесплатно: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens))
3. Примите лицензию модели: [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)

---

## AI-анализ (опционально)

Ollama устанавливается прямо из приложения кнопкой **"Настроить AI"**.
Или вручную:

```powershell
# Скачать Ollama: https://ollama.com/download
ollama pull qwen2.5:3b
```

---

## Структура проекта

```
├── backend/              # Node.js API (Express)
│   ├── src/              # Routes, services
│   ├── whisper_service.py   # Faster-Whisper HTTP-сервис
│   └── diarize.py        # Speaker diarization
├── frontend/             # React + Vite + Tailwind UI
├── electron/             # Electron shell
│   └── resources/        # node.exe, icon.png
├── whisper_service.spec  # PyInstaller конфиг (onedir)
├── setup.ps1             # Полная установка (PowerShell)
└── setup.bat             # Установка диаризации (pyannote.audio)
```

---

## Технологии

| Компонент | Стек |
|-----------|------|
| Интерфейс | React + Vite + Tailwind CSS |
| Десктоп | Electron |
| Backend | Node.js + Express |
| Транскрибация | Faster-Whisper (medium model) |
| Диаризация | pyannote.audio 3.1 |
| AI-анализ | Ollama (qwen2.5:3b, локально) |
| GPU | CUDA 12 через ctranslate2 |
