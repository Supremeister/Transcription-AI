# Transcription AI Service

**Status:** Phase 0 (Questioning) → Phase 1 (Research) → Planning

## Vision
Build an AI-powered transcription service that converts voice messages into structured text with automatic analysis (goals, tasks, summary).

**Inspiration:** https://www.dowayai.com

## Problem Statement
Users struggle with:
- Manual transcription of voice recordings
- Extracting key insights from long voice messages
- Analyzing and summarizing voice content efficiently

## Solution
A web/API service that:
1. Accepts voice files (MP3, WAV, M4A, etc.)
2. Transcribes speech to text (ASR)
3. Analyzes content (extracts goals, tasks, summarizes)
4. Returns structured output (transcript + analysis)

## Constraints
- **Timeline:** 1-2 weeks
- **Scope:** MVP with transcription + basic analysis
- **Goal:** Solve user pain point

## Key Questions for Research
1. Which ASR provider? (Whisper, Google Speech, Deepgram, Azure)
2. Which LLM for analysis? (OpenAI, Anthropic Claude, local model)
3. Architecture: API-first? Web app? Both?
4. Frontend tech stack?
5. Deployment strategy?

---

**Created:** 2026-04-19
**Phase:** Research
**Owner:** User
