; Запускаем setup.bat после установки файлов
!macro customInstall
  SetOutPath "$INSTDIR\resources"
  ExecWait '"$SYSDIR\cmd.exe" /c ""$INSTDIR\resources\setup.bat""'
!macroend
