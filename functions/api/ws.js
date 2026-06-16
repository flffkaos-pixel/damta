// WebSocket endpoint: /api/ws
// All in one file (no imports) for maximum Cloudflare Pages compatibility
// Uses a Durable Object (Chat_Room) for cross-connection broadcast

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.nicknameMap = new Map();
    this.totalVapes = 0;
    this.statsDate = new Date().toDateString();
    this.messages = [];
    this.state.blockConcurrencyWhile(this.init.bind(this));
  }

  async init() {
    if (this.state.storage && this.state.storage.sql) {
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS daily_stats (
          date TEXT PRIMARY KEY,
          vapes INTEGER DEFAULT 0
        )
      `);
    }
  }

  async fetch(request) {
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }
    // HTTP polling: GET /chat-get?since=ts
    const url = new URL(request.url);
    if (url.pathname === '/chat-get' && request.method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10);
      const recentMsgs = this.messages.filter(m => m.time > since);
      return new Response(JSON.stringify({
        messages: recentMsgs.slice(-50),
        online: this.sessions.size,
      }));
    }
    // HTTP polling: POST /chat-post
    if (url.pathname === '/chat-post' && request.method === 'POST') {
      const body = await request.json();
      const text = String(body.text || '').trim().substring(0, 500);
      if (!text) return new Response(JSON.stringify({ ok: false }));
      const nickname = body.nickname || this.randomNickname();
      const msg = { type: 'chat-msg', nickname, text, time: Date.now() };
      this.messages.push(msg);
      if (this.messages.length > 200) this.messages.splice(0, this.messages.length - 200);
      this.broadcast(msg);
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response('Not Found', { status: 404 });
  }

  handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, server);
    const nickname = this.randomNickname();
    this.nicknameMap.set(sessionId, nickname);

    server.accept();
    server.addEventListener('message', (event) => {
      this.handleMessage(sessionId, event.data);
    });
    server.addEventListener('close', () => this.handleClose(sessionId));
    server.addEventListener('error', () => this.handleClose(sessionId));

    try {
      server.send(JSON.stringify({ type: 'init', nickname }));
    } catch (e) {}

    this.broadcastUserCount();
    this.broadcastStats();

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(sessionId, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const nickname = this.nicknameMap.get(sessionId);
    if (!nickname) return;

    if (msg.type === 'chat') {
      const text = String(msg.text || '').trim().substring(0, 500);
      if (!text) return;
      const chatMsg = { type: 'chat-msg', nickname, text, time: Date.now() };
      this.messages.push(chatMsg);
      if (this.messages.length > 200) this.messages.splice(0, this.messages.length - 200);
      this.broadcast(chatMsg);
    } else if (msg.type === 'vape-done') {
      this.totalVapes++;
      this.broadcastStats();
    } else if (msg.type === 'ping') {
      try {
        const ws = this.sessions.get(sessionId);
        if (ws) ws.send(JSON.stringify({ type: 'pong' }));
      } catch (e) {}
    }
  }

  handleClose(sessionId) {
    this.sessions.delete(sessionId);
    this.nicknameMap.delete(sessionId);
    this.broadcastUserCount();
    this.broadcastStats();
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.sessions.values()) {
      try { ws.send(data); } catch (e) {}
    }
  }

  broadcastUserCount() {
    this.broadcast({ type: 'user-count', count: this.sessions.size });
  }

  broadcastStats() {
    this.broadcast({ type: 'stats', online: this.sessions.size, vapes: this.totalVapes });
  }

  randomNickname() {
    const adjs = ['귀여운','졸린','배고픈','심심한','신비한','용감한','게으른','행복한','슬픈','촉촉한','따뜻한','시원한','달콤한','짭짤한','아기','어른','철든','졸리다','배부른','심통있는','엉뚱한','수줍은','씩씩한','명상하는','산책하는','꿈꾸는','방긋한','새근새근'];
    const nouns = ['토끼','고양이','강아지','여우','판다','곰','올빼미','다람쥐','펭귄','코알라','호랑이','사자','고래','나비','별','달','구름','햇살','바람','눈꽃','파랑','노랑','연기','안개','이슬','구름이','하늘','바람이'];
    const a = adjs[Math.floor(Math.random() * adjs.length)];
    const n = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return a + n + num;
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    ok: true,
    binding: !!context.env.Chat_Room,
    message: context.env.Chat_Room
      ? 'Chat_Room Durable Object binding is set. WebSocket ready at /api/ws'
      : 'Chat_Room binding is NOT set.',
  }), {
    status: context.env.Chat_Room ? 200 : 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
