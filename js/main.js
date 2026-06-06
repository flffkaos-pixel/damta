document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  Interactions.init(canvas);
  window.Interactions = Interactions;

  const socket = Chat.init();
  Interactions._setSocket(socket);
});
