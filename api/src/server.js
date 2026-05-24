require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const callRoutes    = require('./routes/call');
const contactRoutes = require('./routes/contacts');
const authRoutes    = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use(limiter);

// audio preview recebe blob binário
app.use('/api/call/preview', express.raw({ type: '*/*', limit: '5mb' }));
app.use(express.json({ limit: '64kb' }));

app.use('/api/auth',     authRoutes);
app.use('/api/call',     callRoutes);
app.use('/api/contacts', contactRoutes);

// serve MP3 gerado para o Twilio
const fs   = require('fs');
const path = require('path');
app.get('/audio/:msgId', (req, res) => {
  const safe = req.params.msgId.replace(/[^a-z0-9\-]/gi, '');
  const file = path.join('/tmp', 'ivox-audio', `${safe}.mp3`);
  if (!fs.existsSync(file)) return res.status(404).send('not found');
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(file);
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`iVox API running on port ${PORT}`));
