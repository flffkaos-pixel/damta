document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  Interactions.init(canvas);

  const socket = Chat.init();
  Interactions._setSocket(socket);

  document.querySelectorAll('.interact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Interactions.setMode(btn.dataset.mode);
    });
  });
});
