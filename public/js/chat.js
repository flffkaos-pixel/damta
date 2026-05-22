const Chat = (() => {
  let socket = null;
  let nickname = '';
  let msgCount = 0;

  function init() {
    socket = io();

    socket.on('init', (data) => {
      nickname = data.nickname;
      const el = document.getElementById('user-nickname');
      if (el) el.textContent = nickname;
    });

    socket.on('chat-msg', (data) => {
      if (window.Interactions && window.Interactions.addChatMsg) {
        window.Interactions.addChatMsg(data.nickname, data.text);
      }
    });

    socket.on('stats', (data) => {
      const on = document.getElementById('stat-online');
      const cig = document.getElementById('stat-cigarettes');
      if (on) on.textContent = data.online;
      if (cig) cig.textContent = data.cigarettes;
    });

    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    function send() {
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat-msg', { text });
      input.value = '';
    }

    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  }

  return { init: () => { init(); return socket; } };
})();
