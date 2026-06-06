// Native WebSocket client (drop-in replacement for Socket.IO)
// Exposes: Chat.init() -> { emit, on, getNickname }
// Backwards compatible: emits 'chat-msg', receives 'init'/'chat-msg'/'user-count'/'stats'

const Chat = (() => {
  let ws = null;
  let nickname = '';
  const listeners = {};
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let pingTimer = null;
  let isAlive = true;

  // Public socket-like API for backwards compatibility with main.js / interactions.js
  const socket = {
    emit(type, data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(Object.assign({ type }, data || {})));
        } catch (e) {}
      }
    },
    on(type, fn) {
      listeners[type] = fn;
    },
    get nickname() { return nickname; },
  };

  function init() {
    connect();
    setupUI();
    return socket;
  }

  function setupUI() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    function sendChat() {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat-msg', { text });
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

    try {
      ws = new WebSocket(url);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      reconnectAttempts = 0;
      isAlive = true;
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
        const el = document.getElementById('user-nickname');
        if (el) el.textContent = nickname;
        if (listeners['init']) listeners['init']({ nickname });
      } else if (msg.type === 'chat-msg') {
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

    ws.addEventListener('close', () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // 'error' is followed by 'close'
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    // exponential backoff: 1s, 2s, 4s, 8s, max 15s
    const delay = Math.min(15000, 1000 * Math.pow(2, reconnectAttempts - 1));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  return { init };
})();
