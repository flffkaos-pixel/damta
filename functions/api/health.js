// Health check: GET /api/health
// Verifies Durable Object binding is configured for multi-user chat

export async function onRequest(context) {
  const hasBinding = !!context.env.CHAT_ROOM;
  let bindingTest = null;
  if (hasBinding) {
    try {
      const id = context.env.CHAT_ROOM.idFromName('healthcheck');
      const obj = context.env.CHAT_ROOM.get(id);
      const resp = await obj.fetch(new Request('https://internal/health'));
      bindingTest = { reachable: resp.status !== 500, status: resp.status };
    } catch (e) {
      bindingTest = { reachable: false, error: String(e.message || e) };
    }
  }
  return new Response(JSON.stringify({
    ok: hasBinding,
    timestamp: new Date().toISOString(),
    chat_mode: hasBinding ? 'WebSocket + HTTP polling (멀티유저)' : 'HTTP polling only (로컬 전용, 타인 메시지 불가)',
    binding: {
      name: 'CHAT_ROOM',
      configured: hasBinding,
      test: bindingTest,
      config_url: 'https://dash.cloudflare.com/?to=/:account/workers-and-pages',
      steps: [
        '1. Cloudflare 대시보드 로그인 → Workers & Pages → onlinedamta',
        '2. Settings → Functions → Durable Object bindings → Add binding',
        '3. Variable name: CHAT_ROOM  /  Class name: ChatRoom',
        '4. Save → 자동 재배포 완료 후 페이지 새로고침',
      ],
      status: hasBinding ? '✅ 정상' : '❌ 미설정 - 위 단계를 따라 설정해주세요',
    },
    user_status: '랜덤 닉네임이 생성되었습니다. 메시지를 보내면 로컬에 표시됩니다. 위 단계 완료 후 모두와 채팅할 수 있습니다.',
  }, null, 2), {
    status: hasBinding ? 200 : 200, // always 200 so user can read the JSON
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
