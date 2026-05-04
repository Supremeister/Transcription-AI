# -*- mode: python ; coding: utf-8 -*-
#
# CPU-ONLY сборка whisper_service.
# Запускай через build_cpu.bat — он создаёт отдельный venv с CPU-пакетами.
# Размер выходной папки: ~300-400 МБ (против 2.4 ГБ у GPU-сборки).
#
# Результат: dist_cpu/whisper_service/
# Для установщика: скопируй dist_cpu/whisper_service/ → dist/whisper_service/

import sys
import os
import importlib.util

# Надёжный поиск faster_whisper через importlib (работает в любом venv и CI)
_fw_spec = importlib.util.find_spec('faster_whisper')
faster_whisper_assets = os.path.join(os.path.dirname(_fw_spec.origin), 'assets')

a = Analysis(
    ['backend\\whisper_service.py'],
    pathex=[],
    binaries=[],  # Нет CUDA DLL — CPU-only
    datas=[
        (faster_whisper_assets, 'faster_whisper/assets'),
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
        'torch',
        'torchaudio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Тяжёлые пакеты, не нужные для транскрибации
        'pandas', 'pyarrow',
        'matplotlib', 'matplotlib.pyplot',
        'PIL', 'Pillow',
        'torchvision',
        'sklearn', 'scikit_learn',
        'llvmlite', 'numba',
        'grpc', 'grpcio',
        'IPython', 'jupyter', 'notebook',
        'scipy.spatial', 'scipy.optimize',
        'hf_xet',
    ],
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
