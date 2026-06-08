// Hybrid chat client: WebSocket (primary) + HTTP polling (fallback) + local mode
// Exposes: Chat.init() -> { emit, on, nickname, connected }

const Chat = (() => {
  let ws = null;
  let nickname = '';
  const listeners = {};
  let pingTimer = null;
  let pollingId = null;
  let mode = 'init'; // 'ws' | 'poll' | 'local'
  let lastMsgTime = Date.now();
  let nicknameSet = false;
  let tryCount = 0;
  const POLL_INTERVAL = 2500;

  const socket = {
    emit(type, data) {
      if (mode === 'ws' && ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(Object.assign({ type }, data || {}))); } catch (e) { this._httpSend(type, data); }
      } else {
        this._httpSend(type, data);
      }
    },
    _httpSend(type, data) {
      if ((type === 'chat-msg' || type === 'chat') && data && data.text) {
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: String(data.text).trim().slice(0, 500), nickname }),
        }).catch(() => {});
        showMsgLocally(nickname, String(data.text).trim());
      }
    },
    on(type, fn) { listeners[type] = fn; },
    get nickname() { return nickname; },
    get connected() { return mode === 'ws'; },
    get mode() { return mode; },
  };

  function el(id) { return document.getElementById(id); }

  function showMsgLocally(nick, text) {
    const I = window.Interactions || Interactions;
    if (I && I.addChatMsg) I.addChatMsg(nick, text);
    if (listeners['chat-msg']) listeners['chat-msg']({ nickname: nick, text, time: Date.now() });
  }

  function setStatus(state, msg) {
    const status = el('chat-status');
    if (!status) return;
    status.className = 'chat-status chat-status--' + state;
    status.title = msg || '';
    status.textContent = state === 'on' ? '●' : state === 'connecting' ? '◐' : '○';
  }

  function init() {
    setupUI();
    nickname = genNickname();
    const nickEl = el('user-nickname');
    if (nickEl) nickEl.textContent = nickname;
    const onlineEl = el('stat-online');
    if (onlineEl) onlineEl.textContent = '1';
    nicknameSet = true;
    if (listeners['init']) listeners['init']({ nickname });
    tryConnect();
    return socket;
  }

  function setupUI() {
    const input = el('chat-input');
    const sendBtn = el('chat-send');

    function sendChat() {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat', { text });
      input.value = '';
    }

    if (sendBtn) sendBtn.addEventListener('click', sendChat);
    if (input) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    });
  }

  function genNickname() {
    const adjs = ['귀여운','졸린','배고픈','심심한','신비한','용감한','게으른','행복한','슬픈','촉촉한','따뜻한','시원한','달콤한','짭짤한','아기','어른','철든','졸리다','배부른','심통있는','엉뚱한','수줍은','씩씩한','명상하는','산책하는','꿈꾸는'];
    const nouns = ['토끼','고양이','강아지','여우','판다','곰','올빼미','다람쥐','펭귄','코알라','호랑이','사자','고래','나비','별','달','구름','햇살','바람','눈꽃','파랑','노랑','연기','안개','이슬'];
    return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)] + Math.floor(Math.random() * 100);
  }

  // ---------- Try WebSocket → fallback to polling → local ----------
  function tryConnect() {
    tryCount++;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/api/ws`;

    try { ws = new WebSocket(url); } catch (e) { fallbackPoll(); return; }
    setStatus('connecting', 'WebSocket 연결 시도...');

    const failTimer = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch (e) {}
        fallbackPoll();
      }
    }, 5000);

    ws.addEventListener('open', () => {
      clearTimeout(failTimer);
      mode = 'ws';
      setStatus('on', 'WebSocket 연결됨');
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) {}
        }
      }, 25000);
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (ex) { return; }
      if (!msg || !msg.type) return;
      if (msg.type === 'init') {
        nickname = msg.nickname;
        if (el('user-nickname')) el('user-nickname').textContent = nickname;
        if (listeners['init']) listeners['init']({ nickname });
      } else if (msg.type === 'chat-msg') {
        lastMsgTime = msg.time || Date.now();
        const I = window.Interactions || Interactions;
        if (I && I.addChatMsg) I.addChatMsg(msg.nickname, msg.text);
        if (listeners['chat-msg']) listeners['chat-msg'](msg);
      } else if (msg.type === 'user-count' || msg.type === 'stats') {
        const on = el('stat-online');
        if (on) on.textContent = msg.online ?? msg.count ?? on.textContent;
        if (listeners['stats']) listeners['stats']({ online: msg.online ?? msg.count });
      } else if (msg.type === 'pong') {}
    });

    ws.addEventListener('close', () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (mode === 'ws') { setStatus('off', 'WebSocket 끊김'); fallbackPoll(); }
    });
    ws.addEventListener('error', () => {});
  }

  function fallbackPoll() {
    mode = 'poll';
    setStatus('connecting', 'HTTP 폴링 연결 중...');
    poll();
  }

  function poll() {
    if (mode === 'ws') return;
    fetch('/api/chat?since=' + lastMsgTime)
      .then(r => r.json())
      .then(data => {
        if (mode === 'ws') return;
        if (data.ok && data.mode === 'ws') {
          mode = 'local';
          setStatus('off', 'DO 활성화됨 → 페이지 새로고침 필요');
          return;
        }
        if (data.messages) {
          for (const m of data.messages) {
            if (m.time > lastMsgTime && m.nickname && m.nickname !== nickname) {
              lastMsgTime = m.time;
              const I = window.Interactions || Interactions;
              if (I && I.addChatMsg) I.addChatMsg(m.nickname, m.text);
            }
          }
        }
        const online = Math.max(1, data.online || 0);
        if (el('stat-online')) el('stat-online').textContent = online;
        setStatus('on', online + '명 접속');
        if (data.error && data.error.includes('binding')) {
          mode = 'local';
          setStatus('on', '나 포함 1명');
          if (el('stat-online')) el('stat-online').textContent = '1';
        }
      })
      .catch(() => {})
      .then(() => {
        if (mode !== 'ws') pollingId = setTimeout(poll, POLL_INTERVAL);
      });
  }

  return { init };
})();
