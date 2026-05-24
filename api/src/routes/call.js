const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const OpenAI   = require('openai');
const twilio   = require('twilio');
const auth     = require('../middleware/auth');
const db       = require('../services/supabase');

const router   = express.Router();
const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const AUDIO_DIR = path.join('/tmp', 'ivox-audio');

// POST /api/call/preview
// Body: raw audio blob
// Query: ?lang=pt (hint de idioma, opcional)
// Returns: { msgId, transcription, translation }
router.post('/preview', auth, async (req, res) => {
  const audioBuffer = req.body;
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    return res.status(400).json({ error: 'No audio received' });
  }

  try {
    const mimetype = (req.get('content-type') || 'audio/webm').split(';')[0].trim();
    const ext      = mimetype.split('/')[1] || 'webm';
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    const tmpFile = path.join(AUDIO_DIR, `in-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpFile, audioBuffer);

    let transcription;
    try {
      const result = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file:  fs.createReadStream(tmpFile),
      });
      transcription = result.text;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    if (!transcription?.trim()) {
      return res.status(422).json({ error: 'Could not transcribe — was the recording too short?' });
    }

    const translated = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        { role: 'system', content: 'Translate the following to clear, natural American English suitable for a phone call. Under 300 characters. Output ONLY the translated text.' },
        { role: 'user', content: transcription },
      ],
    });
    const translation = translated.choices[0].message.content.trim().slice(0, 300);

    // TTS via ElevenLabs (Hope voice)
    const msgId  = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const mp3Buf = await generateTTS(translation);
    fs.writeFileSync(path.join(AUDIO_DIR, `${msgId}.mp3`), mp3Buf);

    res.json({ msgId, transcription, translation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/call/send
// Body: { msgId, phone, saveContact?, contactName? }
router.post('/send', auth, express.json(), async (req, res) => {
  const { msgId, phone, saveContact, contactName } = req.body || {};
  if (!msgId || !phone) return res.status(400).json({ error: 'msgId and phone are required' });

  const safe    = msgId.replace(/[^a-z0-9\-]/gi, '');
  const mp3Path = path.join(AUDIO_DIR, `${safe}.mp3`);
  if (!fs.existsSync(mp3Path)) {
    return res.status(404).json({ error: 'Audio not found — generate a new preview.' });
  }

  try {
    // Desconta 1 crédito antes de ligar
    await db.deductCredit(req.userId);

    const BASE = process.env.BASE_URL || 'https://api.ivox.app';
    const toPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const call = await twilioClient.calls.create({
      to:    toPhone,
      from:  process.env.TWILIO_FROM_NUMBER,
      twiml: `<Response><Play>${BASE}/audio/${safe}</Play><Pause length="1"/></Response>`,
    });

    // salva log
    await db.logCall(req.userId, {
      phone: toPhone, transcription: '', translation: '', callSid: call.sid, credits_used: 1,
    });

    // salva contato se pedido
    if (saveContact && contactName) {
      await db.upsertContact(req.userId, { name: contactName, phone: toPhone });
    }

    res.json({ ok: true, callSid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function generateTTS(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'LcfcDJNUP1GQjkzn1xUU'; // Hope
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs error ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

module.exports = router;
