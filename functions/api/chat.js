// D1-based chat: HTTP polling only (no WebSocket, no DO)
// GET /api/chat?since=ts -> new messages + online count
// POST /api/chat -> add message { text, nickname }

const HELP = 'Chat is working via D1 database.';

export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) {
    return json({ ok: false, messages: [], online: 0, mode: 'local', error: 'D1 binding not set' });
  }
  try {
    // Ensure table exists
    await db.exec('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL)');

    if (context.request.method === 'POST') {
      const body = await context.request.json();
      const text = String(body.text || '').trim().slice(0, 500);
      if (!text) return json({ ok: false }, 400);
      const nickname = body.nickname || '익명';
      const time = Date.now();
      await db.prepare('INSERT INTO messages (nickname, text, time) VALUES (?1, ?2, ?3)').bind(nickname, text, time).run();
      // Keep only latest 200 messages
      await db.exec('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT 200)');
      return json({ ok: true });
    }

    const since = parseInt(new URL(context.request.url).searchParams.get('since') || '0', 10);
    const { results } = await db.prepare('SELECT nickname, text, time FROM messages WHERE time > ?1 ORDER BY time ASC LIMIT 50').bind(since).all();
    const online = 1; // D1 doesn't track online count; at least the user
    return json({ ok: true, messages: results || [], online, mode: 'd1' });
  } catch (e) {
    return json({ ok: false, messages: [], online: 0, mode: 'error', error: String(e.message || e) });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
