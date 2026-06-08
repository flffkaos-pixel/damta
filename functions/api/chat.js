// HTTP-based chat endpoint (polling fallback)
// GET /api/chat?since=timestamp → returns recent messages + online count
// POST /api/chat → add a message { nickname, text }
// Requires DO binding CHAT_ROOM (wrangler.toml or dashboard)

export async function onRequestGet(context) {
  const doBinding = context.env.CHAT_ROOM;
  if (!doBinding) {
    return new Response(JSON.stringify({ ok: false, messages: [], online: 0, mode: 'wait', error: 'DO binding not ready' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const id = doBinding.idFromName('http-api');
    const obj = doBinding.get(id);
    const url = new URL(context.request.url);
    const since = url.searchParams.get('since') || '0';
    const resp = await obj.fetch(new Request(`http://internal/chat-get?since=${since}`));
    const data = await resp.json();
    return new Response(JSON.stringify({ ok: true, ...data, mode: 'ws' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, messages: [], online: 0, mode: 'wait', error: String(e.message || e) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export async function onRequestPost(context) {
  const doBinding = context.env.CHAT_ROOM;
  if (!doBinding) {
    return new Response(JSON.stringify({ ok: false, error: 'DO binding not ready' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  try {
    const body = await context.request.json();
    const id = doBinding.idFromName('http-api');
    const obj = doBinding.get(id);
    const resp = await obj.fetch(new Request('http://internal/chat-post', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
    const data = await resp.json();
    return new Response(JSON.stringify({ ok: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
