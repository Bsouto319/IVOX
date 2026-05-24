const express = require('express');
const auth    = require('../middleware/auth');
const db      = require('../services/supabase');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const contacts = await db.getContacts(req.userId);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', express.json(), async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });
  try {
    const contact = await db.upsertContact(req.userId, { name, phone });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteContact(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
