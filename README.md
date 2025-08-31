# ReciVo — Murf TTS Integration

Lightweight demo app showing Murf.ai text-to-speech integration for the ReciVo voice recipe assistant.

This repository contains a small Express backend that proxies Murf TTS requests and a plain HTML/JS frontend (`src/index-main.html`) that calls the backend to play generated speech.

## Features

- Local Express proxy for Murf TTS (`/api/tts`) which:
  - Sends text + chosen `voiceId` to Murf using the `api-key` header.
  - Detects Murf's response shapes (including `audioFile`) and returns a playable URL.
  - Polls Murf operations for async jobs.
  - Streams signed audio through a server-side proxy to avoid CORS/mixed-content issues (`/api/tts/proxy`).
- Frontend voice selector (6 sample voices) and fallback to browser SpeechSynthesis.
- Small in-memory history and debug endpoints: `/api/tts/last` and `/api/tts/history`.

## Quick start (PowerShell)

1. Ensure Node.js is installed (recommended Node 18+).
2. In project root, install dependencies and start the server:

```powershell
cd 'D:\Hackathons\Murf AI'
npm install express axios dotenv cors
# then run
node server.js
```

Note: If you prefer a package.json, you can run `npm init -y` then `npm install`.

3. Open the frontend in a browser. For reliable behavior (CORS/ESM/Autoplay) use a local static server (VS Code Live Server or Python's http.server):

```powershell
# from project root (serves current dir on port 8000)
python -m http.server 8000
# then open http://localhost:8000/src/index-main.html
```

## Required environment variables

Create a `.env` file in the repo root with the following value:

```
# ReciVo — Objective Project Overview

ReciVo is a focused demo application that demonstrates a practical integration pattern for text-to-speech (TTS) using Murf.ai. It turns written recipes into narrated, hands-free cooking instructions by combining a minimal static frontend with a small Node/Express backend that proxies Murf requests, handles response variations, and streams generated audio to the browser.

## Key goals

- Provide a reliable, secure TTS integration with Murf.ai for prototype/demo scenarios.
- Demonstrate how to handle real-world API shapes (sync/async responses, signed audio URLs).
- Avoid common browser issues (CORS and mixed-content) by proxying audio through the server when needed.
- Offer a simple, extendable codebase useful for hackathons and early-stage experiments.

## Architecture (high level)

- Frontend: `src/index-main.html` — static HTML/CSS/JS. Responsibilities:
  - Recipe selection and step navigation UI.
  - Voice selector with sample Murf voices.
  - `speakWithMurf(text)` function that POSTs { text, voiceId } to the backend, plays returned audio (preferring a proxied URL), polls for async jobs, and falls back to browser SpeechSynthesis on error.

- Backend: `server.js` — Node.js + Express. Responsibilities:
  - Authenticate to Murf using `api-key` header (value read from `MURF_API_KEY` in `.env`).
  - Post generation requests to Murf and robustly parse responses (supports `audioFile`, `audioUrl`, base64 blobs, and operation polling).
  - Provide a streaming proxy endpoint `/api/tts/proxy` that fetches remote audio and pipes it to the browser to avoid CORS and mixed-content issues.
  - Expose debug endpoints `/api/tts/last` and `/api/tts/history` for quick inspection.

## What the platform handles

- Synchronous Murf responses that immediately include an audio URL or base64 audio.
- Asynchronous/long-running Murf operations identified by job/operation IDs (the server polls Murf operation endpoints until audio is available or times out).
- Signed storage URLs (for example S3 URLs returned in `audioFile`) by streaming them through the server so browsers can load audio without direct cross-origin restrictions.
- Graceful fallback to browser-native TTS (`speechSynthesis`) when Murf is unreachable or returns an unusable response.

## Setup (Windows / PowerShell)

1. Install Node.js (recommended v18+).
2. In the repository root, install dependencies and start the server:

```powershell
cd 'D:\Hackathons\Murf AI'
# Optional: create a package.json
npm init -y
# Install runtime deps
npm install express axios dotenv cors
# Start the server
node server.js
```

3. Serve the frontend with a local static server and open it in your browser (recommended to avoid file:// origin issues):

```powershell
python -m http.server 8000
# Open http://localhost:8000/src/index-main.html
```

## Required configuration

Create a `.env` file at the project root with:

```
MURF_API_KEY=ap2_<your-murf-key>
```

The server reads this value and sends it in the `api-key` header for Murf requests.

## Important backend endpoints

- POST /api/tts
  - Body: { text: string, voiceId: string }
  - Success: 200 { audioUrl: string, proxyUrl?: string }
  - Async: 202 { jobId }
  - Error: 500 { error, raw }

- GET /api/tts/status/:id
  - Polls Murf operation endpoints. Returns 200 with { audioUrl, proxyUrl } when ready or 202 with { status, raw } if still processing.

- GET /api/tts/proxy?url=<encoded-url>
  - Streams the provided audio URL through the server. Use this when the returned `audioUrl` is a signed remote URL that the browser cannot fetch directly.

- GET /api/tts/last
  - Returns the last raw Murf response the server processed (helpful for debugging unexpected response shapes).

- GET /api/tts/history
  - Returns a short in-memory list of recent TTS requests and the audio URLs the server found.

## Frontend behavior and integration notes

- The frontend populates a voice dropdown with several sample voices; choose one to pass `voiceId` to the backend.
- `speakWithMurf(text)` prefers `proxyUrl` when available. This avoids CORS and mixed-content failures (e.g., when the app is served over HTTPS and Murf returns an HTTP URL).
- If a 202 status is returned, the frontend polls `/api/tts/status/:id` until an `audioUrl` appears or polling times out.
- If Murf fails or returns no usable audio, the frontend falls back to the browser `speechSynthesis` API.

## Security and privacy

- The Murf API key is read from `.env` and never exposed to the frontend. Do not commit `.env` to source control (add it to `.gitignore`).
- The server proxies remote audio but does not persist API keys or user data by default. If you add persistence, follow best practices for secrets and user data handling.

## Troubleshooting

- "Missing 'api-key' or 'token' header": confirm `MURF_API_KEY` is set in `.env` and the server is restarted.
- No audio plays in browser:
  - Inspect `/api/tts` response JSON for `proxyUrl` and try opening it directly.
  - Check server logs — the server prints the Murf response and the audio URL it found.
  - If proxy returns 502, the server failed to fetch the signed URL (network error, timeout, or expired URL).
- Autoplay blocked: ensure playback happens after a user gesture.

## Limitations & recommended improvements

- In-memory history is ephemeral. For production, persist generated audio and request logs.
- The server currently streams remote audio; for high load or long-term storage consider downloading and serving cached files.
- Add robust error codes and UI progress indicators for better UX with long-running operations.

## License

MIT
