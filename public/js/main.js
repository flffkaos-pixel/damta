document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  Interactions.init(canvas);

  // Chat init returns the socket
  const socket = Chat.init();
  Interactions._setSocket(socket);

  // Interaction mode switching
  document.querySelectorAll('.interact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.interact-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Interactions.setMode(btn.dataset.mode);
    });
  });

  // Default hint
  setTimeout(() => {
    document.getElementById('interaction-hint').classList.add('hidden');
  }, 3000);

  document.body.className = 'theme-rooftop';
});
