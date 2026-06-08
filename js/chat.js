// Hybrid chat client: WebSocket (primary) + HTTP polling (fallback)
// Exposes: Chat.init() -> { emit, on, nickname, connected }

const Chat = (() => {
  let ws = null;
  let nickname = '';
  const listeners = {};
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let pingTimer = null;
  let isAlive = true;
  let pollingId = null;
  let pollingMode = false;
  let lastMsgTime = 0;
  let nicknameSet = false;

  const socket = {
    emit(type, data) {
      if (pollingMode) {
        this._httpSend(type, data);
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(Object.assign({ type }, data || {})));
        } catch (e) {}
      } else {
        this._httpSend(type, data);
      }
    },
    _httpSend(type, data) {
      if (type === 'chat-msg' || type === 'chat') {
        const text = (data && data.text || '').trim();
        if (!text) return;
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, nickname }),
        }).catch(() => {});
      }
    },
    on(type, fn) {
      listeners[type] = fn;
    },
    get nickname() { return nickname; },
    get connected() { return (ws && ws.readyState === WebSocket.OPEN) || pollingMode; },
  };

  function setStatus(state, msg) {
    const el = document.getElementById('chat-status');
    if (!el) return;
    el.className = 'chat-status chat-status--' + state;
    el.title = msg || '';
    if (state === 'on') el.textContent = '●';
    else if (state === 'off') el.textContent = '○';
    else el.textContent = '◐';
  }

  function init() {
    setupUI();
    connect();
    return socket;
  }

  function setupUI() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    function sendChat() {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat', { text });
      input.value = '';
    }

    if (sendBtn) sendBtn.addEventListener('click', sendChat);
    if (input) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChat();
      }
    });
  }

  // ---------- Polling mode ----------
  function startPolling() {
    if (!nicknameSet) {
      nickname = randomLocalNickname();
      nicknameSet = true;
      const el = document.getElementById('user-nickname');
      if (el) el.textContent = nickname;
      if (listeners['init']) listeners['init']({ nickname });
    }
    pollingMode = true;
    setStatus('on', 'HTTP 폴링 모드');
    if (document.getElementById('stat-online')) {
      document.getElementById('stat-online').textContent = '폴링';
    }
    poll();
  }

  function poll() {
    if (!pollingMode) return;
    fetch('/api/chat?since=' + lastMsgTime)
      .then(r => r.json())
      .then(data => {
        if (!pollingMode) return;
        if (data.mode === 'ws' && data.ok && ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
          stopPolling();
          return;
        }
        if (data.messages) {
          for (const m of data.messages) {
            if (m.time > lastMsgTime) {
              lastMsgTime = m.time;
              if (m.type === 'chat-msg' || m.nickname) {
                const I = window.Interactions || Interactions;
                if (I && I.addChatMsg) I.addChatMsg(m.nickname || '익명', m.text);
                if (listeners['chat-msg']) listeners['chat-msg'](m);
              }
            }
          }
        }
        if (typeof data.online === 'number') {
          const el = document.getElementById('stat-online');
          if (el) el.textContent = data.online;
        }
      })
      .catch(() => {})
      .then(() => {
        if (pollingMode) pollingId = setTimeout(poll, 3000);
      });
  }

  function stopPolling() {
    pollingMode = false;
    if (pollingId) { clearTimeout(pollingId); pollingId = null; }
    if (document.getElementById('stat-online')) {
      document.getElementById('stat-online').textContent = '0';
    }
  }

  function randomLocalNickname() {
    const adjs = ['귀여운','졸린','배고픈','심심한','신비한','용감한','게으른','행복한','슬픈','촉촉한','따뜻한','시원한','달콤한','짭짤한','아기','어른','철든','졸리다','배부른','심통있는','엉뚱한','수줍은','씩씩한','명상하는','산책하는','꿈꾸는'];
    const nouns = ['토끼','고양이','강아지','여우','판다','곰','올빼미','다람쥐','펭귄','코알라','호랑이','사자','고래','나비','별','달','구름','햇살','바람','눈꽃','파랑','노랑','연기','안개','이슬'];
    return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)] + Math.floor(Math.random() * 100);
  }

  // ---------- WebSocket mode ----------
  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/api/ws`;

    let wsFallbackTimer = null;
    try {
      ws = new WebSocket(url);
      setStatus('connecting', '서버 연결 시도 중...');
    } catch (e) {
      setStatus('off', 'WebSocket 실패 → 폴링 모드');
      startPolling();
      return;
    }

    ws.addEventListener('open', () => {
      reconnectAttempts = 0;
      isAlive = true;
      setStatus('on', 'WebSocket 연결됨');
      if (wsFallbackTimer) { clearTimeout(wsFallbackTimer); wsFallbackTimer = null; }
      stopPolling();
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) {}
        }
      }, 25000);
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      if (!msg || !msg.type) return;

      if (msg.type === 'init') {
        nickname = msg.nickname;
        nicknameSet = true;
        const el = document.getElementById('user-nickname');
        if (el) el.textContent = nickname;
        if (listeners['init']) listeners['init']({ nickname });
      } else if (msg.type === 'chat-msg') {
        lastMsgTime = msg.time || Date.now();
        const I = window.Interactions || Interactions;
        if (I && I.addChatMsg) I.addChatMsg(msg.nickname, msg.text);
        if (listeners['chat-msg']) listeners['chat-msg'](msg);
      } else if (msg.type === 'user-count' || msg.type === 'stats') {
        const on = document.getElementById('stat-online');
        if (on && typeof msg.online === 'number') on.textContent = msg.online;
        else if (on && typeof msg.count === 'number') on.textContent = msg.count;
        if (listeners['stats']) listeners['stats']({ online: msg.online ?? msg.count });
        if (listeners['user-count']) listeners['user-count']({ count: msg.count });
      } else if (msg.type === 'pong') {
        isAlive = true;
      }
    });

    ws.addEventListener('close', (ev) => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (wsFallbackTimer) { clearTimeout(wsFallbackTimer); wsFallbackTimer = null; }
      if (pollingMode) return;
      setStatus('off', 'WebSocket 끊김. 폴링 모드 전환...');
      startPolling();
    });

    ws.addEventListener('error', () => {
      if (wsFallbackTimer) { clearTimeout(wsFallbackTimer); wsFallbackTimer = null; }
      if (pollingMode) return;
    });

    // Fallback: if WebSocket doesn't connect in 5s → polling
    wsFallbackTimer = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN && !pollingMode) {
        setStatus('off', '서버 연결 시간 초과 → 폴링 모드');
        ws.close();
        startPolling();
      }
    }, 5000);
  }

  return { init };
})();
