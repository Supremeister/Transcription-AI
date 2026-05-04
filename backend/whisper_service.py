# -*- coding: utf-8 -*-
"""
Whisper микросервис - модель загружается один раз при старте.
Принимает аудио файлы, возвращает транскрипцию.
Поддерживает speaker diarization через pyannote.audio (если HF_TOKEN задан).
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

# В frozen exe ctranslate2/__init__.py сам добавляет свою папку в os.add_dll_directory
# и preload-ит DLL через ctypes.CDLL. Нам только нужно добавить _MEIPASS в PATH
# чтобы .pyd файлы находились корректно.
if getattr(sys, 'frozen', False):
    import ctypes
    import glob
    # Добавляем корень _MEIPASS для .pyd и прочих бинарей
    os.add_dll_directory(sys._MEIPASS)
    # Явно добавляем ctranslate2/ папку и preload всех DLL
    # (importlib.resources.files() в frozen exe работает неправильно)
    ct2_dir = os.path.join(sys._MEIPASS, 'ctranslate2')
    if os.path.exists(ct2_dir):
        os.add_dll_directory(ct2_dir)
        for dll in glob.glob(os.path.join(ct2_dir, '*.dll')):
            try:
                ctypes.CDLL(dll)
                print(f"✅ Loaded DLL: {os.path.basename(dll)}", flush=True)
            except Exception as e:
                print(f"⚠️ Failed to load {os.path.basename(dll)}: {e}", flush=True)
    print(f"ℹ️ Frozen exe. DLL dir: {sys._MEIPASS}", flush=True)

# ─── Перехватываем прогресс загрузки модели ──────────────────────────────────
try:
    from tqdm import tqdm as _orig_tqdm
    class _ProgressTqdm(_orig_tqdm):
        def display(self, *args, **kwargs):
            if self.total and self.total > 1024 * 1024:
                mb_done = self.n / (1024 * 1024)
                mb_total = self.total / (1024 * 1024)
                pct = int(self.n / self.total * 100)
                print(f"DOWNLOAD_PROGRESS:{pct}:{mb_done:.1f}:{mb_total:.1f}", flush=True)
            return super().display(*args, **kwargs)
    import tqdm as _tqdm_mod
    _tqdm_mod.tqdm = _ProgressTqdm
except Exception:
    pass

# ─── Загружаем Whisper ────────────────────────────────────────────────────────
print("⏳ Загружаем Whisper модель...", flush=True)
MODEL = None
device = "cpu"
compute_type = "int8"

try:
    from faster_whisper import WhisperModel
    MODEL = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
    device = "cuda"
    compute_type = "float16"
    print("✅ Модель загружена. Устройство: CUDA (float16)", flush=True)
except Exception as e:
    print(f"⚠️ CUDA недоступна: {e}", flush=True)

if MODEL is None:
    try:
        from faster_whisper import WhisperModel
        MODEL = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
        device = "cpu"
        compute_type = "int8"
        print("✅ Модель загружена. Устройство: CPU (int8)", flush=True)
    except Exception as e2:
        print(f"❌ Ошибка загрузки модели: {e2}", flush=True)
        MODEL = None

# ─── Загружаем pyannote (опционально) ────────────────────────────────────────
DIARIZER = None
HF_TOKEN = os.environ.get("HF_TOKEN")

if HF_TOKEN:
    try:
        import torch
        from pyannote.audio import Pipeline
        print("⏳ Загружаем pyannote speaker diarization...", flush=True)
        DIARIZER = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=HF_TOKEN
        )
        # Запускаем на CPU чтобы не конфликтовать с Whisper по VRAM
        DIARIZER = DIARIZER.to(torch.device("cpu"))
        print("✅ Диаризация загружена (CPU)", flush=True)
    except Exception as e:
        print(f"⚠️ Диаризация недоступна: {e}", flush=True)
        DIARIZER = None
else:
    print("ℹ️ HF_TOKEN не задан — диаризация отключена", flush=True)


# ─── Транскрипция ─────────────────────────────────────────────────────────────

def _do_transcribe(tmp_path, language, vad_filter):
    """Транскрипция в отдельном потоке. Возвращает список сегментов с таймстемпами."""
    result = [None]
    error = [None]

    def worker():
        try:
            segments_gen, _ = MODEL.transcribe(
                tmp_path, language=language, beam_size=1,
                vad_filter=vad_filter, condition_on_previous_text=False
            )
            result[0] = [
                {'start': s.start, 'end': s.end, 'text': s.text.strip()}
                for s in segments_gen
            ]
        except Exception as e:
            error[0] = str(e)

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=600)  # 10 минут максимум

    if t.is_alive():
        return None, "Таймаут транскрипции (>10 мин). Попробуйте файл меньшего размера."
    if error[0]:
        return None, error[0]
    return result[0], None


def _assign_speakers(whisper_segs, diarization):
    """Назначает спикера каждому whisper-сегменту по максимальному перекрытию."""
    speaker_map = {}  # SPEAKER_00 → Собеседник 1, etc.
    counter = [0]

    def get_label(raw_speaker):
        if raw_speaker not in speaker_map:
            counter[0] += 1
            speaker_map[raw_speaker] = f"Собеседник {counter[0]}"
        return speaker_map[raw_speaker]

    result = []
    for seg in whisper_segs:
        best_speaker = None
        best_overlap = 0.0
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            overlap = min(seg['end'], turn.end) - max(seg['start'], turn.start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        label = get_label(best_speaker) if best_speaker else "Собеседник 1"
        result.append({**seg, 'speaker': label})
    return result


def _merge_consecutive(segments):
    """Склеивает подряд идущие сегменты одного спикера в один блок."""
    if not segments:
        return []
    merged = []
    current = dict(segments[0])
    for seg in segments[1:]:
        if seg['speaker'] == current['speaker']:
            current['text'] += ' ' + seg['text']
            current['end'] = seg['end']
        else:
            merged.append(current)
            current = dict(seg)
    merged.append(current)
    return merged


# ─── Эндпоинты ───────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok" if MODEL else "error",
        "model": "large-v3-turbo",
        "device": device if MODEL else "unknown",
        "diarization": DIARIZER is not None
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

        segments, err = _do_transcribe(tmp_path, language, vad_filter=True)
        if err:
            return jsonify({"success": False, "error": err}), 500

        plain_text = " ".join(s['text'] for s in segments) if segments else ""
        print(f"✅ VAD результат: {len(plain_text)} символов", flush=True)

        # Если VAD отфильтровал всё — retry без VAD
        if not plain_text.strip():
            print("⚠️ VAD пустой результат, пробуем без VAD...", flush=True)
            segments, err = _do_transcribe(tmp_path, language, vad_filter=False)
            if err:
                return jsonify({"success": False, "error": err}), 500
            plain_text = " ".join(s['text'] for s in segments) if segments else ""
            print(f"✅ Без VAD: {len(plain_text)} символов", flush=True)

        # Диаризация (если доступна)
        diarized_segments = None
        if DIARIZER and segments:
            try:
                print("⏳ Диаризация...", flush=True)
                diarization = DIARIZER(tmp_path)
                raw = _assign_speakers(segments, diarization)
                diarized_segments = _merge_consecutive(raw)
                print(f"✅ Диаризация: {len(diarized_segments)} блоков", flush=True)
            except Exception as e:
                print(f"⚠️ Ошибка диаризации: {e}", flush=True)

        response_data = {"success": True, "transcript": plain_text, "language": language}
        if diarized_segments:
            # Полная диаризация (только в dev/py режиме)
            response_data["segments"] = diarized_segments
            response_data["diarized"] = True
        elif segments:
            # Возвращаем сырые сегменты с таймстемпами — Node.js вызовет diarize.py
            response_data["whisper_segments"] = segments

        return jsonify(response_data)

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=False)
