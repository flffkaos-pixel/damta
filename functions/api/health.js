// Health check: checks backend Worker status
export async function onRequest(context) {
  try {
    const resp = await fetch('https://mydurableobject.flffkaos.workers.dev/api/health');
    const data = await resp.json();
    return new Response(JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      chat_mode: 'WebSocket + HTTP polling (Worker DO)',
      worker: data,
      status: '✅ 정상'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      timestamp: new Date().toISOString(),
      chat_mode: 'Worker 연결 실패',
      error: String(e.message || e),
      status: '❌ Worker 오프라인'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
