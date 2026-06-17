// D1 chat client: HTTP polling only
const Chat = (() => {
  let nickname = '';
  const listeners = {};
  let pollingId = null;
  let mode = 'poll';
  let lastMsgTime = Date.now();
  const POLL_INTERVAL = 2500;

  const socket = {
    emit(type, data) {
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
    get connected() { return true; },
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
    status.textContent = state === 'on' ? '●' : '○';
  }

  function init() {
    nickname = genNickname();
    const nickEl = el('user-nickname');
    if (nickEl) nickEl.textContent = nickname;
    const onlineEl = el('stat-online');
    if (onlineEl) onlineEl.textContent = '1';
    if (listeners['init']) listeners['init']({ nickname });
    setupUI();
    setStatus('on', '연결 중...');
    poll();
    return socket;
  }

  function setupUI() {
    const input = el('chat-input');
    const sendBtn = el('chat-send');
    function send() {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      socket.emit('chat', { text });
      input.value = '';
    }
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
    });
  }

  function genNickname() {
    const a=['귀여운','졸린','배고픈','심심한','신비한','용감한','게으른','행복한','슬픈','촉촉한','따뜻한','시원한','달콤한','짭짤한','아기','어른','철든','졸리다','배부른','심통있는','엉뚱한','수줍은','씩씩한','명상하는','산책하는','꿈꾸는'];
    const b=['토끼','고양이','강아지','여우','판다','곰','올빼미','다람쥐','펭귄','코알라','호랑이','사자','고래','나비','별','달','구름','햇살','바람','눈꽃','파랑','노랑','연기','안개','이슬'];
    return a[Math.random()*a.length|0]+b[Math.random()*b.length|0]+(Math.random()*100|0);
  }

  function poll() {
    fetch('/api/chat?since=' + lastMsgTime)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return;
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
      })
      .catch(() => {})
      .then(() => { pollingId = setTimeout(poll, POLL_INTERVAL); });
  }

  return { init };
})();
