const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function deductCredit(userId) {
  const { data, error } = await supabase.rpc('deduct_credit', { user_id: userId });
  if (error) throw new Error(error.message);
  return data;
}

async function getContacts(userId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

async function upsertContact(userId, { name, phone }) {
  const { data, error } = await supabase
    .from('contacts')
    .upsert({ user_id: userId, name, phone }, { onConflict: 'user_id,phone' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteContact(userId, contactId) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

async function logCall(userId, { phone, transcription, translation, callSid, credits_used }) {
  const { error } = await supabase.from('call_logs').insert({
    user_id: userId, phone, transcription, translation, call_sid: callSid, credits_used,
  });
  if (error) throw new Error(error.message);
}

module.exports = { supabase, getUserById, deductCredit, getContacts, upsertContact, deleteContact, logCall };
