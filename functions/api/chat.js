// HTTP-based chat endpoint (polling fallback)
// GET /api/chat?since=ts → recent messages + online count
// POST /api/chat → add a message { text, nickname }
// Requires DO binding CHAT_ROOM in Cloudflare Pages dashboard

const HELP = `
To enable multi-user chat:
1. Cloudflare Dashboard → Workers & Pages → onlinedamta
2. Settings → Functions → Durable Object bindings
3. Add: Variable name = Chat_Room, Class = MyDurableObject
4. Save → wait for redeploy → refresh the page
`;

export async function onRequest(context) {
  const doBinding = context.env.Chat_Room;
  if (doBinding) {
    try {
      const id = doBinding.idFromName('http-api');
      const obj = doBinding.get(id);
      const url = new URL(context.request.url);
      if (context.request.method === 'POST') {
        const body = await context.request.json();
        const resp = await obj.fetch(new Request('http://internal/chat-post', {
          method: 'POST',
          body: JSON.stringify(body),
        }));
        const data = await resp.json();
        return json({ ok: true, ...data, mode: 'ws' });
      }
      const since = url.searchParams.get('since') || '0';
      const resp = await obj.fetch(new Request(`http://internal/chat-get?since=${since}`));
      const data = await resp.json();
      return json({ ok: true, ...data, mode: 'ws' });
    } catch (e) {
      return json({ ok: false, messages: [], online: 0, mode: 'error', error: String(e.message || e) });
    }
  }
  // No DO binding - guide user
  if (context.request.method === 'POST') {
    // Accept message but will only be seen by sender
    return json({ ok: true, accepted: true, broadcast: false, mode: 'setup-needed', help: HELP });
  }
  return json({ ok: false, messages: [], online: 0, mode: 'setup-needed', help: HELP });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
