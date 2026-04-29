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
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python310\python.exe"
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
    pause
    exit /b 1
)

echo Устанавливаем Python для всех пользователей...
"%PY_INSTALLER%" /quiet InstallAllUsers=1 PrependPath=1 Include_launcher=0
if %errorlevel% neq 0 (
    echo [ОШИБКА] Установка Python завершилась с ошибкой.
    pause
    exit /b 1
)
del "%PY_INSTALLER%" >nul 2>&1

:: Обновляем PATH в текущей сессии
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\")"') do set "PATH=%%i;%PATH%"

:: Ищем Python после установки
for %%p in (
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python312\python.exe"
) do (
    if exist %%p (
        set PYTHON=%%p
        echo [OK] Python установлен: %%p
        echo.
        goto :found_python
    )
)

python --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    echo [OK] Python установлен успешно!
    echo.
    goto :found_python
)

echo [ОШИБКА] Python установлен, но не найден. Перезапустите этот скрипт.
pause
exit /b 1

:found_python
echo [OK] Python: %PYTHON%
echo.

:: ─── CUDA / GPU ──────────────────────────────────────────────────────────────
echo.
echo У вас есть видеокарта NVIDIA (GeForce, RTX, GTX)?
echo GPU-ускорение в 3-10 раз быстрее CPU, но потребует ~1.5 ГБ загрузки.
echo.
set /p CUDA_CHOICE="Установить GPU-ускорение (CUDA)? [Y/N]: "
if /i "!CUDA_CHOICE!"=="Y" (
    echo.
    %PYTHON% -c "import torch; exit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
    if !errorlevel! == 0 (
        echo [OK] CUDA уже активна — GPU-ускорение работает.
        echo.
    ) else (
        echo Устанавливаем torch с CUDA 12.1...
        echo (Это займёт 5-15 минут^)
        echo.
        %PYTHON% -m pip install --upgrade pip --quiet
        %PYTHON% -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet
        if !errorlevel! == 0 (
            echo [OK] CUDA torch установлен! GPU-ускорение активно.
        ) else (
            echo [WARN] Не удалось установить CUDA torch. Whisper продолжит работать на CPU.
        )
        echo.
    )
) else (
    echo [INFO] Whisper будет работать на CPU.
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
echo   Всё установлено! Запустите Транскрибатор.
echo   Для диаризации (разделение по спикерам):
echo   - Откройте Настройки в приложении
echo   - Введите HuggingFace токен
echo     (получить: huggingface.co/settings/tokens)
echo ============================================
echo.
pause
