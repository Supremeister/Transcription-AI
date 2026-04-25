# -*- coding: utf-8 -*-
"""
Whisper микросервис - модель загружается один раз при старте.
Принимает аудио файлы, возвращает транскрипцию.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import json
import os
import sys
import tempfile
from flask import Flask, request, jsonify

app = Flask(__name__)

# Добавляем путь к CUDA DLL (nvidia-cublas-cu12)
# В замороженном exe __file__ — это сам exe, DLLs лежат в sys._MEIPASS
if getattr(sys, 'frozen', False):
    _base = sys._MEIPASS
else:
    _base = os.path.dirname(os.path.abspath(__file__))
_cublas_bin = os.path.join(_base, 'nvidia', 'cublas', 'bin')
if os.path.isdir(_cublas_bin):
    os.add_dll_directory(_cublas_bin)
    print(f"✅ CUDA DLL path: {_cublas_bin}", flush=True)
else:
    print(f"⚠️ CUDA DLL path не найден: {_cublas_bin}", flush=True)

# Загружаем модель один раз при старте
print("⏳ Загружаем Whisper модель...", flush=True)
MODEL = None
device = "cpu"
compute_type = "int8"
try:
    from faster_whisper import WhisperModel
    MODEL = WhisperModel("small", device="cuda", compute_type="float16")
    device = "cuda"
    compute_type = "float16"
    print("✅ Модель загружена. Устройство: CUDA (float16)", flush=True)
except Exception as e:
    print(f"⚠️ CUDA недоступна: {e}", flush=True)
    try:
        from faster_whisper import WhisperModel
        MODEL = WhisperModel("small", device="cpu", compute_type="int8")
        device = "cpu"
        compute_type = "int8"
        print("✅ Модель загружена. Устройство: CPU", flush=True)
    except Exception as e2:
        print(f"❌ Ошибка загрузки модели: {e2}", flush=True)
        MODEL = None


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok" if MODEL else "error",
        "model": "small",
        "device": device if MODEL else "unknown"
    })


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if MODEL is None:
        return jsonify({"success": False, "error": "Модель не загружена"}), 500

    if "audio" not in request.files:
        return jsonify({"success": False, "error": "Файл не передан"}), 400

    audio_file = request.files["audio"]
    language = request.form.get("language", "ru")

    # Сохраняем во временный файл
    suffix = os.path.splitext(audio_file.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        print(f"⏳ Транскрибируем: {tmp_path} (lang={language})", flush=True)
        segments, info = MODEL.transcribe(tmp_path, language=language, beam_size=1, vad_filter=True, condition_on_previous_text=False)
        transcript = " ".join(seg.text.strip() for seg in segments)
        print(f"✅ VAD транскрипция: {len(transcript)} символов", flush=True)

        # Если VAD отфильтровал весь звук — пробуем без VAD
        if not transcript.strip():
            print("⚠️ VAD дал пустой результат, пробуем без VAD...", flush=True)
            segments2, _ = MODEL.transcribe(tmp_path, language=language, beam_size=1, vad_filter=False, condition_on_previous_text=False)
            transcript = " ".join(seg.text.strip() for seg in segments2)
            print(f"✅ Без VAD: {len(transcript)} символов", flush=True)

        return jsonify({"success": True, "transcript": transcript, "language": language})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=False)
