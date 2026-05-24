const express = require('express');
const { supabase } = require('../services/supabase');

const router = express.Router();
router.use(express.json());

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name: name || '' },
  });
  if (error) return res.status(400).json({ error: error.message });

  // cria registro na tabela users com 10 créditos de boas-vindas
  await supabase.from('users').insert({ id: data.user.id, email, name: name || '', credits: 10 });

  res.status(201).json({ ok: true, userId: data.user.id });
});

router.post('/credits/add', async (req, res) => {
  // chamado pelo webhook de pagamento (Stripe etc)
  const { userId, credits, secret } = req.body || {};
  if (secret !== process.env.CREDITS_WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase.rpc('add_credits', { user_id: userId, amount: credits });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

module.exports = router;
