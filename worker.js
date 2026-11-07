// Cloudflare Worker: relays the class assistant's requests to the Anthropic Messages API.
// Secrets/variables (Workers → Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (secret)  your Claude API key
//   APP_TOKEN          (secret)  a password you invent; the page sends it so strangers cannot use your key
//   ALLOWED_ORIGIN     (text)    https://g4ryouo.github.io
export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://g4ryouo.github.io';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Headers': 'content-type, x-app-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages') return new Response('Not found', { status: 404, headers: cors });
    if (request.headers.get('Origin') !== allowed) return new Response('Forbidden', { status: 403, headers: cors });
    if (env.APP_TOKEN && request.headers.get('x-app-token') !== env.APP_TOKEN) return new Response('Unauthorized', { status: 401, headers: cors });
    if (!env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY is not set on this Worker', { status: 500, headers: cors });
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: request.body,
    });
    return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'content-type': upstream.headers.get('content-type') || 'application/json' } });
  },
};
