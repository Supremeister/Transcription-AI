# -*- mode: python ; coding: utf-8 -*-
"""Single-folder GPU build for GigaAM, RUPunct, and Community-1."""

from PyInstaller.utils.hooks import (
    collect_all,
    collect_data_files,
    collect_submodules,
    copy_metadata,
)


datas = []
binaries = []
hiddenimports = []

for package in ("gigaam", "pyannote.audio", "tokenizers"):
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden

for package in (
    "pyannote.core",
    "pyannote.database",
    "pyannote.metrics",
    "pyannote.pipeline",
    "speechbrain",
    "asteroid_filterbanks",
    "hydra",
    "omegaconf",
):
    datas += collect_data_files(package)
    hiddenimports += collect_submodules(package)

datas += collect_data_files("transformers")
datas += copy_metadata("torchcodec")
hiddenimports += collect_submodules("transformers.models.electra")

hiddenimports += [
    "av",
    "einops",
    "huggingface_hub",
    "onnxruntime",
    "safetensors",
    "sentencepiece",
    "sklearn.cluster",
    "sklearn.metrics",
    "sklearn.preprocessing",
    "soundfile",
    "torchaudio",
    "transformers.models.electra.configuration_electra",
    "transformers.models.electra.modeling_electra",
    "transformers.models.electra.tokenization_electra_fast",
]

a = Analysis(
    ["backend\\gigaam_service.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "IPython",
        "jupyter",
        "notebook",
        "pytest",
        "tensorboard",
        "torchvision",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    name="gigaam_service",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
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
    upx=False,
    name="gigaam_service",
)
