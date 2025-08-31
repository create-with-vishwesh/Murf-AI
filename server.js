require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MURF_API_KEY = process.env.MURF_API_KEY;

if (!MURF_API_KEY) {
    console.error('MURF_API_KEY not set in environment');
}

// simple in-memory history for last requests (visible via /api/tts/history)
app.locals.ttsHistory = [];

// helper: recursively search for a URL that ends with audio extension
function findAudioUrl(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') {
    // accept URLs that end with audio extensions possibly followed by query string
    if (/^https?:\/\/.+\.(mp3|m4a|wav)(?:\?.*)?$/i.test(obj)) return obj;
        if (/^data:audio\//i.test(obj)) return obj;
    }
    if (Buffer.isBuffer(obj)) return null;
    if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            const found = findAudioUrl(v);
            if (found) return found;
            if (typeof v === 'string' && /^(?:[A-Za-z0-9+\/=\n\r]+)$/i.test(v) && v.length > 1000) {
                return 'data:audio/mp3;base64,' + v.replace(/\s+/g, '');
            }
        }
    }
    return null;
}

app.post('/api/tts', async (req, res) => {
    const { text, voiceId } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    if (!voiceId) return res.status(400).json({ error: 'voiceId is required' });

    console.log('TTS request:', { length: text.length, voiceId, preview: text.slice(0,80) });

    try {
        const response = await axios.post(
            'https://api.murf.ai/v1/speech/generate',
            {
                voiceId,
                text,
                format: 'mp3'
            },
            {
                headers: {
                    'api-key': MURF_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Debug log full response body for diagnosis
        console.log('Murf response status:', response.status);
        console.log('Murf response data:', JSON.stringify(response.data).slice(0, 2000));

    const body = response.data || {};
    // store last Murf response for debugging
    app.locals.lastMurfRaw = body;

    // (findAudioUrl is now module-level)

    // Try common response fields (include Murf's audioFile)
    let audioUrl = null;
    if (body.audioFile) audioUrl = body.audioFile;
    if (!audioUrl && body.audioUrl) audioUrl = body.audioUrl;
    if (!audioUrl && body.audio_url) audioUrl = body.audio_url;
    if (!audioUrl && body.data && typeof body.data === 'string' && body.data.startsWith('http')) audioUrl = body.data;
    if (!audioUrl) audioUrl = findAudioUrl(body);

        if (audioUrl) {
            // If we found a data: URL or normal URL, return it (and provide a proxied endpoint)
            const proxyUrl = `/api/tts/proxy?url=${encodeURIComponent(audioUrl)}`;
            console.log('Returning audioUrl:', audioUrl, 'proxy:', proxyUrl);
            // add to short in-memory history
            app.locals.ttsHistory.unshift({ time: Date.now(), text: text.slice(0, 120), voiceId, audioUrl });
            if (app.locals.ttsHistory.length > 50) app.locals.ttsHistory.pop();
            return res.json({ audioUrl, proxyUrl });
        }

        // If Murf returned an operation id (async processing), poll the operation until final audio is available
        const opId = body.id || body.operationId || body.jobId;
        if (opId) {
            console.log('Murf returned operation id:', opId, '; polling for result...');
            const opUrlBaseCandidates = [
                `https://api.murf.ai/v1/speech/operations/${opId}`,
                `https://api.murf.ai/v1/operations/${opId}`
            ];

            const maxAttempts = 20;
            const delayMs = 1000;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    for (const opUrl of opUrlBaseCandidates) {
                        try {
                            const opRes = await axios.get(opUrl, { headers: { 'api-key': MURF_API_KEY } });
                            const opBody = opRes.data || {};
                            console.log(`Polled ${opUrl} status:`, opBody.status || opBody.state || 'unknown');
                            // Try to find audio in operation response
                            const found = findAudioUrl(opBody);
                            if (found) {
                                const proxyUrl = `/api/tts/proxy?url=${encodeURIComponent(found)}`;
                                app.locals.ttsHistory.unshift({ time: Date.now(), text: text.slice(0, 120), voiceId, audioUrl: found });
                                if (app.locals.ttsHistory.length > 50) app.locals.ttsHistory.pop();
                                return res.json({ audioUrl: found, proxyUrl });
                            }
                            // if operation indicates completion with outputs
                            if (opBody.status === 'SUCCEEDED' || opBody.status === 'succeeded' || opBody.state === 'finished') {
                                // try common fields
                                if (opBody.output && opBody.output.audioUrl) {
                                    const proxyUrl = `/api/tts/proxy?url=${encodeURIComponent(opBody.output.audioUrl)}`;
                                    app.locals.ttsHistory.unshift({ time: Date.now(), text: text.slice(0, 120), voiceId, audioUrl: opBody.output.audioUrl });
                                    if (app.locals.ttsHistory.length > 50) app.locals.ttsHistory.pop();
                                    return res.json({ audioUrl: opBody.output.audioUrl, proxyUrl });
                                }
                                if (opBody.output && opBody.output[0] && opBody.output[0].audioUrl) {
                                    const u = opBody.output[0].audioUrl;
                                    const proxyUrl = `/api/tts/proxy?url=${encodeURIComponent(u)}`;
                                    app.locals.ttsHistory.unshift({ time: Date.now(), text: text.slice(0, 120), voiceId, audioUrl: u });
                                    if (app.locals.ttsHistory.length > 50) app.locals.ttsHistory.pop();
                                    return res.json({ audioUrl: u, proxyUrl });
                                }
                            }
                        } catch (e) {
                            // ignore a single candidate failing and try next
                            console.debug('polling candidate failed', e.message);
                        }
                    }
                } catch (pollErr) {
                    console.error('Polling error:', pollErr.response?.data || pollErr.message);
                }
                // wait then retry
                await new Promise(r => setTimeout(r, delayMs));
            }

            console.warn('Polling timed out; returning jobId for client-side handling');
            return res.status(202).json({ jobId: opId, raw: body });
        }

        // No usable audio found — return full body for debugging
        console.error('No audioUrl in response; returning full Murf body for debugging');
        return res.status(500).json({ error: 'No audioUrl in response', raw: body });
    } catch (err) {
        console.error('Murf API error:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to generate speech', details: err.response?.data || err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Murf TTS server running on port ${PORT}`);
});

// Poll status endpoint for frontend to poll if server returned a jobId
app.get('/api/tts/status/:id', async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const opUrlCandidates = [
        `https://api.murf.ai/v1/speech/operations/${id}`,
        `https://api.murf.ai/v1/operations/${id}`
    ];
    try {
        for (const url of opUrlCandidates) {
            try {
                const opRes = await axios.get(url, { headers: { 'api-key': MURF_API_KEY } });
                const body = opRes.data || {};
                const found = findAudioUrl(body);
                if (found) return res.json({ audioUrl: found });
                if (body.output && body.output.audioUrl) return res.json({ audioUrl: body.output.audioUrl });
                if (body.output && body.output[0] && body.output[0].audioUrl) return res.json({ audioUrl: body.output[0].audioUrl });
                // return operation status
                return res.status(202).json({ status: body.status || body.state || 'processing', raw: body });
            } catch (e) {
                // try next
            }
        }
        return res.status(404).json({ error: 'operation not found' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Debug endpoint: return the last Murf raw response stored in memory
app.get('/api/tts/last', (req, res) => {
    if (!app.locals.lastMurfRaw) return res.status(404).json({ error: 'no last response stored' });
    return res.json({ raw: app.locals.lastMurfRaw });
});

// return recent TTS requests (in-memory)
app.get('/api/tts/history', (req, res) => {
    return res.json({ history: app.locals.ttsHistory || [] });
});

// Proxy audio URL to avoid CORS or mixed-content problems. This streams the remote audio through the server.
app.get('/api/tts/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('url query param required');
    try {
        const upstream = await axios.get(url, { responseType: 'stream' });
        // copy relevant headers
        res.setHeader('Content-Type', upstream.headers['content-type'] || 'audio/mpeg');
        if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
        upstream.data.pipe(res);
    } catch (err) {
        console.error('Proxy error fetching', url, err.message || err);
        return res.status(502).json({ error: 'Failed to fetch remote audio', details: err.message || err });
    }
});
