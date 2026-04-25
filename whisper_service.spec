# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['backend\\whisper_service.py'],
    pathex=[],
    binaries=[
        # ctranslate2 DLL кладём в подпапку ctranslate2/ — именно туда
        # ctranslate2/__init__.py добавляет os.add_dll_directory и preload-ит DLL
        # ВАЖНО: cublas64_12.dll НЕ включаем — ctranslate2 работает без него
        # через собственные CUDA-ядра. Если включить cublas, он находится,
        # но не грузится (нет cudart64_12.dll) → ошибка на первом клике.
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\ctranslate2.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\cudnn64_9.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\libiomp5md.dll', 'ctranslate2'),
    ],
    datas=[
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\faster_whisper\assets', 'faster_whisper/assets'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='whisper_service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
