document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  Interactions.init(canvas);
  Chat.init();

  // Interaction mode switching
  document.querySelectorAll('.interact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.interact-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Interactions.setMode(btn.dataset.mode);
    });
  });

  // Default interaction hint auto-hide
  setTimeout(() => {
    document.getElementById('interaction-hint').classList.add('hidden');
  }, 4000);

  // Set initial theme
  document.body.className = 'theme-rooftop';
});
