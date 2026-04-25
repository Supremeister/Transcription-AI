# -*- coding: utf-8 -*-
"""
Whisper микросервис - модель загружается один раз при старте.
Принимает аудио файлы, возвращает транскрипцию.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import os
import tempfile
import threading
from flask import Flask, request, jsonify

app = Flask(__name__)

# В замороженном exe отключаем CUDA через env — ctranslate2 лениво грузит
# cublas64_12.dll только при первом инференсе, и падает если нет cudart64_12.dll.
# Без этого: первый клик → CUDA ошибка, второй клик → CPU зависает (плохое состояние).
if getattr(sys, 'frozen', False):
    os.environ['CUDA_VISIBLE_DEVICES'] = ''
    os.environ['CT2_VERBOSE'] = '0'
    print("ℹ️ Frozen exe: принудительный CPU режим (CUDA отключена)", flush=True)
else:
    # В Python-режиме пробуем CUDA через os.add_dll_directory
    _base = os.path.dirname(os.path.abspath(__file__))
    _cublas_bin = os.path.join(_base, 'nvidia', 'cublas', 'bin')
    if os.path.isdir(_cublas_bin):
        os.add_dll_directory(_cublas_bin)
        print(f"✅ CUDA DLL path: {_cublas_bin}", flush=True)

# Загружаем модель один раз при старте
print("⏳ Загружаем Whisper модель...", flush=True)
MODEL = None
device = "cpu"
compute_type = "int8"

if not getattr(sys, 'frozen', False):
    # Python-режим: пробуем CUDA
    try:
        from faster_whisper import WhisperModel
        MODEL = WhisperModel("small", device="cuda", compute_type="float16")
        device = "cuda"
        compute_type = "float16"
        print("✅ Модель загружена. Устройство: CUDA (float16)", flush=True)
    except Exception as e:
        print(f"⚠️ CUDA недоступна: {e}", flush=True)

if MODEL is None:
    # CPU режим (всегда для exe, fallback для Python)
    try:
        from faster_whisper import WhisperModel
        MODEL = WhisperModel("small", device="cpu", compute_type="int8")
        device = "cpu"
        compute_type = "int8"
        print("✅ Модель загружена. Устройство: CPU (int8)", flush=True)
    except Exception as e2:
        print(f"❌ Ошибка загрузки модели: {e2}", flush=True)
        MODEL = None


def _do_transcribe(tmp_path, language, vad_filter):
    """Выполняет транскрипцию в отдельном потоке для поддержки таймаута."""
    result = [None]
    error = [None]

    def worker():
        try:
            segments, _ = MODEL.transcribe(
                tmp_path, language=language, beam_size=1,
                vad_filter=vad_filter, condition_on_previous_text=False
            )
            result[0] = " ".join(seg.text.strip() for seg in segments)
        except Exception as e:
            error[0] = str(e)

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=300)  # максимум 5 минут на файл

    if t.is_alive():
        return None, "Таймаут транскрипции (>5 мин). Попробуйте файл меньшего размера."
    if error[0]:
        return None, error[0]
    return result[0], None


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

    suffix = os.path.splitext(audio_file.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        print(f"⏳ Транскрибируем: {audio_file.filename} (lang={language})", flush=True)

        transcript, err = _do_transcribe(tmp_path, language, vad_filter=True)
        if err:
            return jsonify({"success": False, "error": err}), 500

        print(f"✅ VAD результат: {len(transcript)} символов", flush=True)

        # Если VAD отфильтровал всё — retry без VAD
        if not transcript.strip():
            print("⚠️ VAD пустой результат, пробуем без VAD...", flush=True)
            transcript, err = _do_transcribe(tmp_path, language, vad_filter=False)
            if err:
                return jsonify({"success": False, "error": err}), 500
            print(f"✅ Без VAD: {len(transcript)} символов", flush=True)

        return jsonify({"success": True, "transcript": transcript, "language": language})
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=False)
