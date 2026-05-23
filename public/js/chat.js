const Chat = (() => {
  let socket = null;
  let nickname = '';

  function init() {
    socket = io();

    socket.on('init', (data) => {
      nickname = data.nickname;
      const el = document.getElementById('user-nickname');
      if (el) el.textContent = nickname;
    });

    socket.on('chat-msg', (data) => {
      const I = window.Interactions || Interactions;
      if (I && I.addChatMsg) I.addChatMsg(data.nickname, data.text);
    });

    socket.on('stats', (data) => {
      const on = document.getElementById('stat-online');
      if (on) on.textContent = data.online;
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

    const checkI = setInterval(() => {
      const I = window.Interactions || Interactions;
      if (I && I._setSocket) { I._setSocket(socket); clearInterval(checkI); }
    }, 100);
  }

  return { init: () => { init(); return socket; } };
})();
