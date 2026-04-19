#!/usr/bin/env python3
"""
Generate test audio with actual speech using pyttsx3
"""

import pyttsx3
from pathlib import Path

# Create test audio directory
test_dir = Path("test_audio")
test_dir.mkdir(exist_ok=True)

# Test sentences
test_sentences = {
    "test_en.wav": "Hello, this is a test of the transcription service. The quick brown fox jumps over the lazy dog.",
    "test_ru.wav": "Привет, это тест сервиса транскрипции. Быстрая коричневая лиса прыгает через ленивую собаку."
}

# Initialize text-to-speech engine
engine = pyttsx3.init()
engine.setProperty('rate', 150)  # Slower speech for better recognition

for filename, text in test_sentences.items():
    output_file = test_dir / filename
    print(f"Generating: {filename}")

    engine.save_to_file(text, str(output_file))
    engine.runAndWait()

    if output_file.exists():
        print(f"  [OK] Created: {output_file} ({output_file.stat().st_size} bytes)")
    else:
        print(f"  [ERROR] Failed to create {filename}")

print("\nDone!")
