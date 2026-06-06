// Health check: GET /api/health
// Verifies Durable Object binding is configured
export async function onRequestGet(context) {
  const hasBinding = !!context.env.CHAT_ROOM;
  let bindingTest = null;
  if (hasBinding) {
    try {
      const id = context.env.CHAT_ROOM.idFromName('healthcheck');
      const obj = context.env.CHAT_ROOM.get(id);
      const resp = await obj.fetch(new Request('https://internal/health'));
      bindingTest = {
        reachable: resp.status === 400,
        status: resp.status,
      };
    } catch (e) {
      bindingTest = { reachable: false, error: String(e.message || e) };
    }
  }
  return new Response(JSON.stringify({
    ok: hasBinding,
    timestamp: new Date().toISOString(),
    binding: { name: 'CHAT_ROOM', configured: hasBinding, test: bindingTest },
    next_steps: hasBinding
      ? 'Open the site and try the chat input.'
      : 'Go to Cloudflare dashboard → Workers & Pages → onlinedamta → Settings → Functions → Durable Object bindings → Add binding (name: CHAT_ROOM, class: ChatRoom).',
  }, null, 2), {
    status: hasBinding ? 200 : 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
