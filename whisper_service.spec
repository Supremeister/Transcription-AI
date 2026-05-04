# -*- mode: python ; coding: utf-8 -*-
#
# IMPORTANT: onedir mode (not onefile) — no temp extraction on each run.
# Produces a FOLDER backend/whisper_service_dist/whisper_service/
# Electron packages the whole folder into resources/whisper_service/

a = Analysis(
    ['backend\\whisper_service.py'],
    pathex=[],
    binaries=[
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\ctranslate2.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\cudnn64_9.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\ctranslate2\libiomp5md.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\nvidia\cuda_runtime\bin\cudart64_12.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\nvidia\cublas\bin\cublas64_12.dll', 'ctranslate2'),
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\nvidia\cublas\bin\cublasLt64_12.dll', 'ctranslate2'),
    ],
    datas=[
        (r'C:\Users\MSI\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\faster_whisper\assets', 'faster_whisper/assets'),
    ],
    hiddenimports=[
        'pyannote.audio',
        'pyannote.core',
        'pyannote.database',
        'pyannote.metrics',
        'pyannote.pipeline',
        'speechbrain',
        'asteroid_filterbanks',
        'einops',
        'huggingface_hub',
        'scipy',
        'scipy.spatial',
        'scipy.spatial.distance',
    ],
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
    [],
    name='whisper_service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='whisper_service',
)
