(async ()=>{
  try {
    const body = { text: 'Hello from ReciVo test', voiceId: 'en-US-claire' };
    const r = await fetch('http://127.0.0.1:5000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('STATUS', r.status);
    const text = await r.text();
    console.log('BODY', text);
  } catch (e) {
    console.error('ERROR', e.message);
  }
})();
