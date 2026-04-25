# Phase 7: Fix CUDA transcription timeout issue - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Source:** Current production issue (long audio files hanging during transcription)

---

## Phase Boundary

**Goal:** Resolve transcription timeout issue for long audio files (20+ minutes) by:
1. Ensuring CUDA GPU acceleration works correctly
2. Implementing voice activity detection (VAD) to skip silence
3. Fixing CPU fallback when CUDA unavailable
4. Managing PyInstaller dependencies (NVIDIA CUDA DLLs, Faster-Whisper assets)
5. Testing end-to-end with real hardware

**In Scope:**
- Fix whisper_service.py CUDA loading and CPU fallback
- Add vad_filter=True to Faster-Whisper calls
- Update PyInstaller spec to include CUDA binaries and ONNX model files
- Rebuild whisper_service.exe with correct dependencies
- Test with real 20-30 minute audio files
- Ensure transcription completes in reasonable time (<10 min for 30-min file)

**Out of Scope:**
- Changing transcription models (staying with "small" model)
- Implementing streaming/chunked transcription
- Database optimization
- Frontend redesign

---

## Implementation Decisions

### CUDA Support
- Keep `WhisperModel("small", device="cuda", compute_type="float16")` as primary
- Add proper CPU fallback: `WhisperModel("small", device="cpu", compute_type="int8")`
- Both configured with `vad_filter=True` and `condition_on_previous_text=False`
- Decision: Fixed PyInstaller spec to include NVIDIA CUDA binaries (cublas, cudnn)

### Performance Optimization
- `vad_filter=True` — skips silence in audio, major speedup for voice recordings
- `condition_on_previous_text=False` — speeds up inference, reduces hallucination
- `beam_size=1` — keeps existing fast-but-accurate settings
- No chunk-based processing (keep current synchronous model)

### Dependency Management
- PyInstaller spec updated to bundle:
  - nvidia-cublas-cu12 binaries
  - nvidia-cublasLt64_12.dll
  - ctranslate2 DLLs (faster_whisper dependency)
  - faster_whisper/assets/ (silero_vad_v6.onnx model)

### Testing
- Use existing app (Electron wrapper for whisper_service.exe)
- Test files: 23-minute and 29-minute m4a recordings
- Success: transcription completes within timeout (30 seconds observed, previously hung at 10+ min)

---

## Canonical References

None — requirements fully captured in decisions above.

---

## Specific Ideas

**What was already done (no regression):**
- Frontend: Added elapsed time counter during transcription (shows "Транскрибируем... (589 сек)")
- Backend: No changes to Node.js routes (still working)
- Config: .env already has CUDA toolkit installed on user's system

**What needs testing:**
- Confirm CUDA model loads successfully (logs should show "CUDA (float16)" not "CPU")
- Test 23-30 minute files to verify they complete in <10 minutes
- Check that whisper_service logs show "✅ Модель загружена. Устройство: CUDA"

---

## Deferred Ideas

- Streaming transcription (Phase 8+)
- Model switching (base vs small vs medium selection)
- Batch processing multiple files
- GPU memory optimization for larger models
- Alternative backends (Groq API)

---

*Phase: 07-fix-cuda-transcription-timeout-issue*
*Context gathered: 2026-04-25 from current production debugging*
