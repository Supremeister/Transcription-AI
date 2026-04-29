@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ============================================
echo   Транскрибатор — Установка зависимостей
echo ============================================
echo.

:: ─── Ищем Python ─────────────────────────────────────────────────────────────
set PYTHON=
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
) do (
    if exist %%p (
        set PYTHON=%%p
        goto :found_python
    )
)

python --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    goto :found_python
)

:: ─── Python не найден — скачиваем и устанавливаем автоматически ──────────────
echo [!] Python не найден. Устанавливаем Python 3.11 автоматически...
echo     (потребуется ~25 МБ и несколько минут)
echo.

set PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
set PY_INSTALLER=%TEMP%\python_installer.exe

echo Скачиваем Python...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_INSTALLER%' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось скачать Python. Проверьте подключение к интернету.
    echo Или установите вручную: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Устанавливаем Python (тихая установка)...
"%PY_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=0
if %errorlevel% neq 0 (
    echo [ОШИБКА] Установка Python завершилась с ошибкой.
    echo Попробуйте установить вручную: https://www.python.org/downloads/
    pause
    exit /b 1
)
del "%PY_INSTALLER%" >nul 2>&1

:: Обновляем PATH в текущей сессии
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\"PATH\",\"User\")"') do set "PATH=%%i;%PATH%"

:: Проверяем после установки
python --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    echo [OK] Python установлен успешно!
    echo.
    goto :found_python
)

:: Если всё равно не нашли — ищем по стандартным путям
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) do (
    if exist %%p (
        set PYTHON=%%p
        echo [OK] Python установлен: %%p
        echo.
        goto :found_python
    )
)

echo [ОШИБКА] Python установлен, но не найден. Перезапустите этот скрипт.
pause
exit /b 1

:found_python
echo [OK] Python: %PYTHON%
echo.

:: ─── CUDA / GPU ──────────────────────────────────────────────────────────────
echo Проверяем видеокарту NVIDIA...
nvidia-smi >nul 2>&1
if %errorlevel% == 0 (
    echo [GPU] Обнаружена NVIDIA видеокарта!
    echo.

    %PYTHON% -c "import torch; exit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
    if %errorlevel% == 0 (
        echo [OK] CUDA уже активна — GPU-ускорение работает.
        echo.
        goto :pyannote_section
    )

    echo Хотите включить GPU-ускорение для транскрибации?
    echo Это ускорит обработку в 3-10 раз, но потребует скачать ~1.5 ГБ.
    echo.
    set /p CUDA_CHOICE="Установить CUDA-ускорение? [Y/N]: "
    if /i "!CUDA_CHOICE!"=="Y" (
        echo.
        echo Устанавливаем torch с CUDA 12.1...
        echo (Это займёт 5-15 минут)
        echo.
        %PYTHON% -m pip install --upgrade pip --quiet
        %PYTHON% -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet
        if %errorlevel% == 0 (
            echo [OK] CUDA torch установлен! GPU-ускорение активно.
        ) else (
            echo [WARN] Не удалось установить CUDA torch. Whisper продолжит работать на CPU.
        )
        echo.
    ) else (
        echo Пропускаем. Whisper будет работать на CPU.
        echo.
    )
) else (
    echo [INFO] NVIDIA GPU не обнаружена — Whisper работает на CPU.
    echo.
)

:: ─── pyannote.audio ──────────────────────────────────────────────────────────
:pyannote_section
echo Проверяем pyannote.audio...
%PYTHON% -c "import pyannote.audio" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] pyannote.audio уже установлен!
    goto :done
)

echo.
echo Устанавливаем pyannote.audio (CPU-версия, ~400 МБ)...
echo Это займет 5-10 минут в зависимости от скорости интернета.
echo.

%PYTHON% -m pip install --upgrade pip --quiet

%PYTHON% -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить torch
    pause
    exit /b 1
)

%PYTHON% -m pip install pyannote.audio --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить pyannote.audio
    pause
    exit /b 1
)

%PYTHON% -c "import pyannote.audio; print('[OK] pyannote.audio установлен успешно!')"
if %errorlevel% neq 0 (
    echo [ОШИБКА] Установка прошла, но импорт не работает. Попробуйте перезапустить.
    pause
    exit /b 1
)

:done
echo.
echo ============================================
echo   Готово! Теперь:
echo   1. Откройте Транскрибатор
echo   2. Нажмите "Настройки"
echo   3. Введите HuggingFace токен
echo      (получить: huggingface.co/settings/tokens)
echo   4. Примите лицензию модели:
echo      huggingface.co/pyannote/speaker-diarization-3.1
echo ============================================
echo.
pause
