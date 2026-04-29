@echo off
chcp 65001 >nul
echo ============================================
echo   Сборка CPU-версии whisper_service
echo   (отдельный venv, твой GPU Python не трогаем)
echo ============================================
echo.

set VENV=venv_cpu_build
set OUT=dist_cpu

:: Проверяем Python в PATH
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Python не найден в PATH
    pause
    exit /b 1
)

:: Создаём изолированный venv под CPU-сборку
if not exist %VENV% (
    echo [1/4] Создаём виртуальную среду %VENV%...
    python -m venv %VENV%
) else (
    echo [1/4] Виртуальная среда %VENV% уже существует.
)
echo.

:: Устанавливаем CPU torch (маленький, без CUDA)
echo [2/4] Устанавливаем CPU torch (~200 МБ)...
%VENV%\Scripts\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить torch CPU
    pause
    exit /b 1
)
echo.

:: Устанавливаем остальные зависимости
echo [3/4] Устанавливаем faster-whisper, flask, pyinstaller...
%VENV%\Scripts\pip install faster-whisper flask flask-cors tqdm pyinstaller --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости
    pause
    exit /b 1
)
echo.

:: Собираем exe
echo [4/4] Собираем whisper_service.exe (CPU-only)...
echo       Это займёт 3-7 минут...
%VENV%\Scripts\pyinstaller whisper_service_cpu.spec --noconfirm --distpath %OUT%
if %errorlevel% neq 0 (
    echo [ОШИБКА] PyInstaller завершился с ошибкой
    pause
    exit /b 1
)

:: Проверяем результат
if exist "%OUT%\whisper_service\whisper_service.exe" (
    echo.
    echo ============================================
    echo   [OK] Готово!
    echo.
    echo   Результат: %OUT%\whisper_service\
    echo.
    echo   Следующий шаг для сборки установщика:
    echo   1. Скопируй %OUT%\whisper_service\ → dist\whisper_service\
    echo   2. cd electron ^&^& npm run build
    echo ============================================
) else (
    echo [ОШИБКА] Файл не найден — сборка не удалась
)
echo.
pause
