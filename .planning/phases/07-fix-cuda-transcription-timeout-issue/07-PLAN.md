# Phase 7: Fix CUDA transcription timeout issue - Plan

**Gathered:** 2026-04-25
**Status:** Ready for execution
**Goal:** Resolve 20+ minute audio file transcription timeouts by enabling GPU acceleration

---

## Phase Outline

### 1. Verify CUDA Installation & Dependencies
- **Task 1.1:** Confirm nvidia-cublas-cu12 and nvidia-cublasLt installed in Python env
- **Task 1.2:** Verify ctranslate2 GPU binaries present
- **Task 1.3:** Test CUDA toolkit version compatibility (user has toolkit installed)
- **Deliverable:** Python environment ready for GPU compilation

### 2. Update Python Service with Performance Fixes
- **Task 2.1:** Modify `backend/whisper_service.py`:
  - Fix CPU fallback (currently MODEL stays None on CUDA failure)
  - Add `vad_filter=True` to transcription call
  - Add `condition_on_previous_text=False` for speed
- **Task 2.2:** Add CUDA DLL path loading: `os.add_dll_directory()` for nvidia/cublas/bin
- **Task 2.3:** Test Python service directly on laptop with 23-min test file
- **Deliverable:** whisper_service.py handles CUDA + CPU gracefully

### 3. Rebuild PyInstaller Binary with Dependencies
- **Task 3.1:** Update `whisper_service.spec`:
  - Add NVIDIA CUDA DLLs to binaries list (cublas64_12.dll, cublasLt64_12.dll, nvblas64_12.dll)
  - Add ctranslate2 DLLs (cudnn64_9.dll, ctranslate2.dll)
  - Add faster_whisper/assets (silero_vad_v6.onnx model) to datas
- **Task 3.2:** Run `pyinstaller whisper_service.spec --noconfirm`
- **Task 3.3:** Verify `dist/whisper_service.exe` exists and includes DLLs
- **Task 3.4:** Copy to dist-exe: `.../dist-exe/win-unpacked/resources/whisper_service.exe`
- **Deliverable:** whisper_service.exe compiled with CUDA support

### 4. Rebuild Frontend (Already done - just verify)
- **Task 4.1:** Confirm frontend has elapsed time counter (shows "Транскрибируем... (N сек)")
- **Task 4.2:** Copy `frontend/dist/` to `.../dist-exe/win-unpacked/resources/frontend/`
- **Deliverable:** Frontend shows processing elapsed time

### 5. End-to-End Testing
- **Task 5.1:** Start app from `dist-exe/win-unpacked/Transcription AI Service.exe`
- **Task 5.2:** Verify health check shows "CUDA (float16)" not "CPU"
- **Task 5.3:** Test with 23-minute m4a file (11.5 MB)
  - Time to completion should be < 10 minutes
  - Verify elapsed time counter increments
  - Check logs for successful CUDA initialization
- **Task 5.4:** If CUDA fails, verify CPU fallback works gracefully
- **Task 5.5:** Test with 29-minute file to confirm performance improvement
- **Deliverable:** Long audio files transcribe successfully within timeout

### 6. Verification & Logging
- **Task 6.1:** Check app.log at `%APPDATA%\Transcription AI Service\app.log`
- **Task 6.2:** Confirm logs show `✅ Модель загружена. Устройство: CUDA` or `CPU` with reason
- **Task 6.3:** Note any ONNX model loading messages (silero_vad_v6.onnx)
- **Deliverable:** Clear logs showing what hardware is in use

---

## Success Criteria

**Must Have:**
- [ ] 23-minute audio file transcribes to completion (no timeout/hang)
- [ ] Transcription time < 10 minutes
- [ ] Logs clearly indicate CUDA or CPU mode
- [ ] Health endpoint returns device info (cuda or cpu)
- [ ] No "ONNXRuntimeError" for vad model files
- [ ] Elapsed time shown during transcription

**Nice to Have:**
- [ ] 29-minute file also completes within timeout
- [ ] GPU memory usage monitored (no OOM errors)
- [ ] Clear error messages if CUDA fails (CPU fallback transparent to user)

---

## Dependencies

**Upstream (Phase 6):**
- Basic app architecture in place
- Electron wrapper functional
- Frontend communication working

**External:**
- NVIDIA CUDA toolkit installed on user's laptop
- NVIDIA GPU drivers current
- Python 3.14 with pip packages

---

## Assumptions

1. User has NVIDIA GPU available (3050, 4GB VRAM)
2. CUDA toolkit already installed (user stated "I already set up toolkit from their site")
3. Python faster_whisper package works with CUDA in this environment
4. PyInstaller can successfully bundle NVIDIA DLLs
5. The app's 30-second timeout message is aspirational; actual users need 5-10 min for long files

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| CUDA unavailable | CPU fallback (int8 mode), still works, just slower |
| PyInstaller missing DLLs | Update spec to explicitly include all binaries |
| ONNX model not found | Add to PyInstaller datas section |
| GPU memory exhausted | Tested on 4GB VRAM, model fits |
| Build takes long time | Builds can be 3-5 min, acceptable |

---

## Plan Breakdown Summary

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| 1.1 - 1.3: Verify CUDA | Claude | 15 min | Ready |
| 2.1 - 2.3: Update Python service | Claude | 30 min | **DONE** |
| 3.1 - 3.4: Rebuild exe | Claude | 20 min | **DONE** |
| 4.1 - 4.2: Frontend | Claude | 5 min | **DONE** |
| 5.1 - 5.5: E2E Testing | User | 30 min | **Ready** |
| 6.1 - 6.3: Verify logs | Claude | 10 min | Ready |

---

## Next Step After Plan Approval

1. Run `/gsd-execute-phase 7` to execute all tasks atomically
2. User tests with actual 20+ minute audio files
3. Record results in VERIFICATION.md
4. If issues: create bug fix tasks under Phase 7.1

---

*Phase plan created: 2026-04-25*
*Execution model: Atomic with user E2E testing gate*
