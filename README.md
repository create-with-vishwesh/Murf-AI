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
MURF_API_KEY=ap2_xxx-your-key-xxx
```

The server reads `MURF_API_KEY` and sends it as the `api-key` header to Murf.

## Important endpoints (backend)

- POST /api/tts
  - Body: { text: string, voiceId: string }
  - Returns: 200 with { audioUrl, proxyUrl } on success, 202 with { jobId } if async, or 500 with raw Murf response on error.
- GET /api/tts/status/:id
  - Polls Murf operation and returns { audioUrl, proxyUrl } or 202 with status.
- GET /api/tts/proxy?url=<encoded-url>
  - Streams the remote MP3 through the server (use this URL in the browser to avoid CORS issues).
- GET /api/tts/last
  - Returns last raw Murf response stored in memory (for debugging).
- GET /api/tts/history
  - Returns a short in-memory history of recent TTS requests.

## Frontend notes

- The UI is a single static HTML file at `src/index-main.html`.
- `speakWithMurf(text)` posts to `/api/tts` and prefers the returned `proxyUrl` when present.
- If Murf fails, the UI falls back to `speechSynthesis`.

## Troubleshooting

- "Missing 'api-key' or 'token' header": Ensure `.env` has `MURF_API_KEY` and server restarted.
- No playable audio in browser:
  - Inspect the `/api/tts` response: ensure `proxyUrl` is present and try opening it directly.
  - Check server logs; the server prints the Murf response and the audio URL it detected.
  - If proxy returns 502, server couldn't fetch the signed URL (network issue or URL expired).
- Autoplay blocked: click the page or trigger via a user gesture before audio.play().

## Next steps / ideas

- Persist generated audio files server-side to avoid re-fetching signed S3 URLs.
- Add a simple `package.json` and `npm run start` script.
- Improve UI progress/status indicators for async Murf jobs.

## License

MIT
