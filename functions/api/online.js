export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const nickname = url.searchParams.get('nickname') || 'anon';
  const now = Date.now();
  const TTL = 60;
  const KEY_PREFIX = 'online:';

  if (!env.ONLINE_KV) {
    return new Response(JSON.stringify({ online: 1, error: 'KV 바인딩 없음' }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }

  const kv = env.ONLINE_KV;

  try {
    if (request.method === 'POST') {
      await kv.put(`${KEY_PREFIX}${nickname}`, String(now), { expirationTtl: TTL });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    const list = await kv.list({ prefix: KEY_PREFIX });
    let count = 0;
    const details = [];
    for (const key of list.keys) {
      const val = await kv.get(key.name);
      const expired = val && parseInt(val) + TTL * 1000 <= now;
      if (val && !expired) {
        count++;
        details.push({ key: key.name, ts: parseInt(val), valid: true });
      } else if (val) {
        await kv.delete(key.name);
        details.push({ key: key.name, ts: parseInt(val), valid: false, deleted: true });
      } else {
        details.push({ key: key.name, val: null, valid: false });
      }
    }
    return new Response(JSON.stringify({ online: Math.max(1, count), debug: { keysFound: list.keys.length, details, now } }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ online: 1, error: String(e) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
}