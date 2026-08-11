# -*- coding: utf-8 -*-
"""Local GigaAM transcription, punctuation restoration, and diarization service."""

from __future__ import annotations

import gc
import io
import math
import os
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Iterable

from flask import Flask, jsonify, request


def _configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "buffer"):
            setattr(
                sys,
                stream_name,
                io.TextIOWrapper(
                    stream.buffer,
                    encoding="utf-8",
                    errors="replace",
                    line_buffering=True,
                ),
            )


def _configure_environment() -> None:
    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        if os.environ.get(key, "").lower().startswith("socks4://"):
            os.environ.pop(key, None)
    os.environ.setdefault("NO_PROXY", "127.0.0.1,localhost")
    os.environ.setdefault("no_proxy", os.environ["NO_PROXY"])
    os.environ.setdefault("PYANNOTE_METRICS_ENABLED", "0")
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")


_configure_stdio()
_configure_environment()

app = Flask(__name__)

ASR_MODEL_ID = "v3_rnnt"
ASR_MODEL_LABEL = "GigaAM-v3-RNNT"
PUNCTUATION_MODEL_ID = "RUPunct/RUPunct_medium"
PUNCTUATION_MODEL_REVISION = "af9d9fb7fbd9077aed7c4aafb78fdb3bb3b4c2b7"
PUNCTUATION_MODEL_LABEL = "RUPunct Medium"
DIARIZATION_MODEL_ID = "pyannote/speaker-diarization-community-1"
SERVICE_PORT = int(os.environ.get("GIGAAM_SERVICE_PORT", "17801"))
CPU_DEVICE = "cpu"
MIN_OVERLAP_DURATION = 0.45
MIN_UTTERANCE_OVERLAP_SECONDS = 0.5
MIN_UTTERANCE_OVERLAP_RATIO = 0.08

MODEL_LOCK = threading.Lock()
ASR_MODEL: Any = None
PUNCTUATION_MODEL: Any = None
PUNCTUATION_TOKENIZER: Any = None
DIARIZER: Any = None
TORCH: Any = None
ACCELERATION_DEVICE = CPU_DEVICE
MODEL_LOAD_ERROR: str | None = None
PUNCTUATION_LOAD_ERROR: str | None = None
DIARIZATION_LOAD_ERROR: str | None = None


def _speaker_options(mode: str | None) -> dict[str, int]:
    normalized = str(mode or "auto").strip().lower()
    if normalized in {"1", "2", "3", "4"}:
        return {"num_speakers": int(normalized)}
    if normalized in {"4+", "4plus", "many"}:
        return {"min_speakers": 4, "max_speakers": 8}
    return {"min_speakers": 1, "max_speakers": 6}


def _safe_longform_segmenter(
    wav_file: str,
    sr: int,
    max_duration: float = 22.0,
    min_duration: float = 15.0,
    strict_limit_duration: float = 30.0,
    new_chunk_threshold: float = 0.2,
    device: Any = None,
) -> tuple[list[Any], list[tuple[float, float]]]:
    """GigaAM long-form VAD that bypasses broken TorchCodec on Windows."""
    import gigaam
    import gigaam.vad_utils as vad_utils

    target_device = device or TORCH.device(CPU_DEVICE)
    audio = gigaam.load_audio(wav_file, sample_rate=sr)
    pipeline = vad_utils.get_pipeline(target_device)
    vad_result = pipeline({"waveform": audio.unsqueeze(0), "sample_rate": sr})

    segments: list[Any] = []
    boundaries: list[tuple[float, float]] = []

    def append_range(start: float, end: float) -> None:
        duration = max(0.0, end - start)
        if duration <= new_chunk_threshold:
            return
        parts = max(1, math.ceil(duration / strict_limit_duration))
        part_duration = duration / parts
        for part_index in range(parts):
            part_start = start + part_index * part_duration
            part_end = end if part_index == parts - 1 else part_start + part_duration
            segments.append(audio[int(part_start * sr) : int(part_end * sr)])
            boundaries.append((part_start, part_end))

    current_start: float | None = None
    current_end = 0.0
    audio_duration = audio.shape[0] / sr

    for speech in vad_result.get_timeline().support():
        start = max(0.0, float(speech.start))
        end = min(audio_duration, float(speech.end))
        if current_start is None:
            current_start = start
        else:
            current_duration = current_end - current_start
            prospective_duration = end - current_start
            if current_duration > new_chunk_threshold and (
                prospective_duration > max_duration or current_duration > min_duration
            ):
                append_range(current_start, current_end)
                current_start = start
        current_end = end

    if current_start is not None:
        append_range(current_start, current_end)

    return segments, boundaries


def _install_safe_gigaam_vad() -> None:
    import gigaam.vad_utils as vad_utils

    vad_utils.segment_audio_file = _safe_longform_segmenter


def _move_pipeline(pipeline: Any, device: str) -> None:
    if pipeline is not None:
        pipeline.to(TORCH.device(device))


def _release_cuda() -> None:
    if TORCH is None or not TORCH.cuda.is_available():
        return
    gc.collect()
    TORCH.cuda.empty_cache()


def _move_gigaam_vad_to_cpu() -> None:
    try:
        import gigaam.vad_utils as vad_utils

        if getattr(vad_utils, "_PIPELINE", None) is not None:
            vad_utils._PIPELINE.to(TORCH.device(CPU_DEVICE))
    except Exception as exc:
        print(f"Could not move GigaAM VAD to CPU: {exc}", flush=True)


def initialize_models() -> None:
    global ASR_MODEL
    global PUNCTUATION_MODEL
    global PUNCTUATION_TOKENIZER
    global DIARIZER
    global TORCH
    global ACCELERATION_DEVICE
    global MODEL_LOAD_ERROR
    global PUNCTUATION_LOAD_ERROR
    global DIARIZATION_LOAD_ERROR

    try:
        import gigaam
        import torch

        TORCH = torch
        if torch.cuda.is_available():
            ACCELERATION_DEVICE = "cuda"
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True

        _install_safe_gigaam_vad()
        print(f"Loading {ASR_MODEL_LABEL} on {ACCELERATION_DEVICE}...", flush=True)
        ASR_MODEL = gigaam.load_model(
            ASR_MODEL_ID,
            device=ACCELERATION_DEVICE,
            fp16_encoder=ACCELERATION_DEVICE == "cuda",
            use_flash=False,
        )
        if ACCELERATION_DEVICE == "cuda":
            ASR_MODEL.to(TORCH.device(CPU_DEVICE))
            _release_cuda()
        print(f"{ASR_MODEL_LABEL} ready", flush=True)
    except Exception as exc:
        MODEL_LOAD_ERROR = str(exc)
        print(f"GigaAM load failed: {exc}", flush=True)

    try:
        from transformers.models.electra.modeling_electra import (
            ElectraForTokenClassification,
        )
        from transformers.models.electra.tokenization_electra_fast import (
            ElectraTokenizerFast,
        )

        print(f"Loading {PUNCTUATION_MODEL_LABEL} on CPU...", flush=True)
        PUNCTUATION_TOKENIZER = ElectraTokenizerFast.from_pretrained(
            PUNCTUATION_MODEL_ID,
            revision=PUNCTUATION_MODEL_REVISION,
            strip_accents=False,
            add_prefix_space=True,
        )
        PUNCTUATION_MODEL = ElectraForTokenClassification.from_pretrained(
            PUNCTUATION_MODEL_ID,
            revision=PUNCTUATION_MODEL_REVISION,
            use_safetensors=False,
        )
        PUNCTUATION_MODEL.eval()
        PUNCTUATION_MODEL.to(TORCH.device(CPU_DEVICE))
        print(f"{PUNCTUATION_MODEL_LABEL} ready", flush=True)
    except Exception as exc:
        PUNCTUATION_LOAD_ERROR = str(exc)
        print(f"Punctuation model load failed: {exc}", flush=True)

    token = os.environ.get("HF_TOKEN")
    if not token:
        DIARIZATION_LOAD_ERROR = "HF_TOKEN не задан"
        print("HF_TOKEN not set: diarization is disabled", flush=True)
        return

    try:
        from pyannote.audio import Pipeline

        print(f"Loading {DIARIZATION_MODEL_ID}...", flush=True)
        DIARIZER = Pipeline.from_pretrained(DIARIZATION_MODEL_ID, token=token)
        print("Community-1 ready", flush=True)
    except Exception as exc:
        DIARIZATION_LOAD_ERROR = str(exc)
        print(f"Community-1 load failed: {exc}", flush=True)


def _run_asr(audio_path: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    if ASR_MODEL is None:
        raise RuntimeError(MODEL_LOAD_ERROR or "GigaAM model is not loaded")

    _move_pipeline(ASR_MODEL, ACCELERATION_DEVICE)
    try:
        result = ASR_MODEL.transcribe_longform(
            audio_path,
            word_timestamps=True,
            fr_batch_size=1,
            fr_num_workers=0,
        )
        words = [
            {
                "text": word.text.strip(),
                "start": round(float(word.start), 3),
                "end": round(float(word.end), 3),
            }
            for word in result.words
            if word.text.strip()
        ]
        source_segments = [
            {
                "text": segment.text.strip(),
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "words": [
                    {
                        "text": word.text.strip(),
                        "start": round(float(word.start), 3),
                        "end": round(float(word.end), 3),
                    }
                    for word in (segment.words or [])
                    if word.text.strip()
                ],
            }
            for segment in result.segments
            if segment.text.strip()
        ]
        return result.text.strip(), words, source_segments
    finally:
        if ACCELERATION_DEVICE == "cuda":
            ASR_MODEL.to(TORCH.device(CPU_DEVICE))
            _move_gigaam_vad_to_cpu()
            _release_cuda()


def _capitalize_word(text: str) -> str:
    for index, character in enumerate(text):
        if character.isalpha():
            return text[:index] + character.upper() + text[index + 1 :]
    return text


def _apply_punctuation_label(text: str, label: str) -> str:
    base = text.strip().rstrip(".,!?;:…—")
    if not base:
        return ""

    if label.startswith("UPPER_TOTAL_"):
        punctuation_name = label[len("UPPER_TOTAL_") :]
        base = base.upper()
    elif label.startswith("UPPER_"):
        punctuation_name = label[len("UPPER_") :]
        base = _capitalize_word(base)
    elif label.startswith("LOWER_"):
        punctuation_name = label[len("LOWER_") :]
        base = base.lower()
    else:
        punctuation_name = "O"

    punctuation = {
        "O": "",
        "PERIOD": ".",
        "COMMA": ",",
        "QUESTION": "?",
        "TIRE": " —",
        "VOSKL": "!",
        "DVOETOCHIE": ":",
        "PERIODCOMMA": ";",
        "DEFIS": "-",
        "QUESTIONVOSKL": "?!",
        "MNOGOTOCHIE": "…",
    }.get(punctuation_name, "")
    return base + punctuation


def _punctuation_chunks(
    words: list[dict[str, Any]],
    max_words: int = 100,
    max_duration: float = 25.0,
    pause_boundary: float = 1.6,
) -> list[tuple[int, int]]:
    if not words:
        return []

    chunks: list[tuple[int, int]] = []
    chunk_start = 0
    for index in range(1, len(words)):
        gap = float(words[index]["start"]) - float(words[index - 1]["end"])
        duration = float(words[index - 1]["end"]) - float(words[chunk_start]["start"])
        if (
            index - chunk_start >= max_words
            or duration >= max_duration
            or gap >= pause_boundary
        ):
            chunks.append((chunk_start, index))
            chunk_start = index
    chunks.append((chunk_start, len(words)))
    return chunks


def _restore_punctuation(
    words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    clean_words = [
        {**word, "text": str(word.get("text", "")).strip()}
        for word in words
        if str(word.get("text", "")).strip().strip(".,!?;:…—-")
    ]
    if not clean_words:
        return []

    if PUNCTUATION_MODEL is None or PUNCTUATION_TOKENIZER is None:
        clean_words[0]["text"] = _capitalize_word(clean_words[0]["text"])
        return clean_words

    target_device = (
        ACCELERATION_DEVICE
        if TORCH is not None and TORCH.cuda.is_available()
        else CPU_DEVICE
    )
    PUNCTUATION_MODEL.to(TORCH.device(target_device))
    try:
        for chunk_start, chunk_end in _punctuation_chunks(clean_words):
            chunk = clean_words[chunk_start:chunk_end]
            chunk_texts = [word["text"] for word in chunk]
            encoded = PUNCTUATION_TOKENIZER(
                chunk_texts,
                is_split_into_words=True,
                return_tensors="pt",
                truncation=True,
                max_length=512,
            )
            model_inputs = {
                key: value.to(TORCH.device(target_device))
                for key, value in encoded.items()
            }
            with TORCH.inference_mode():
                predictions = (
                    PUNCTUATION_MODEL(**model_inputs)
                    .logits[0]
                    .argmax(dim=-1)
                    .detach()
                    .cpu()
                    .tolist()
                )

            seen_word_ids: set[int] = set()
            for token_index, word_index in enumerate(encoded.word_ids()):
                if word_index is None or word_index in seen_word_ids:
                    continue
                seen_word_ids.add(word_index)
                label = PUNCTUATION_MODEL.config.id2label[predictions[token_index]]
                chunk[word_index]["text"] = _apply_punctuation_label(
                    chunk[word_index]["text"],
                    label,
                )
            chunk[0]["text"] = _capitalize_word(chunk[0]["text"])
    except Exception as exc:
        print(f"Punctuation restoration failed: {exc}", flush=True)
        clean_words[0]["text"] = _capitalize_word(clean_words[0]["text"])
    finally:
        if target_device == "cuda":
            PUNCTUATION_MODEL.to(TORCH.device(CPU_DEVICE))
            _release_cuda()
    return clean_words


def _join_word_texts(words: Iterable[dict[str, Any]]) -> str:
    text = ""
    for word in words:
        token = str(word.get("text", "")).strip()
        if not token:
            continue
        token_base = token.rstrip(".,!?;:…").lower()
        if text.endswith(" —") and token_base in {"то", "либо", "нибудь", "ка"}:
            text = text[:-2] + "-" + token
            continue
        separator = "" if text.endswith("-") else " "
        text = token if not text else text + separator + token
    return text


def _ensure_utterance_boundaries(
    words: list[dict[str, Any]],
    max_gap: float = 1.4,
) -> list[dict[str, Any]]:
    normalized = [dict(word) for word in words if str(word.get("text", "")).strip()]
    if not normalized:
        return []

    normalized[0]["text"] = _capitalize_word(normalized[0]["text"])
    for index, word in enumerate(normalized):
        is_last = index == len(normalized) - 1
        next_word = None if is_last else normalized[index + 1]
        is_boundary = (
            is_last
            or next_word.get("speaker") != word.get("speaker")
            or float(next_word["start"]) - float(word["end"]) > max_gap
        )
        if not is_boundary:
            continue

        text = str(word["text"]).rstrip()
        if not text.endswith((".", "?", "!", "…")):
            text = text.rstrip(",;:—- ") + "."
        word["text"] = text
        if next_word is not None:
            next_word["text"] = _capitalize_word(next_word["text"])
    return normalized


def _annotation_turns(annotation: Any) -> list[dict[str, Any]]:
    return [
        {
            "start": float(turn.start),
            "end": float(turn.end),
            "raw_speaker": str(speaker),
        }
        for turn, _, speaker in annotation.itertracks(yield_label=True)
    ]


def _best_speaker(
    start: float,
    end: float,
    turns: Iterable[dict[str, Any]],
) -> str | None:
    best_raw: str | None = None
    best_overlap = 0.0
    midpoint = (start + end) / 2
    nearest_distance = float("inf")
    nearest_raw: str | None = None

    for turn in turns:
        overlap = min(end, turn["end"]) - max(start, turn["start"])
        if overlap > best_overlap:
            best_overlap = overlap
            best_raw = turn["raw_speaker"]
        if midpoint < turn["start"]:
            distance = turn["start"] - midpoint
        elif midpoint > turn["end"]:
            distance = midpoint - turn["end"]
        else:
            distance = 0.0
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_raw = turn["raw_speaker"]

    # ASR and diarization boundaries can differ by more than a second around
    # pauses. The nearest known turn is still safer than inventing a new speaker.
    return best_raw or nearest_raw


def _create_speaker_mapper(turns: Iterable[dict[str, Any]]):
    mapping: dict[str, str] = {}

    def label(raw_speaker: str | None) -> str:
        raw = raw_speaker or "UNKNOWN"
        if raw not in mapping:
            mapping[raw] = f"Собеседник {len(mapping) + 1}"
        return mapping[raw]

    for turn in sorted(turns, key=lambda item: (item["start"], item["end"])):
        label(turn["raw_speaker"])
    return label, mapping


def _assign_words(
    words: list[dict[str, Any]],
    exclusive_turns: list[dict[str, Any]],
    speaker_label: Any,
) -> list[dict[str, Any]]:
    assigned = []
    for word in words:
        raw_speaker = _best_speaker(word["start"], word["end"], exclusive_turns)
        assigned.append({**word, "speaker": speaker_label(raw_speaker)})
    return assigned


def _build_utterances(
    words: list[dict[str, Any]],
    max_gap: float = 1.4,
    max_chars: int = 900,
) -> list[dict[str, Any]]:
    clean_words = [
        dict(word)
        for word in words
        if str(word.get("text", "")).strip().strip(".,!?;:…—-")
    ]
    if not clean_words:
        return []

    utterances: list[dict[str, Any]] = []
    current = {
        "start": clean_words[0]["start"],
        "end": clean_words[0]["end"],
        "speaker": clean_words[0].get("speaker"),
        "text": clean_words[0]["text"],
        "words": [dict(clean_words[0])],
    }

    for word in clean_words[1:]:
        gap = word["start"] - current["end"]
        new_length = len(current["text"]) + 1 + len(word["text"])
        if (
            word.get("speaker") == current.get("speaker")
            and gap <= max_gap
            and new_length <= max_chars
        ):
            current["end"] = word["end"]
            current["words"].append(dict(word))
            current["text"] = _join_word_texts(current["words"])
        else:
            if current["text"].strip():
                utterances.append(current)
            current = {
                "start": word["start"],
                "end": word["end"],
                "speaker": word.get("speaker"),
                "text": word["text"],
                "words": [dict(word)],
            }
    if current["text"].strip():
        utterances.append(current)
    return utterances


def _extract_overlaps(
    regular_turns: list[dict[str, Any]],
    speaker_label: Any,
    minimum_duration: float = MIN_OVERLAP_DURATION,
) -> list[dict[str, Any]]:
    events: dict[float, dict[str, list[str]]] = {}
    for turn in regular_turns:
        events.setdefault(turn["start"], {"start": [], "end": []})["start"].append(
            turn["raw_speaker"]
        )
        events.setdefault(turn["end"], {"start": [], "end": []})["end"].append(
            turn["raw_speaker"]
        )

    active_counts: dict[str, int] = {}
    overlaps: list[dict[str, Any]] = []
    previous_time: float | None = None
    for event_time in sorted(events):
        active_speakers = sorted(
            speaker for speaker, count in active_counts.items() if count > 0
        )
        if (
            previous_time is not None
            and event_time - previous_time >= minimum_duration
            and len(active_speakers) >= 2
        ):
            overlaps.append(
                {
                    "start": round(previous_time, 3),
                    "end": round(event_time, 3),
                    "speakers": sorted(
                        speaker_label(speaker) for speaker in active_speakers
                    ),
                }
            )

        for speaker in events[event_time]["end"]:
            active_counts[speaker] = max(0, active_counts.get(speaker, 0) - 1)
        for speaker in events[event_time]["start"]:
            active_counts[speaker] = active_counts.get(speaker, 0) + 1
        previous_time = event_time

    merged: list[dict[str, Any]] = []
    for overlap in sorted(overlaps, key=lambda item: (item["start"], item["end"])):
        if (
            merged
            and merged[-1]["speakers"] == overlap["speakers"]
            and overlap["start"] - merged[-1]["end"] <= 0.1
        ):
            merged[-1]["end"] = max(merged[-1]["end"], overlap["end"])
        else:
            merged.append(overlap)
    return merged


def _mark_overlaps(
    utterances: list[dict[str, Any]],
    overlaps: list[dict[str, Any]],
) -> None:
    for utterance in utterances:
        utterance_duration = max(
            0.001,
            float(utterance["end"]) - float(utterance["start"]),
        )
        overlap_seconds = sum(
            max(
                0.0,
                min(float(utterance["end"]), float(overlap["end"]))
                - max(float(utterance["start"]), float(overlap["start"])),
            )
            for overlap in overlaps
        )
        overlap_ratio = min(1.0, overlap_seconds / utterance_duration)
        utterance["overlap_seconds"] = round(overlap_seconds, 2)
        utterance["overlap_ratio"] = round(overlap_ratio, 3)
        utterance["has_overlap"] = (
            overlap_seconds >= MIN_UTTERANCE_OVERLAP_SECONDS
            and overlap_ratio >= MIN_UTTERANCE_OVERLAP_RATIO
        )


def _run_diarization(
    audio_path: str,
    words: list[dict[str, Any]],
    speaker_mode: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], int]:
    if DIARIZER is None:
        raise RuntimeError(DIARIZATION_LOAD_ERROR or "Community-1 is not loaded")

    import gigaam

    waveform = gigaam.load_audio(audio_path, sample_rate=16000).unsqueeze(0)
    audio_input = {"waveform": waveform, "sample_rate": 16000}
    target_device = ACCELERATION_DEVICE if TORCH.cuda.is_available() else CPU_DEVICE
    _move_pipeline(DIARIZER, target_device)
    try:
        output = DIARIZER(audio_input, **_speaker_options(speaker_mode))
        regular_annotation = output.speaker_diarization
        exclusive_annotation = getattr(
            output,
            "exclusive_speaker_diarization",
            regular_annotation,
        )
        regular_turns = _annotation_turns(regular_annotation)
        exclusive_turns = _annotation_turns(exclusive_annotation)
        if not exclusive_turns:
            raise RuntimeError("Community-1 не обнаружила речевых сегментов")
        speaker_label, mapping = _create_speaker_mapper(exclusive_turns)
        assigned_words = _assign_words(words, exclusive_turns, speaker_label)
        assigned_words = _ensure_utterance_boundaries(assigned_words)
        overlaps = _extract_overlaps(regular_turns, speaker_label)
        utterances = _build_utterances(assigned_words)
        _mark_overlaps(utterances, overlaps)
        return assigned_words, utterances, overlaps, len(mapping)
    finally:
        if target_device == "cuda":
            _move_pipeline(DIARIZER, CPU_DEVICE)
            _release_cuda()


def _plain_segments(
    words: list[dict[str, Any]],
    source_segments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return _build_utterances(_ensure_utterance_boundaries(words))


@app.get("/health")
def health():
    status = "ok" if ASR_MODEL is not None else "error"
    return (
        jsonify(
            {
                "status": status,
                "model": ASR_MODEL_LABEL,
                "model_id": ASR_MODEL_ID,
                "device": ACCELERATION_DEVICE,
                "word_timestamps": True,
                "language": "ru",
                "punctuation": PUNCTUATION_MODEL is not None,
                "punctuation_model": PUNCTUATION_MODEL_LABEL,
                "diarization": DIARIZER is not None,
                "diarization_model": DIARIZATION_MODEL_ID,
                "model_error": MODEL_LOAD_ERROR,
                "punctuation_error": PUNCTUATION_LOAD_ERROR,
                "diarization_error": DIARIZATION_LOAD_ERROR,
            }
        ),
        200 if status == "ok" else 503,
    )


@app.post("/transcribe")
def transcribe():
    if "audio" not in request.files:
        return jsonify({"success": False, "error": "Аудиофайл не передан"}), 400
    if ASR_MODEL is None:
        return jsonify({"success": False, "error": MODEL_LOAD_ERROR}), 503

    audio_file = request.files["audio"]
    speaker_mode = request.form.get("speaker_mode", "auto")
    suffix = Path(audio_file.filename or "audio.wav").suffix or ".wav"
    started = time.perf_counter()

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        audio_file.save(temp_file.name)
        audio_path = temp_file.name

    try:
        with MODEL_LOCK:
            asr_started = time.perf_counter()
            transcript, words, source_segments = _run_asr(audio_path)
            asr_seconds = time.perf_counter() - asr_started

            punctuation_started = time.perf_counter()
            words = _restore_punctuation(words)
            punctuation_seconds = time.perf_counter() - punctuation_started

            diarization_seconds = 0.0
            diarization_error = None
            overlaps: list[dict[str, Any]] = []
            detected_speakers = 0
            diarized = False

            if words and DIARIZER is not None:
                diarization_started = time.perf_counter()
                try:
                    words, segments, overlaps, detected_speakers = _run_diarization(
                        audio_path,
                        words,
                        speaker_mode,
                    )
                    diarized = bool(segments)
                except Exception as exc:
                    diarization_error = str(exc)
                    print(f"Diarization failed: {exc}", flush=True)
                    words = _ensure_utterance_boundaries(words)
                    segments = _build_utterances(words)
                diarization_seconds = time.perf_counter() - diarization_started
            else:
                words = _ensure_utterance_boundaries(words)
                segments = _build_utterances(words)
                diarization_error = (
                    DIARIZATION_LOAD_ERROR if DIARIZER is None else None
                )

            transcript = _join_word_texts(words)

        return jsonify(
            {
                "success": True,
                "transcript": transcript,
                "words": words,
                "segments": segments,
                "overlaps": overlaps,
                "diarized": diarized,
                "speaker_count": detected_speakers,
                "speaker_mode": speaker_mode,
                "language": "ru",
                "model": ASR_MODEL_LABEL,
                "punctuation_model": (
                    PUNCTUATION_MODEL_LABEL
                    if PUNCTUATION_MODEL is not None
                    else None
                ),
                "punctuation_error": PUNCTUATION_LOAD_ERROR,
                "diarization_model": (
                    DIARIZATION_MODEL_ID if diarized else None
                ),
                "diarization_error": diarization_error,
                "timing": {
                    "asr_seconds": round(asr_seconds, 2),
                    "punctuation_seconds": round(punctuation_seconds, 2),
                    "diarization_seconds": round(diarization_seconds, 2),
                    "total_seconds": round(time.perf_counter() - started, 2),
                },
            }
        )
    except Exception as exc:
        print(f"Transcription failed: {exc}", flush=True)
        return jsonify({"success": False, "error": str(exc)}), 500
    finally:
        try:
            os.unlink(audio_path)
        except OSError:
            pass


if __name__ == "__main__":
    if os.environ.get("GIGAAM_SKIP_MODEL_LOAD") != "1":
        initialize_models()
    app.run(
        host="127.0.0.1",
        port=SERVICE_PORT,
        debug=False,
        threaded=False,
        use_reloader=False,
    )
