// Vercel Edge Function: relays the class assistant's requests to the Anthropic Messages API.
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  your Claude API key
//   APP_TOKEN          a password you invent; the page sends it so strangers cannot use your key
//   ALLOWED_ORIGIN     optional, comma-separated extra origins (default: https://g4ryouo.github.io)
// Requests from this deployment's own origin are always allowed.
//
// Vercel stops an Edge Function that has not started its response within 25 seconds. A long answer (the whole-class cleanup,
// a summary) or a slow moment at Anthropic can take longer than that, so the response is started at once and a keep-alive is
// sent while waiting: a blank for ordinary replies (leading whitespace is valid JSON) and an SSE comment for streams.
// Because the status line is sent before the answer is known, an upstream failure is passed on inside the body, in
// Anthropic's own error shape {"type":"error","error":{...}}, and the page reads it from there.
export const config = { runtime: 'edge' };

const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS) || 10000;

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
  const fail = (status, message) => new Response(JSON.stringify({ type: 'error', error: { type: 'relay_error', message } }), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
  if (request.method !== 'POST') return new Response('Not found', { status: 404 });
  if (!allowed) return new Response('Forbidden', { status: 403 });
  const token = process.env.APP_TOKEN;
  if (token && request.headers.get('x-app-token') !== token) return fail(401, '存取密碼不正確（請檢查「連線設定」的密碼是否和 APP_TOKEN 一樣）');
  if (!process.env.ANTHROPIC_API_KEY) return fail(500, '中繼站尚未設定 ANTHROPIC_API_KEY（Vercel → Settings → Environment Variables，設定後要 Redeploy）');

  const body = await request.text();
  let wantsStream = false; try { wantsStream = JSON.parse(body).stream === true; } catch {}
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter(), enc = new TextEncoder();
  const say = text => writer.write(enc.encode(text)).catch(() => {});
  const errorBody = (type, message) => JSON.stringify({ type: 'error', error: { type, message } });

  (async () => {
    const beat = setInterval(() => say(wantsStream ? ': keepalive\n\n' : ' '), KEEPALIVE_MS);
    try {
      const up = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body,
      });
      clearInterval(beat);
      if (!up.ok) {
        const text = await up.text();
        const json = (() => { try { return JSON.parse(text); } catch { return null; } })() || JSON.parse(errorBody('upstream_error', `Claude API ${up.status}: ${text.slice(0, 200)}`));
        await say(wantsStream ? `event: error\ndata: ${JSON.stringify(json)}\n\n` : JSON.stringify(json));
      } else {
        const reader = up.body.getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; await writer.write(value); }
      }
    } catch (e) {
      await say(wantsStream ? `event: error\ndata: ${errorBody('relay_error', String(e && e.message || e))}\n\n` : errorBody('relay_error', String(e && e.message || e)));
    } finally {
      clearInterval(beat); writer.close().catch(() => {});
    }
  })();

  return new Response(readable, { status: 200, headers: { ...cors, 'content-type': wantsStream ? 'text/event-stream; charset=utf-8' : 'application/json', 'cache-control': 'no-store' } });
}
