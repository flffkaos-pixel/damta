export async function onRequest() {
  try {
    const resp = await fetch('https://mydurableobject.flffkaos.workers.dev/api/health');
    const data = await resp.json();
    return new Response(JSON.stringify({
      ok: true, timestamp: new Date().toISOString(),
      chat_mode: 'Worker DO (WebSocket + HTTP)',
      worker: data,
      status: data.binding ? '✅ 정상' : '⚠️ DO 바인딩 없음'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false, timestamp: new Date().toISOString(),
      chat_mode: 'Worker 연결 실패',
      error: String(e.message || e),
      status: '❌ Worker 오프라인'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
