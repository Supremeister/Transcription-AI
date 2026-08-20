@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ============================================
echo   Транскрибатор — Установка зависимостей
echo ============================================
echo.

:: ─── Ищем Python 3.12 ────────────────────────────────────────────────────────
set PYTHON=
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python310\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
) do (
    if exist %%p (
        set PYTHON=%%p
        goto :found_python
    )
)

python -c "import sys; exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 12) else 1)" >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    goto :found_python
)

:: ─── Python не найден — скачиваем и устанавливаем автоматически ──────────────
echo [!] Совместимый Python не найден. Устанавливаем Python 3.12 автоматически...
echo     (потребуется ~25 МБ и несколько минут)
echo.

set PY_URL=https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe
set PY_INSTALLER=%TEMP%\transcriptor_python312_installer.exe

echo Скачиваем Python...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_INSTALLER%' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось скачать Python. Проверьте подключение к интернету.
    pause
    exit /b 1
)

echo Устанавливаем Python 3.12 для текущего пользователя...
"%PY_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=0
if %errorlevel% neq 0 (
    echo [ОШИБКА] Установка Python завершилась с ошибкой.
    pause
    exit /b 1
)
del "%PY_INSTALLER%" >nul 2>&1

:: Ищем Python после установки
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Python312\python.exe"
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
%PYTHON% --version
echo.

:: ─── Базовые инструменты ─────────────────────────────────────────────────────
%PYTHON% -m pip install --upgrade pip setuptools wheel --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось обновить pip.
    pause
    exit /b 1
)

:: ─── Torch: существующую CUDA-сборку никогда не заменяем CPU-сборкой ─────────
echo Проверяем PyTorch...
%PYTHON% -c "import torch; print('[OK] PyTorch', torch.__version__, '| CUDA:', torch.cuda.is_available())" >nul 2>&1
if %errorlevel% == 0 (
    %PYTHON% -c "import torch; print('[OK] Сохраняем установленный PyTorch', torch.__version__, '| CUDA:', torch.cuda.is_available())"
) else (
    where nvidia-smi >nul 2>&1
    if !errorlevel! == 0 (
        echo Найдена NVIDIA GPU. Устанавливаем PyTorch 2.6 с CUDA 12.4...
        %PYTHON% -m pip install "torch==2.6.0" "torchaudio==2.6.0" --index-url https://download.pytorch.org/whl/cu124 --quiet
    ) else (
        echo NVIDIA GPU не найдена. Устанавливаем PyTorch 2.6 для CPU...
        %PYTHON% -m pip install "torch==2.6.0" "torchaudio==2.6.0" --index-url https://download.pytorch.org/whl/cpu --quiet
    )
    if !errorlevel! neq 0 (
        echo [ОШИБКА] Не удалось установить PyTorch.
        pause
        exit /b 1
    )
)

:: ─── GigaAM-v3 RNNT ─────────────────────────────────────────────────────────
echo.
echo Устанавливаем официальную GigaAM (ревизия 559d88d)...
set "GIGAAM_ZIP=https://github.com/salute-developers/GigaAM/archive/559d88d6b72541412743929f633a6ae7c9950b85.zip"
%PYTHON% -m pip install --upgrade "%GIGAAM_ZIP%" flask --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить GigaAM.
    pause
    exit /b 1
)

:: ─── RUPunct, Community-1 и безопасное декодирование через PyAV ──────────────
echo.
echo Устанавливаем RUPunct/Transformers и зависимости pyannote.audio Community-1...
%PYTHON% -m pip install ^
    "asteroid-filterbanks>=0.4.0" ^
    "einops>=0.8.1" ^
    "huggingface-hub>=0.28.1" ^
    "lightning>=2.4" ^
    "matplotlib>=3.10.0" ^
    "numba>=0.62" ^
    "opentelemetry-api>=1.34.0" ^
    "opentelemetry-exporter-otlp>=1.34.0" ^
    "opentelemetry-sdk>=1.34.0" ^
    "pyannote-core>=6.0.1" ^
    "pyannote-database>=6.1.1" ^
    "pyannote-metrics>=4.0.0" ^
    "pyannote-pipeline>=4.0.0" ^
    "pyannoteai-sdk>=0.3.0" ^
    "pytorch-metric-learning>=2.8.1" ^
    "rich>=13.9.4" ^
    "safetensors>=0.5.2" ^
    "torch-audiomentations>=0.12.0" ^
    "torchcodec>=0.7.0" ^
    "torchmetrics>=1.6.1" ^
    "transformers==4.57.6" ^
    --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости Community-1.
    pause
    exit /b 1
)

:: --no-deps намеренно: pyannote не должен заменить уже проверенную CUDA-сборку torch.
%PYTHON% -m pip install --no-deps "pyannote.audio==4.0.4" av --quiet
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить pyannote.audio 4.x / av.
    pause
    exit /b 1
)

%PYTHON% -c "import av, flask, gigaam, torch, transformers; import pyannote.audio; print('[OK] GigaAM + RUPunct + Community-1 готовы | CUDA:', torch.cuda.is_available())"
if %errorlevel% neq 0 (
    echo [ОШИБКА] Пакеты установлены, но проверка импорта не прошла.
    pause
    exit /b 1
)

:done
echo.
echo ============================================
echo   Всё установлено! Запустите Транскрибатор.
echo   Распознавание: GigaAM-v3 RNNT, только русский язык.
echo   Для Community-1 (разделение по спикерам):
echo   - Откройте Настройки в приложении
echo   - Введите HuggingFace токен
echo     (получить: huggingface.co/settings/tokens)
echo   При первом запуске загрузятся модели примерно на 500 МБ.
echo ============================================
echo.
pause
