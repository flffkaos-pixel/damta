export async function onRequest(context) {
  const db = context.env.DB;
  let dbOk = false;
  let msgCount = 0;
  if (db) {
    try {
      await db.exec('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL)');
      const { results } = await db.prepare('SELECT COUNT(*) as cnt FROM messages').all();
      msgCount = results?.[0]?.cnt || 0;
      dbOk = true;
    } catch (e) { dbOk = false; }
  }
  return new Response(JSON.stringify({
    ok: true,
    timestamp: new Date().toISOString(),
    chat_mode: 'D1 database (HTTP polling)',
    binding: { name: 'DB', configured: !!db, database: db ? 'damta-chat' : null, messages: msgCount },
    status: dbOk ? '✅ D1 정상 - ' + msgCount + '개 메시지' : '❌ D1 미설정',
    steps: ['1. Cloudflare 대시보드 → D1 → Create database "damta-chat"',
            '2. onlinedamta 페이지 → Settings → Functions → D1 bindings → Add: DB = damta-chat',
            '3. 저장 → 자동 재배포 후 새로고침']
  }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
