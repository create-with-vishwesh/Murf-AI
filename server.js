require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MURF_API_KEY = process.env.MURF_API_KEY;

app.post('/api/tts', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const response = await axios.post(
            'https://api.murf.ai/v1/speech/generate',
            {
                voiceId: 'en-US-Wavenet-D',
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
        const audioUrl = response.data.audioUrl;
        if (!audioUrl) throw new Error('No audioUrl in response');
        res.json({ audioUrl });
    } catch (err) {
        console.error('Murf API error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Murf TTS server running on port ${PORT}`);
});
