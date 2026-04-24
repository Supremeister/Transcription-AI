# Transcription AI — Setup Script
# Запускай из корня проекта: .\setup.ps1

Write-Host "=== Transcription AI Setup ===" -ForegroundColor Green

# 1. Python dependencies
Write-Host "`n[1/5] Устанавливаем Python зависимости..." -ForegroundColor Cyan
python -m pip install faster-whisper flask flask-cors

# 2. Backend npm
Write-Host "`n[2/5] Backend npm install..." -ForegroundColor Cyan
Set-Location backend
npm install
Set-Location ..

# 3. Frontend npm
Write-Host "`n[3/5] Frontend npm install..." -ForegroundColor Cyan
Set-Location frontend
npm install
npm run build
Set-Location ..

# 4. Electron npm
Write-Host "`n[4/5] Electron npm install..." -ForegroundColor Cyan
Set-Location electron
npm install
Set-Location ..

# 5. Копируем node.exe из системного Node.js
Write-Host "`n[5/5] Копируем node.exe..." -ForegroundColor Cyan
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Path
if ($nodePath) {
    Copy-Item $nodePath "electron\resources\node.exe" -Force
    Write-Host "node.exe скопирован из $nodePath" -ForegroundColor Green
} else {
    Write-Host "WARN: node.exe не найден. Установи Node.js и повтори." -ForegroundColor Yellow
}

# 6. Сборка whisper_service.exe
Write-Host "`nСобираем whisper_service.exe (может занять 3-5 минут)..." -ForegroundColor Cyan
python -m PyInstaller whisper_service.spec --noconfirm
if (Test-Path "dist\whisper_service.exe") {
    Write-Host "whisper_service.exe собран успешно" -ForegroundColor Green
} else {
    Write-Host "ERROR: сборка whisper_service.exe не удалась" -ForegroundColor Red
}

Write-Host "`n=== Setup завершён ===" -ForegroundColor Green
Write-Host "Запуск: cd electron && npm start" -ForegroundColor Yellow
Write-Host "Или собери EXE: cd electron && npm run build" -ForegroundColor Yellow
