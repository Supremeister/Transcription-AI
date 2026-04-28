@echo off
chcp 65001 >nul
echo Удаляем временные папки PyInstaller из %TEMP%...
for /d %%i in ("%TEMP%\_MEI*") do (
    echo Удаляем: %%i
    rd /s /q "%%i"
)
echo Готово!
pause
