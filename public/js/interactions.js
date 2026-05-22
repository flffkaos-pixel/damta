const Interactions = (() => {
  let canvas, ctx, W, H, dpr;
  let mode = 'cigarette';
  let particles = [];
  let activeAction = false;
  let isPressed = false;
  let pressStart = 0;
  let animId = null;

  // ── Rotation helper: cigarette tip world pos ──
  function cigTipPos(cx, cy, remaining, angle) {
    return {
      x: cx + remaining * Math.cos(angle),
      y: cy + remaining * Math.sin(angle)
    };
  }

  class Smoke {
    constructor(x, y, opts = {}) {
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * (opts.vx || 0.3);
      this.vy = -Math.random() * (opts.vy || 0.5) - 0.2;
      this.size = (Math.random() * 0.5 + 0.3) * (opts.size || 7);
      this.life = 1;
      this.decay = opts.decay || (0.005 + Math.random() * 0.01);
      this.color = opts.color || 'rgba(200,180,160,ALPHA)';
      this.gravity = opts.gravity || -0.02;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy += this.gravity;
      this.vx += (Math.random() - 0.5) * 0.02;
      this.life -= this.decay;
      this.size *= 0.998;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 1.2, 0.35);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color.replace('ALPHA', alpha);
      ctx.fill();
    }
  }

  class Ash {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 6;
      this.y = y + 2;
      this.size = 1.5 + Math.random() * 3;
      this.life = 1;
      this.vy = Math.random() * 0.8 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.friction = 0.97;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy *= this.friction; this.vx *= 0.99;
      this.life -= 0.005;
      this.y += 0.3;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(70,60,50,${this.life * 0.7})`;
      ctx.fill();
    }
  }

  class Bubble {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 8;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = -Math.random() * 1.5 - 0.5;
      this.size = 10 + Math.random() * 25;
      this.life = 1;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.015 + Math.random() * 0.03;
      this.pop = false;
    }
    update() {
      this.x += this.vx + Math.sin(this.wobble) * 0.3;
      this.y += this.vy;
      this.vy -= 0.002;
      this.wobble += this.wobbleSpeed;
      this.size *= 0.999;
      this.life -= 0.003;
      if (this.life < 0.3 && Math.random() < 0.02) this.pop = true;
    }
    draw(ctx) {
      if (this.life <= 0 || this.pop) return;
      const alpha = this.life * 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,220,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x - this.size * 0.25, this.y - this.size * 0.25, this.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.15})`;
      ctx.fill();
    }
  }

  class VapeCloud {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 6;
      this.y = y + (Math.random() - 0.5) * 3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -Math.random() * 0.6 - 0.1;
      this.size = 12 + Math.random() * 20;
      this.life = 1;
      this.decay = 0.005 + Math.random() * 0.008;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy *= 0.99;
      this.size += 0.4;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 0.5, 0.12);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,210,${alpha})`;
      ctx.fill();
    }
  }

  class Flame {
    constructor(x, y, opts = {}) {
      this.x = x; this.y = y;
      this.baseY = y;
      this.size = opts.size || 8;
      this.maxSize = this.size;
      this.life = 1;
      this.flicker = 0;
      opts.permanent ? (this.decay = 0) : (this.decay = 0.003 + Math.random() * 0.005);
      this.permanent = opts.permanent || false;
      this.color = opts.color || [255, 180, 50];
      this.wind = opts.wind || 0;
    }
    update() {
      this.flicker += 0.05 + Math.random() * 0.12;
      this.size = this.maxSize * (0.8 + Math.sin(this.flicker) * 0.2 + Math.random() * 0.05);
      this.x += Math.sin(this.flicker * 0.5) * 0.3 + this.wind;
      this.y = this.baseY - Math.abs(Math.sin(this.flicker * 0.3)) * 2;
      if (!this.permanent) this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = this.permanent ? 1 : Math.min(this.life * 2, 1);
      const [r, g, b] = this.color;
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.5);
      grd.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.12})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(this.x - this.size * 3, this.y - this.size * 3, this.size * 6, this.size * 6);
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.size * 0.4, this.size * 0.35, this.size * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.size * 0.3, this.size * 0.12, this.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,220,${alpha * 0.7})`;
      ctx.fill();
    }
  }

  class Spark {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 30;
      this.y = y - Math.random() * 15;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = -Math.random() * 3 - 0.5;
      this.size = 1 + Math.random() * 2.5;
      this.life = 1;
      this.decay = 0.008 + Math.random() * 0.015;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy -= 0.02;
      this.vx *= 0.98;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,80,${this.life})`;
      ctx.fill();
    }
  }

  let cig = { burn: 0, maxBurn: 100, ash: 0, maxAsh: 40, lit: false, done: false };
  let match = { burning: false, burn: 0, maxBurn: 60, done: false };
  let candle = { lit: false, melt: 0, height: 80 };
  let candleFlame = null;
  let campfire = { lit: false, flames: [], sparks: [] };
  let vapePuffing = false;

  function resetState() {
    cig = { burn: 0, maxBurn: 100, ash: 0, maxAsh: 40, lit: false, done: false };
    match = { burning: false, burn: 0, maxBurn: 60, done: false };
    candle = { lit: false, melt: 0, height: 80 };
    candleFlame = null;
    particles = [];
  }

  function init(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    setupEvents();
    animate();
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
  }

  function setMode(newMode) {
    mode = newMode;
    resetState();
    const hints = {
      cigarette: '👆 꾹 누르면 불 붙이기 · 톡톡 재 털기',
      bubble: '👆 꾹 누르고 드래그',
      vape: '👆 꾹 누르기',
      match: '👆 클릭',
      candle: '👆 클릭 켜기/끄기',
      campfire: '👆 클릭',
    };
    const el = document.getElementById('hint-text');
    if (el) { el.textContent = hints[newMode] || '👆'; el.parentElement.classList.remove('hidden'); }
    setTimeout(() => { const e2 = document.getElementById('hint-text'); if (e2) e2.parentElement.classList.add('hidden'); }, 3000);
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function setupEvents() {
    function onDown(e) {
      e.preventDefault();
      const pos = getPos(e);
      isPressed = true;
      pressStart = Date.now();
      if (mode === 'match') handleMatch();
      else if (mode === 'candle') handleCandle();
      else if (mode === 'campfire') handleCampfire();
      else if (mode === 'vape') { vapePuffing = true; spawnVape(pos); }
      else if (mode === 'cigarette') { if (!cig.lit && !cig.done) { cig.lit = true; } }
    }
    function onMove(e) {
      e.preventDefault();
      const pos = getPos(e);
      if (isPressed && mode === 'bubble') {
        for (let i = 0; i < 3; i++) particles.push(new Bubble(pos.x, pos.y));
      }
      if (isPressed && mode === 'vape' && Math.random() < 0.4) spawnVape(pos);
    }
    function onUp(e) {
      e.preventDefault();
      isPressed = false;
      if (mode === 'cigarette' && cig.lit) {
        if ((Date.now() - pressStart) < 300) {
          const angle = -Math.PI / 6;
          const remaining = cig.maxBurn * (1 - cig.burn / cig.maxBurn);
          const cx = W / 2, cy = H * 0.55;
          const tip = cigTipPos(cx, cy, remaining, angle);
          for (let i = 0; i < 8; i++) particles.push(new Ash(tip.x, tip.y));
          cig.ash = 0;
        }
      }
      if (mode === 'vape') vapePuffing = false;
    }
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });
  }

  function handleMatch() {
    if (match.done) return;
    match.burning = true;
  }

  function handleCandle() {
    candle.lit = !candle.lit;
    const cx = W / 2, cy2 = H * 0.65, candleH = candle.height;
    if (candle.lit) {
      candleFlame = new Flame(cx, cy2 - candleH - 5 - candle.melt, { size: 14, permanent: true, color: [255, 200, 80] });
    } else {
      candleFlame = null;
    }
  }

  function handleCampfire() {
    campfire.lit = !campfire.lit;
    if (campfire.lit) {
      const cx = W / 2, cy = H * 0.65;
      campfire.flames = [];
      campfire.sparks = [];
      for (let i = 0; i < 7; i++) {
        campfire.flames.push(new Flame(
          cx + (Math.random() - 0.5) * 40,
          cy - 15 - Math.random() * 20,
          { size: 18 + Math.random() * 25, permanent: true, color: [255, 150 + Math.random() * 80, 20 + Math.random() * 50] }
        ));
      }
    } else {
      campfire.flames = [];
      campfire.sparks = [];
    }
  }

  function spawnVape(pos) {
    for (let i = 0; i < 2; i++) particles.push(new VapeCloud(pos.x, pos.y));
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    switch (mode) {
      case 'cigarette': updateCigarette(); break;
      case 'bubble': updateBubble(); break;
      case 'vape': updateVape(); break;
      case 'match': updateMatch(); break;
      case 'candle': updateCandle(); break;
      case 'campfire': updateCampfire(); break;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw(ctx);
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    animId = requestAnimationFrame(animate);
  }

  function drawBackground() {
    const room = document.querySelector('.room-btn.active');
    const roomId = room ? room.dataset.room : 'rooftop';
    if (roomId === 'rooftop') {
      ctx.fillStyle = 'rgba(255,200,100,0.02)';
      for (let i = 0; i < 20; i++) {
        const bx = (i / 20) * W, bh = 20 + Math.sin(i * 2) * 15;
        ctx.fillRect(bx, H - 40 - bh, W / 22, bh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 60; i++) {
        const sx = ((42 * (i + 1) * 7) % 100) / 100 * W;
        const sy = ((42 * (i + 1) * 13) % 60) / 100 * H * 0.5;
        const ss = 0.5 + ((42 * (i + 1) * 3) % 3);
        ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (roomId === 'cafe') {
      const grd = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, W * 0.4);
      grd.addColorStop(0, 'rgba(255,200,150,0.04)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
    if (roomId === 'park') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < 6; i++) {
        const tx = (i / 6) * W + 15;
        ctx.beginPath(); ctx.arc(tx, H - 30, 25 + (i % 3) * 10, Math.PI, 0); ctx.fill();
      }
    }
    if (roomId === 'beach') {
      const grd = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grd.addColorStop(0, 'rgba(100,150,255,0.02)'); grd.addColorStop(1, 'rgba(100,150,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, H * 0.5, W, H * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.arc(W * 0.7, H * 0.15, 30, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ══════════════════════ CIGARETTE ══════════════════════
  function updateCigarette() {
    const cx = W / 2, cy = H * 0.55;
    const cigLen = 100, cigW = 14;
    const angle = -Math.PI / 6;

    if (cig.lit && !cig.done) {
      cig.burn += 0.04 + (isPressed ? 0.06 : 0);
      cig.ash += 0.02 + (isPressed ? 0.03 : 0);
      if (cig.burn >= cig.maxBurn) { cig.done = true; cig.lit = false; }
      if (cig.ash >= cig.maxAsh) {
        const r = cig.maxBurn * (1 - cig.burn / cig.maxBurn);
        const t = cigTipPos(cx, cy, r, angle);
        for (let i = 0; i < 6; i++) particles.push(new Ash(t.x, t.y));
        cig.ash = 0;
      }
      const remaining = cig.maxBurn * (1 - cig.burn / cig.maxBurn);
      const tip = cigTipPos(cx, cy, remaining, angle);
      if (Math.random() < 0.35) {
        particles.push(new Smoke(tip.x + (Math.random() - 0.5) * 4, tip.y, { vy: 0.7, size: 5 }));
      }
    }

    const burnRatio = cig.done ? 1 : (cig.burn / cig.maxBurn);
    const remaining = cigLen * (1 - burnRatio);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    if (remaining > 0) {
      ctx.fillStyle = '#c8a060';
      ctx.roundRect(0, -cigW / 2, 22, cigW, 2);
      ctx.fill();

      ctx.fillStyle = '#f0ece0';
      ctx.roundRect(22, -cigW / 2, remaining - 22, cigW, 1);
      ctx.fill();

      if (cig.ash > 3) {
        const ashH = Math.min(cig.ash / cig.maxAsh * cigW * 0.6, cigW * 0.5);
        ctx.fillStyle = 'rgba(120,100,80,0.7)';
        ctx.roundRect(remaining - 4, -cigW / 2 - ashH * 0.3, 8 + (cig.ash / cig.maxAsh) * 6, cigW + ashH * 0.6, 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(180,160,140,0.25)';
      ctx.lineWidth = 0.5;
      for (let l = 30; l < remaining; l += 2) {
        ctx.beginPath(); ctx.moveTo(l, -cigW / 2 + 1); ctx.lineTo(l, cigW / 2 - 1); ctx.stroke();
      }
    }

    if (cig.lit && !cig.done) {
      const tipX = remaining;
      const grd = ctx.createRadialGradient(tipX, 0, 0, tipX, 0, 10);
      grd.addColorStop(0, 'rgba(255,200,100,0.8)');
      grd.addColorStop(0.4, 'rgba(255,100,30,0.5)');
      grd.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(tipX, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tipX, 0, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,200,100,0.9)'; ctx.fill();
    }

    if (cig.done) {
      ctx.fillStyle = '#605040';
      ctx.roundRect(0, -cigW / 2, 18, cigW, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '13px sans-serif';
      ctx.fillText('🔥 다 폈어요!', remaining - 60, -25);
    }

    ctx.restore();
  }

  // ══════════════════════ BUBBLE ══════════════════════
  function updateBubble() {
    if (isPressed) {
      const pos = { x: W / 2 + (Math.random() - 0.5) * 8, y: H * 0.6 };
      for (let i = 0; i < 4; i++) particles.push(new Bubble(pos.x, pos.y));
    }
    // Draw bubble wand
    const cx = W / 2, cy = H * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#8a7a6a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -15); ctx.stroke();
    ctx.strokeStyle = '#a09080';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -20, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ══════════════════════ VAPE ══════════════════════
  function updateVape() {
    const cx = W / 2, cy = H * 0.55;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#22222e';
    ctx.roundRect(-14, -32, 28, 64, 6); ctx.fill();
    ctx.fillStyle = '#2a2a38';
    ctx.roundRect(-12, -30, 24, 58, 5); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = vapePuffing ? '#00ff88' : '#ff3366'; ctx.fill();
    if (vapePuffing) {
      ctx.beginPath(); ctx.arc(0, -20, 10, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(0, -20, 0, 0, -20, 10);
      g.addColorStop(0, 'rgba(0,255,136,0.15)'); g.addColorStop(1, 'rgba(0,255,136,0)');
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.fillStyle = '#3a3a48';
    ctx.roundRect(-7, -44, 14, 12, 3); ctx.fill();
    ctx.fillStyle = '#4a4a58';
    ctx.roundRect(-5, -46, 10, 4, 2); ctx.fill();
    ctx.restore();
    if (vapePuffing && Math.random() < 0.4) {
      particles.push(new VapeCloud(cx + (Math.random() - 0.5) * 4, cy - 48));
    }
  }

  // ══════════════════════ MATCH ══════════════════════
  function updateMatch() {
    const cx = W / 2, cy = H * 0.65;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);

    const stickLen = 80;
    const headX = stickLen;

    // Stick body
    ctx.fillStyle = '#d4b080';
    ctx.roundRect(0, -2.5, stickLen, 5, 1); ctx.fill();

    // Draw wood grain
    ctx.strokeStyle = 'rgba(180,140,100,0.3)';
    ctx.lineWidth = 0.5;
    for (let g = 5; g < stickLen; g += 8) {
      ctx.beginPath(); ctx.moveTo(g, -2); ctx.lineTo(g + 3, 2); ctx.stroke();
    }

    // Match head
    if (!match.burning && !match.done) {
      ctx.beginPath(); ctx.arc(headX, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#cc5533'; ctx.fill();
      ctx.beginPath(); ctx.arc(headX, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,80,40,0.15)'; ctx.fill();
    }

    if (match.burning && !match.done) {
      match.burn += 0.02;
      if (match.burn >= match.maxBurn) { match.done = true; match.burning = false; }

      // Flame at head
      const burnRatio = match.burn / match.maxBurn;
      const flSize = 10 - burnRatio * 5;
      const flameY = -5 - burnRatio * 10;
      const flame = new Flame(headX, flameY, { size: Math.max(flSize, 3), color: [255, 180 - burnRatio * 80, 50 - burnRatio * 30] });
      flame.update(); flame.draw(ctx);

      // Smoke
      if (Math.random() < 0.25) {
        particles.push(new Smoke(headX, flameY - 8, { vy: 0.6, size: 2.5, color: 'rgba(255,200,150,ALPHA)' }));
      }

      // Burned part of stick
      const burned = (match.burn / match.maxBurn) * 40;
      if (burned > 3) {
        const grd = ctx.createLinearGradient(headX - burned, 0, headX, 0);
        grd.addColorStop(0, '#3a2510'); grd.addColorStop(1, '#5a3520');
        ctx.fillStyle = grd;
        ctx.roundRect(headX - burned, -2.5, burned, 5, 1); ctx.fill();
      }

      // Ember glow track
      if (burned > 3) {
        ctx.beginPath(); ctx.arc(headX - burned + 1, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,100,30,0.6)'; ctx.fill();
      }
    }

    if (match.done) {
      ctx.fillStyle = '#3a2510';
      ctx.roundRect(headX - 40, -2.5, 40, 5, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px sans-serif';
      ctx.fillText('🔥 다 탔어요!', headX - 65, -20);
    }

    ctx.restore();
  }

  // ══════════════════════ CANDLE ══════════════════════
  function updateCandle() {
    const cx = W / 2, cy = H * 0.65;
    const candleW = 24;
    let candleH = candle.height - candle.melt;
    if (candleH < 10) { candleH = 10; candle.lit = false; candleFlame = null; }

    ctx.save(); ctx.translate(cx, cy);

    // Candle body
    const grd = ctx.createLinearGradient(-candleW / 2, 0, candleW / 2, 0);
    grd.addColorStop(0, '#d8ccb8');
    grd.addColorStop(0.5, '#ece4d4');
    grd.addColorStop(1, '#d0c4b0');
    ctx.fillStyle = grd;
    ctx.roundRect(-candleW / 2, -candleH, candleW, candleH, 4); ctx.fill();

    // Melted wax drip
    if (candle.melt > 0) {
      ctx.fillStyle = 'rgba(200,185,165,0.4)';
      ctx.roundRect(-candleW / 2, -candleH, candleW, Math.min(candle.melt, 15), 3); ctx.fill();
      for (let d = 0; d < 3; d++) {
        const dx = -candleW / 2 + 4 + d * 8;
        ctx.fillRect(dx, -candleH, 3, 5 + Math.random() * 5);
      }
    }

    // Wick
    ctx.strokeStyle = '#302018';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -candleH);
    ctx.quadraticCurveTo(2 + Math.sin(Date.now() * 0.003) * 1.5, -candleH - 8, 1, -candleH - 6);
    ctx.stroke();

    ctx.restore();

    if (candle.lit && candleFlame) {
      // Update flame position to follow candle top
      const cx2 = cx + Math.sin(Date.now() * 0.003) * 1;
      const cy2 = cy - candleH - 8;
      candleFlame.x = cx2;
      candleFlame.y = cy2;
      candleFlame.baseY = cy2;
      candleFlame.update();
      candleFlame.draw(ctx);

      if (Math.random() < 0.02) {
        candle.melt += 0.03;
      }

      if (Math.random() < 0.12) {
        particles.push(new Smoke(cx2, cy2 - 15, { vy: 0.4, size: 2, color: 'rgba(200,180,160,ALPHA)' }));
      }
    }
  }

  // ══════════════════════ CAMPFIRE ══════════════════════
  function updateCampfire() {
    const cx = W / 2, cy = H * 0.65;

    // Draw logs (detailed)
    ctx.save(); ctx.translate(cx, cy);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 12, 60, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Back log
    ctx.fillStyle = '#3a2510';
    ctx.roundRect(-42, -18, 84, 12, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,20,0.3)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) {
      const rx = -35 + r * 18;
      ctx.beginPath(); ctx.arc(rx, -6, 3, 0, Math.PI); ctx.stroke();
    }

    // Log 2 (angled)
    ctx.save(); ctx.rotate(0.15);
    ctx.fillStyle = '#4a3020';
    ctx.roundRect(-38, -12, 76, 10, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,25,0.3)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 4; r++) {
      const rx = -30 + r * 20;
      ctx.beginPath(); ctx.arc(rx, -3, 2.5, 0, Math.PI); ctx.stroke();
    }
    ctx.restore();

    // Log 3
    ctx.save(); ctx.rotate(-0.12);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-40, -10, 80, 9, 3); ctx.fill();
    ctx.restore();

    // Front logs (smaller, crossed)
    ctx.save(); ctx.rotate(0.3);
    ctx.fillStyle = '#4a3520';
    ctx.roundRect(-25, -6, 50, 7, 2); ctx.fill();
    ctx.restore();

    ctx.save(); ctx.rotate(-0.25);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-28, -5, 56, 7, 2); ctx.fill();
    ctx.restore();

    // Ember base
    ctx.beginPath(); ctx.arc(0, -5, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,80,20,0.05)'; ctx.fill();

    ctx.restore();

    if (campfire.lit) {
      for (let i = campfire.flames.length - 1; i >= 0; i--) {
        const f = campfire.flames[i];
        f.update(); f.draw(ctx);
        // Gradually reduce size
        f.maxSize *= 0.9995;
      }

      if (Math.random() < 0.35) {
        for (let i = 0; i < 3; i++) {
          particles.push(new Spark(cx, cy - 5));
        }
      }

      if (Math.random() < 0.25) {
        particles.push(new Smoke(
          cx + (Math.random() - 0.5) * 40,
          cy - 35,
          { vy: 0.7, size: 10 + Math.random() * 8, color: 'rgba(180,160,140,ALPHA)' }
        ));
      }
    }
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      const [tl, tr, br, bl] = r.map(v => Math.min(v || 0, Math.min(w, h) / 2));
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + tr);
      this.lineTo(x + w, y + h - br);
      this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
      this.lineTo(x + bl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - bl);
      this.lineTo(x, y + tl);
      this.quadraticCurveTo(x, y, x + tl, y);
      this.closePath();
      return this;
    };
  }

  return { init, setMode };
})();
