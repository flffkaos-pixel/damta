// Durable Object: 단일 채팅방 (모든 클라이언트의 WebSocket 연결을 중계)
// - 온라인 카운트, 닉네임 관리, 메시지 브로드캐스트, vape 완료 통계
// - SQLite 기반 영구 저장 (선택적, 일일 통계 리셋용)

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.nicknameMap = new Map();
    this.totalVapes = 0;
    this.statsDate = new Date().toDateString();
    this.state.blockConcurrencyWhile(this.init.bind(this));
  }

  async init() {
    // SQLite storage initialization
    if (this.state.storage.sql) {
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS daily_stats (
          date TEXT PRIMARY KEY,
          vapes INTEGER DEFAULT 0
        )
      `);
      const today = new Date().toDateString();
      this.state.storage.sql.exec(
        'INSERT OR IGNORE INTO daily_stats (date, vapes) VALUES (?, 0)',
        today
      );
      const row = this.state.storage.sql.exec(
        'SELECT vapes FROM daily_stats WHERE date = ?',
        today
      ).one();
      this.totalVapes = row ? row.vapes : 0;
    }
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade === 'websocket') {
      return this.handleWebSocket(request);
    }
    return new Response('Expected WebSocket', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  handleWebSocket(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

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
    server.addEventListener('close', () => {
      this.handleClose(sessionId);
    });
    server.addEventListener('error', () => {
      this.handleClose(sessionId);
    });

    // Send init to the new client
    try {
      server.send(JSON.stringify({ type: 'init', nickname }));
    } catch (e) {}

    // Broadcast updated counts
    this.broadcastUserCount();
    this.broadcastStats();

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(sessionId, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const nickname = this.nicknameMap.get(sessionId);
    if (!nickname) return;

    if (msg.type === 'chat') {
      const text = String(msg.text || '').trim().substring(0, 500);
      if (!text) return;
      this.broadcast({
        type: 'chat-msg',
        nickname,
        text,
        time: Date.now(),
      });
    } else if (msg.type === 'vape-done') {
      this.incrementVape();
      this.broadcastStats();
    }
  }

  handleClose(sessionId) {
    this.sessions.delete(sessionId);
    this.nicknameMap.delete(sessionId);
    this.broadcastUserCount();
    this.broadcastStats();
  }

  incrementVape() {
    const today = new Date().toDateString();
    if (today !== this.statsDate) {
      this.totalVapes = 0;
      this.statsDate = today;
      if (this.state.storage.sql) {
        this.state.storage.sql.exec(
          'INSERT OR REPLACE INTO daily_stats (date, vapes) VALUES (?, 0)',
          today
        );
      }
    }
    this.totalVapes++;
    if (this.state.storage.sql) {
      this.state.storage.sql.exec(
        'UPDATE daily_stats SET vapes = ? WHERE date = ?',
        this.totalVapes,
        this.statsDate
      );
    }
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.sessions.values()) {
      try {
        ws.send(data);
      } catch (e) {
        // dead connection, will be cleaned up on close
      }
    }
  }

  broadcastUserCount() {
    this.broadcast({ type: 'user-count', count: this.sessions.size });
  }

  broadcastStats() {
    this.broadcast({
      type: 'stats',
      online: this.sessions.size,
      vapes: this.totalVapes,
    });
  }

  randomNickname() {
    const adjs = [
      '귀여운', '졸린', '배고픈', '심심한', '신비한', '용감한', '게으른',
      '행복한', '슬픈', '촉촉한', '따뜻한', '시원한', '달콤한', '짭짤한',
      '아기', '어른', '철든', '철없는', '졸리다', '배부른', '심통있는',
    ];
    const nouns = [
      '토끼', '고양이', '강아지', '여우', '판다', '곰', '올빼미',
      '다람쥐', '펭귄', '코알라', '호랑이', '사자', '고래', '나비',
      '별', '달', '구름', '햇살', '바람', '눈꽃', '파랑', '노랑',
    ];
    const a = adjs[Math.floor(Math.random() * adjs.length)];
    const n = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return a + n + num;
  }
}
