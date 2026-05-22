const Chat = (() => {
  let socket = null;
  let nickname = '';
  let currentRoom = 'rooftop';
  let msgCount = 0;

  function init() {
    socket = io();

    socket.on('init', (data) => {
      nickname = data.nickname;
      document.getElementById('user-nickname').textContent = nickname;
      currentRoom = data.defaultRoom || 'rooftop';
    });

    socket.on('chat-msg', (data) => {
      addMsg(data.nickname, data.text, data.time);
    });

    socket.on('user-count', (data) => {
      document.getElementById('room-count').textContent = data.count + '명';
    });

    socket.on('room-changed', (data) => {
      currentRoom = data.roomId;
    });

    socket.on('stats', (data) => {
      document.getElementById('stat-online').textContent = data.online;
      document.getElementById('stat-cigarettes').textContent = data.cigarettes;
    });

    // Pass socket to interactions
    const checkInteractions = setInterval(() => {
      if (window.Interactions && window.Interactions._setSocket) {
        window.Interactions._setSocket(socket);
        clearInterval(checkInteractions);
      }
    }, 100);

    // Chat input
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    function send() {
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat-msg', { text });
      input.value = '';
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    // Room buttons
    document.querySelectorAll('.room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const roomId = btn.dataset.room;
        socket.emit('join-room', roomId);
        document.body.className = 'theme-' + roomId;
        if (window.innerWidth <= 768) document.getElementById('chat-panel').classList.remove('open');
      });
    });

    // Mobile chat toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('chat-panel').classList.toggle('open');
    });
    document.getElementById('chat-close').addEventListener('click', () => {
      document.getElementById('chat-panel').classList.remove('open');
    });
  }

  function addMsg(nick, text, time) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.dataset.index = msgCount++;
    const t = time ? new Date(time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
    el.innerHTML = `<span class="nick">${escapeHtml(nick)}</span><span class="text">${escapeHtml(text)}</span>`;
    const container = document.getElementById('chat-msgs');
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;

    // Auto-fade after 25 seconds (damta.world style)
    setTimeout(() => {
      el.style.transition = 'opacity 1.5s ease-out';
      el.style.opacity = '0';
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
    }, 25000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init: () => { init(); return socket; } };
})();
