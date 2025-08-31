require('dotenv').config();
const axios = require('axios');

const MURF_API_KEY = process.env.MURF_API_KEY;

async function getVoices() {
  try {
    const response = await axios.get('https://api.murf.ai/v1/speech/voices', {
      headers: {
        'api-key': MURF_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data);
  } catch (err) {
    console.error('Failed to fetch Murf voices:', err.response?.data || err.message);
  }
}

getVoices();
