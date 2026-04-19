#!/usr/bin/env python3
"""
Test transcription with actual speech audio
"""

import json
import requests
from pathlib import Path

test_audio = Path("test_audio/test_en.wav")

if not test_audio.exists():
    print(f"[ERROR] Test audio not found: {test_audio}")
    exit(1)

backend_url = "http://localhost:3000/api/transcribe"

print(f"Testing transcription with: {test_audio}")
print(f"File size: {test_audio.stat().st_size / 1024:.1f} KB\n")

with open(test_audio, "rb") as f:
    files = {"audio": f}
    data = {"language": "en"}

    try:
        response = requests.post(backend_url, files=files, data=data, timeout=120)
        print(f"Status: {response.status_code}\n")

        result = response.json()
        print("Response:")
        print(json.dumps(result, indent=2))

        if result.get("success"):
            transcript = result.get("transcript", "")
            print(f"\n[OK] Transcription successful!")
            print(f"\nTranscript:")
            print(f"  {transcript}")
        else:
            print(f"\n[ERROR] {result.get('error', 'Unknown error')}")

    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out (transcription may still be processing)")
    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to backend")
    except Exception as e:
        print(f"[ERROR] {e}")
