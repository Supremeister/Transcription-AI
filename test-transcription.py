#!/usr/bin/env python3
"""
Test script for transcription service
Generates a test audio file and transcribes it using the backend
"""

import json
import requests
import subprocess
import os
from pathlib import Path

# Create test audio directory
test_dir = Path("test_audio")
test_dir.mkdir(exist_ok=True)

# Generate a test audio file using ffmpeg with text-to-speech
test_file = test_dir / "test_en.wav"

print("Generating test audio file...")
# Create a simple audio file with speech
cmd = [
    "ffmpeg", "-f", "lavfi", "-i",
    "sine=f=1000:d=2",  # 1kHz sine wave for 2 seconds
    "-ac", "1",
    "-ar", "16000",
    str(test_file),
    "-y"  # Overwrite
]

try:
    subprocess.run(cmd, capture_output=True, check=True)
    print(f"[OK] Test audio created: {test_file}")
except subprocess.CalledProcessError as e:
    print(f"Error generating audio: {e}")
    exit(1)

# Test the transcription endpoint
print("\nTesting transcription endpoint...")

backend_url = "http://localhost:3000/api/transcribe"

with open(test_file, "rb") as f:
    files = {"audio": f}
    data = {"language": "en"}

    try:
        response = requests.post(backend_url, files=files, data=data, timeout=60)
        print(f"Status: {response.status_code}")

        result = response.json()
        print("\nResponse:")
        print(json.dumps(result, indent=2))

        if result.get("success"):
            print(f"\n[OK] Transcription successful!")
            print(f"Transcript: {result.get('transcript', 'N/A')[:100]}...")
        else:
            print(f"\n[ERROR] Transcription failed: {result.get('error', 'Unknown error')}")

    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to backend at http://localhost:3000")
    except Exception as e:
        print(f"[ERROR] {e}")

print("\n[OK] Test complete!")
