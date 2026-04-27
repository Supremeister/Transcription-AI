@echo off
chcp 65001 >nul
echo ============================================
echo   Транскрибатор — Установка зависимостей
echo ============================================
echo.

:: Ищем Python
set PYTHON=
for %%p in (
    "%LOCALAPPDATA%\Python\bin\python.exe"
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

:: Пробуем через PATH
python --version >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    goto :found_python
)

echo [ОШИБКА] Python не найден!
echo.
echo Установите Python 3.10 или выше:
echo   https://www.python.org/downloads/
echo.
echo При установке обязательно отметьте "Add Python to PATH"
echo.
pause
exit /b 1

:found_python
echo [OK] Python найден: %PYTHON%
echo.

:: Проверяем версию
%PYTHON% -c "import sys; v=sys.version_info; exit(0 if v.major==3 and v.minor>=10 else 1)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Требуется Python 3.10+
    echo Обновите Python: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Проверяем — уже установлено?
echo Проверяем pyannote.audio...
%PYTHON% -c "import pyannote.audio" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] pyannote.audio уже установлен!
    goto :done
)

:: Устанавливаем CPU-версию torch + pyannote (меньше размер, достаточно для диаризации)
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

:: Финальная проверка
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
