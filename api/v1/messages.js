// Vercel Edge Function: relays the class assistant's requests to the Anthropic Messages API.
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  your Claude API key
//   APP_TOKEN          a password you invent; the page sends it so strangers cannot use your key
//   ALLOWED_ORIGIN     optional, comma-separated extra origins (default: https://g4ryouo.github.io)
// Requests from this deployment's own origin are always allowed.
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const self = new URL(request.url).origin;
  const origin = request.headers.get('origin') || '';
  const extra = (process.env.ALLOWED_ORIGIN || 'https://g4ryouo.github.io').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = origin === self || extra.includes(origin);
  const cors = allowed ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type, x-app-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  } : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
  if (request.method !== 'POST') return new Response('Not found', { status: 404 });
  if (!allowed) return new Response('Forbidden', { status: 403 });
  const token = process.env.APP_TOKEN;
  if (token && request.headers.get('x-app-token') !== token) return new Response(JSON.stringify({ error: { message: '存取密碼不正確（請檢查「連線設定」的密碼是否和 APP_TOKEN 一樣）' } }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
  if (!process.env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: { message: '中繼站尚未設定 ANTHROPIC_API_KEY（Vercel → Settings → Environment Variables，設定後要 Redeploy）' } }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } });
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: request.body,
  });
  return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'content-type': upstream.headers.get('content-type') || 'application/json' } });
}
