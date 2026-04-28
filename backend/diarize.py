# -*- coding: utf-8 -*-
"""
Отдельный скрипт диаризации — вызывается Node.js после транскрипции.
Принимает путь к аудио и JSON сегментов whisper, возвращает JSON с метками спикеров.

Использование:
  python diarize.py <audio_path> <segments_json> [hf_token]
"""
import sys
import json
import os

# Принудительно UTF-8 для stdout на Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Не хватает аргументов"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    segments_file = sys.argv[2]
    hf_token = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("HF_TOKEN")

    with open(segments_file, 'r', encoding='utf-8') as f:
        segments = json.loads(f.read())

    if not hf_token:
        print(json.dumps({"error": "HF_TOKEN не задан"}))
        sys.exit(1)

    if not segments:
        print(json.dumps({"segments": []}))
        return

    try:
        import torch
        from pyannote.audio import Pipeline

        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=hf_token
        )
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        pipeline = pipeline.to(device)

        # Загружаем аудио через soundfile (обходит проблему с torchcodec/FFmpeg)
        import soundfile as sf
        import numpy as np
        data, sample_rate = sf.read(audio_path, always_2d=True)
        # soundfile возвращает (time, channels) → нужно (channels, time)
        waveform = torch.tensor(data.T, dtype=torch.float32)
        audio_input = {"waveform": waveform, "sample_rate": sample_rate}
        diarization = pipeline(audio_input)

        # Маппинг SPEAKER_00 → Собеседник 1
        speaker_map = {}
        counter = 0

        def get_label(raw):
            nonlocal counter
            if raw not in speaker_map:
                counter += 1
                speaker_map[raw] = f"Собеседник {counter}"
            return speaker_map[raw]

        # pyannote 4.x возвращает DiarizeOutput — берём .speaker_diarization
        annotation = diarization.speaker_diarization if hasattr(diarization, 'speaker_diarization') else diarization

        # Назначаем спикера каждому сегменту по максимальному перекрытию
        result = []
        for seg in segments:
            best_speaker = None
            best_overlap = 0.0
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                overlap = min(seg["end"], turn.end) - max(seg["start"], turn.start)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = speaker
            label = get_label(best_speaker) if best_speaker else "Собеседник 1"
            result.append({**seg, "speaker": label})

        # Склеиваем подряд идущие блоки одного спикера
        merged = []
        if result:
            cur = dict(result[0])
            for s in result[1:]:
                if s["speaker"] == cur["speaker"]:
                    cur["text"] += " " + s["text"]
                    cur["end"] = s["end"]
                else:
                    merged.append(cur)
                    cur = dict(s)
            merged.append(cur)

        print(json.dumps({"segments": merged}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
