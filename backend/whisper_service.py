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

# Загружаем модель один раз при старте
print("⏳ Загружаем Whisper модель...", flush=True)
MODEL = None
device = "cpu"
compute_type = "int8"
try:
    from faster_whisper import WhisperModel
    MODEL = WhisperModel("small", device="cuda", compute_type="float16")
    print("✅ Модель загружена. Устройство: CUDA", flush=True)
except Exception as e:
    print(f"❌ Ошибка загрузки модели: {e}", flush=True)
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
        segments, info = MODEL.transcribe(tmp_path, language=language, beam_size=1)
        transcript = " ".join(seg.text.strip() for seg in segments)
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
