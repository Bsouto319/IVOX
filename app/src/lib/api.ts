const API = process.env.EXPO_PUBLIC_API_URL as string;

async function authFetch(url: string, token: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${url}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export async function previewCall(audioBlob: Blob, mimeType: string, token: string) {
  const baseType = mimeType.split(';')[0].trim() || 'audio/mp4';
  return authFetch('/api/call/preview', token, {
    method: 'POST',
    headers: { 'Content-Type': baseType },
    body: audioBlob,
  });
}

export async function sendCall(
  token: string,
  msgId: string,
  phone: string,
  saveContact?: { name: string }
) {
  return authFetch('/api/call/send', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgId, phone, ...(saveContact ? { saveContact: true, contactName: saveContact.name } : {}) }),
  });
}

export async function getContacts(token: string) {
  return authFetch('/api/contacts', token);
}

export async function addContact(token: string, name: string, phone: string) {
  return authFetch('/api/contacts', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone }),
  });
}

export async function deleteContact(token: string, id: string) {
  return authFetch(`/api/contacts/${id}`, token, { method: 'DELETE' });
}
