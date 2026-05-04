# Plan: Finalize, Verify, and Ship Installer Fixes

**Phase:** 07.1
**Goal:** Commit the remaining pending change (telegram_bot.py), verify all already-implemented fixes work correctly, build the NSIS installer, and confirm the installed app runs end-to-end.

---

## Context

Most fixes for this phase are already committed:
- CORS: `cors({ origin: true })` in `backend/src/server.js`
- Env vars: `loadEnvVar()` in `electron/main.js` reads `backend/.env`, injects into backend + whisper processes
- Groq key UI: Settings panel in `frontend/src/App.jsx` with localStorage persistence
- CUDA detection: `setup.bat` prompts user [Y/N] instead of auto-detecting
- HF token: loaded from `.env`, injected into whisper_service and backend
- Auto-update: `electron-updater` with 5s initial check + 4h interval

One uncommitted change remains: `telegram_bot.py` (20MB size check before `get_file()`, `TgBadRequest` import, deferred download).

GitHub publish config in `electron/package.json` targets `Supremeister/Transcription-AI` which matches the repo.

---

## Tasks

### Task 1: Commit telegram_bot.py improvements

**What:** Commit the pending changes to `telegram_bot.py`.

**How:**
```bash
cd C:\Users\MSI\Transcription
git add telegram_bot.py
git commit -m "fix: telegram bot — 20MB size check before get_file, handle TgBadRequest"
```

**Verify:**
```bash
git log --oneline -3
git diff HEAD~1 HEAD -- telegram_bot.py
```
Expected: commit appears in log; diff shows `TgBadRequest` import, `file_size > MAX_SIZE` check before `get_file()` call, and `except TgBadRequest` handler.

---

### Task 2: Verify CORS and env var injection (dev mode)

**What:** Confirm the CORS fix and env var flow work in dev mode before building the installer.

**How:**

1. Start backend:
```bash
cd C:\Users\MSI\Transcription\backend
node src/server.js
```

2. In a second terminal, hit the health endpoint simulating a `file://` origin:
```bash
curl -s -H "Origin: null" http://localhost:3000/health
```
Expected: `{"status":"ok",...}` — no CORS rejection.

3. Check env var injection by starting the Electron app in dev mode and reading the log:
```bash
cd C:\Users\MSI\Transcription\electron
npm start
```
Open `%APPDATA%\transcriptor\app.log` (or `C:\Users\MSI\AppData\Roaming\transcriptor\app.log`).
Expected lines: `ℹ️ HF_TOKEN загружен для диаризации` and backend started with `GROQ_API_KEY` passed (visible in log if key is set in `backend/.env`).

**Verify:**
- `curl` returns JSON without CORS error
- `app.log` contains HF_TOKEN log line when `HF_TOKEN` is set in `backend/.env`

---

### Task 3: Verify Groq key UI and Settings panel

**What:** Confirm the Settings panel saves and restores the Groq API key, shows a hint when key is missing, and links to console.groq.com/keys.

**How:**

1. Launch Electron app in dev mode (`npm start` in `electron/`).
2. Open Settings panel in the UI.
3. Verify the Groq API key input field is present (password type).
4. Enter a test key (e.g., `gsk_test123`), save, and reload the app.
5. Verify the key is restored from localStorage (field should be pre-filled after reload).
6. Clear the key and verify the hint "Groq API key не задан" (or equivalent) is visible.
7. Verify the link to `console.groq.com/keys` is present.

**Verify:** All five behaviors confirmed manually in the running app.

---

### Task 4: Verify auto-update config

**What:** Confirm the GitHub publish config in `electron/package.json` is correctly pointed at the repo and that `electron-updater` initializes without errors on app start.

**How:**

1. Check config values:
```bash
cd C:\Users\MSI\Transcription\electron
node -e "const p = require('./package.json'); console.log(JSON.stringify(p.build.publish, null, 2));"
```
Expected output:
```json
{
  "provider": "github",
  "owner": "Supremeister",
  "repo": "Transcription-AI",
  "releaseType": "release"
}
```

2. Confirm `electron-updater` is installed:
```bash
ls node_modules/electron-updater/package.json
```

3. After launching the app in dev mode (IS_PROD=false), confirm no updater errors appear — updater only runs in prod, so dev mode should be silent (no `[Updater]` error lines in `app.log`).

**Verify:** Config output matches expected JSON; no updater crash in `app.log`.

---

### Task 5: Build the NSIS installer

**What:** Run `electron-builder` to produce the installer `.exe` in `dist-exe/`.

**How:**

Prerequisites — confirm these exist before building:
```bash
ls C:\Users\MSI\Transcription\frontend\dist\index.html
ls C:\Users\MSI\Transcription\electron\resources\node.exe
ls C:\Users\MSI\Transcription\dist\whisper_service\whisper_service.exe
ls C:\Users\MSI\Transcription\electron\resources\icon.ico
```

If `frontend/dist/` is missing, build frontend first:
```bash
cd C:\Users\MSI\Transcription\frontend
npm run build
```

Then build the installer:
```bash
cd C:\Users\MSI\Transcription\electron
npm run build
```
(`npm run build` runs `electron-builder --win --x64`)

**Verify:**
```bash
ls C:\Users\MSI\Transcription\dist-exe\
```
Expected: file matching `Транскрибатор-Setup-*.exe` is present and non-zero size.

---

### Task 6: Test the installed app end-to-end

**What:** Install the built `.exe` and verify the app works correctly with all fixes active.

**How:**

1. Run the installer:
```
C:\Users\MSI\Transcription\dist-exe\Транскрибатор-Setup-*.exe
```
Complete installation, launch the app.

2. Open `%APPDATA%\transcriptor\app.log` and confirm:
   - `IS_PROD=true`
   - Backend started: `Запускаем backend: node ...`
   - Whisper started or warning if exe not present
   - No `❌` error lines for CORS or env vars

3. In the running app:
   - Open Settings → confirm Groq key field is present
   - Upload a short audio file (10–30 seconds) → confirm transcription result appears
   - If Groq key is set, confirm AI analysis appears after transcription

4. Check CORS works from installed app (frontend loads from `file://`):
   - Transcription request reaches backend (no network error in UI)

5. Verify auto-update check fires:
   - Wait 10 seconds after launch
   - Check `app.log` for `[Updater]` lines (either "нет обновлений" or version info — no crash)

**Verify:** App installs, launches, transcribes audio, shows UI without CORS errors. `app.log` shows IS_PROD=true and no critical failures.

---

## Success Criteria

- `telegram_bot.py` commit is in git log with 20MB check and TgBadRequest handler
- `curl -H "Origin: null" http://localhost:3000/health` returns JSON (no CORS rejection)
- `app.log` shows HF_TOKEN loaded when key is present in `backend/.env`
- Settings panel shows Groq key field, persists key across reload, shows hint when empty
- `electron/package.json` publish config points to `Supremeister/Transcription-AI`
- `dist-exe/Транскрибатор-Setup-*.exe` exists and is non-zero
- Installed app transcribes audio without CORS errors
- `app.log` in installed app shows `IS_PROD=true` and no critical `❌` lines
