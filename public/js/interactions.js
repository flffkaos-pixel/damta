const Interactions = (() => {
  let canvas, ctx, W, H, dpr;
  let mode = 'cigarette';
  let particles = [];
  let chatMessages = [];
  let isPressed = false;
  let pressStart = 0;
  let animId = null;
  let socket = null;

  let sessionActive = false;
  let sessionTime = 0;
  let sessionDuration = 300 + Math.floor(Math.random() * 120);

  let cig = { burn: 0, maxBurn: 100, ash: 0, maxAsh: 50, lit: false, done: false, totalSmoked: 0 };
  let match = { burning: false, burn: 0, maxBurn: 100, done: false };
  let candle = { lit: false, melt: 0, height: 80 };
  let candleFlame = null;
  let campfire = { lit: false, flames: [], sparksTimer: 0 };
  let vapePuffing = false;
  let vapeLiquid = 100;

  let baseScale = 1;

  function calcScale() { baseScale = Math.min(W, H) / 320; }

  class Smoke {
    constructor(x, y, opts = {}) {
      const s = baseScale;
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * (opts.vx || 0.3) * s;
      this.vy = (-Math.random() * (opts.vy || 0.4) - 0.1) * s;
      this.size = (Math.random() * 0.5 + 0.8) * (opts.size || 12) * s;
      this.life = 1;
      this.decay = opts.decay || (0.003 + Math.random() * 0.006);
      this.color = opts.color || 'rgba(200,185,165,ALPHA)';
      this.gravity = (opts.gravity || -0.01) * s;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy += this.gravity;
      this.vx += (Math.random() - 0.5) * 0.01;
      this.life -= this.decay;
      this.size *= 0.998;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 0.5, 0.15);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color.replace('ALPHA', alpha);
      ctx.fill();
    }
  }

  class Ash {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 6 * s;
      this.y = y;
      this.size = (1.5 + Math.random() * 3) * s;
      this.life = 1;
      this.vy = (Math.random() * 0.8 + 0.3) * s;
      this.vx = (Math.random() - 0.5) * 0.5 * s;
      this.friction = 0.97;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy *= this.friction; this.vx *= 0.99;
      this.life -= 0.006;
      this.y += 0.4 * baseScale;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(70,58,45,${this.life * 0.65})`;
      ctx.fill();
    }
  }

  class Bubble {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 6 * s;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.5 * s;
      this.vy = (-Math.random() * 1.2 - 0.3) * s;
      this.size = (10 + Math.random() * 22) * s;
      this.life = 1;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.015 + Math.random() * 0.025;
      this.pop = false;
    }
    update() {
      this.x += this.vx + Math.sin(this.wobble) * 0.3 * baseScale;
      this.y += this.vy;
      this.vy -= 0.002 * baseScale;
      this.wobble += this.wobbleSpeed;
      this.size *= 0.999;
      this.life -= 0.003;
      if (this.life < 0.25 && Math.random() < 0.015) this.pop = true;
    }
    draw(ctx) {
      if (this.life <= 0 || this.pop) return;
      const alpha = this.life * 0.45;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,220,255,${alpha})`;
      ctx.lineWidth = 1.5 * baseScale;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x - this.size * 0.25, this.y - this.size * 0.25, this.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
      ctx.fill();
    }
  }

  class VapeCloud {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 5 * s;
      this.y = y + (Math.random() - 0.5) * 3 * s;
      this.vx = (Math.random() - 0.5) * 0.25 * s;
      this.vy = (-Math.random() * 0.5 - 0.1) * s;
      this.size = (10 + Math.random() * 18) * s;
      this.life = 1;
      this.decay = 0.005 + Math.random() * 0.008;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy *= 0.99;
      this.size += 0.35 * baseScale;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 0.4, 0.1);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,210,${alpha})`;
      ctx.fill();
    }
  }

  class Flame {
    constructor(x, y, opts = {}) {
      const s = baseScale;
      this.x = x; this.y = y;
      this.baseY = y;
      this.size = (opts.size || 8) * s;
      this.maxSize = this.size;
      this.life = 1;
      this.flicker = Math.random() * 100;
      this.permanent = opts.permanent || false;
      this.decay = opts.permanent ? 0 : (0.003 + Math.random() * 0.005);
      this.color = opts.color || [255, 180, 50];
      this.wind = opts.wind || 0;
    }
    update() {
      this.flicker += 0.05 + Math.random() * 0.12;
      this.size = this.maxSize * (0.78 + Math.sin(this.flicker) * 0.22 + Math.random() * 0.04);
      this.x += Math.sin(this.flicker * 0.5) * 0.3 * baseScale + this.wind;
      this.y = this.baseY - Math.abs(Math.sin(this.flicker * 0.3)) * 2 * baseScale;
      if (!this.permanent) this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = this.permanent ? 1 : Math.min(this.life * 2, 1);
      const [r, g, b] = this.color;
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.5);
      grd.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.1})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(this.x - this.size * 3, this.y - this.size * 3, this.size * 6, this.size * 6);
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.size * 0.35, this.size * 0.32, this.size * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.size * 0.25, this.size * 0.1, this.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,220,${alpha * 0.65})`;
      ctx.fill();
    }
  }

  class Spark {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 30 * s;
      this.y = y - Math.random() * 15 * s;
      this.vx = (Math.random() - 0.5) * 1.8 * s;
      this.vy = (-Math.random() * 2.5 - 0.5) * s;
      this.size = (1 + Math.random() * 2.5) * s;
      this.life = 1;
      this.decay = 0.008 + Math.random() * 0.015;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy -= 0.015 * baseScale;
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

  class ChatMsg {
    constructor(nickname, text) {
      this.nickname = nickname;
      this.text = text;
      this.life = 1;
      this.decay = 0.004 + Math.random() * 0.003;
      this.x = 20 + Math.random() * (W - 60);
      this.y = H * 0.3 + Math.random() * H * 0.2;
      this.vy = (-0.15 - Math.random() * 0.2) * baseScale;
      this.vx = (Math.random() - 0.5) * 0.1 * baseScale;
      this.alpha = 0.8;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy *= 0.995;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 2, 0.8);
      const s = baseScale;
      ctx.font = `bold ${13 * s}px -apple-system, sans-serif`;
      const text = `${this.nickname}: ${this.text}`;
      const m = ctx.measureText(text);
      const tw = Math.min(m.width, W * 0.7);
      const tx = Math.max(10, Math.min(this.x, W - tw - 10));
      ctx.fillStyle = `rgba(240,160,80,${alpha * 0.8})`;
      ctx.fillText(this.nickname, tx, this.y);
      const nw = ctx.measureText(this.nickname + ': ').width;
      ctx.fillStyle = `rgba(200,185,165,${alpha * 0.7})`;
      ctx.fillText(': ' + this.text, tx + ctx.measureText(this.nickname).width, this.y);
    }
  }

  function resetState() {
    cig = { burn: 0, maxBurn: 100, ash: 0, maxAsh: 50, lit: false, done: false, totalSmoked: cig.totalSmoked || 0 };
    match = { burning: false, burn: 0, maxBurn: 100, done: false };
    candle = { lit: false, melt: 0, height: 80 };
    candleFlame = null;
    campfire = { lit: false, flames: [], sparksTimer: 0 };
    vapePuffing = false;
    vapeLiquid = 100;
    particles = [];
    sessionActive = false;
    sessionTime = 0;
    document.getElementById('restart-btn').classList.add('hidden');
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
    calcScale();
  }

  function setMode(newMode) {
    mode = newMode;
    resetState();
    document.querySelectorAll('.interact-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.interact-btn[data-mode="${newMode}"]`);
    if (btn) btn.classList.add('active');
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startSession() {
    if (sessionActive) return;
    sessionActive = true;
    sessionTime = 0;
    sessionDuration = 300 + Math.floor(Math.random() * 120);
  }

  function endSession() {
    sessionActive = false;
    if (mode === 'cigarette' && cig.totalSmoked > 0) {
      socket.emit('cigarette-done');
    }
    document.getElementById('restart-btn').classList.remove('hidden');
  }

  document.getElementById('restart-btn').addEventListener('click', () => {
    resetState();
    if (mode === 'cigarette') {
      cig.totalSmoked = (cig.totalSmoked || 0) + 1;
    }
  });

  function setupEvents() {
    function onDown(e) {
      e.preventDefault();
      isPressed = true;
      pressStart = Date.now();
      if (mode === 'cigarette' && !cig.done) {
        if (!cig.lit) { cig.lit = true; startSession(); }
      } else if (mode === 'match') {
        if (!match.done && !match.burning) { match.burning = true; startSession(); }
      } else if (mode === 'candle') {
        handleCandle();
        if (candle.lit) startSession();
      } else if (mode === 'campfire') {
        handleCampfire();
        if (campfire.lit) startSession();
      } else if (mode === 'vape') {
        vapePuffing = true;
        if (!sessionActive) startSession();
      } else if (mode === 'bubble') {
        if (!sessionActive) startSession();
      }
    }
    function onMove(e) {
      e.preventDefault();
    }
    function onUp(e) {
      e.preventDefault();
      const t = Date.now();
      if (mode === 'cigarette' && cig.lit && !cig.done && (t - pressStart) < 300) {
        const angle = -Math.PI / 6;
        const visRemaining = cigLen * (1 - cig.burn / cig.maxBurn);
        const cx = W / 2, cy = H * 0.5;
        const tip = rot(cx, cy, visRemaining, 0, angle);
        for (let i = 0; i < 8; i++) particles.push(new Ash(tip.x, tip.y));
        cig.ash = 0;
      }
      if (mode === 'vape') vapePuffing = false;
      isPressed = false;
    }
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });
  }

  function rot(cx, cy, dx, dy, angle) {
    return {
      x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
    };
  }

  function handleCandle() {
    candle.lit = !candle.lit;
    const cx = W / 2, cy2 = H * 0.62, ch = Math.max(candle.height - candle.melt, 10);
    if (candle.lit) {
      candleFlame = new Flame(cx, cy2 - ch - 6, { size: 14, permanent: true, color: [255, 200, 80] });
    } else {
      candleFlame = null;
    }
  }

  function handleCampfire() {
    campfire.lit = !campfire.lit;
    if (campfire.lit) {
      const cx = W / 2, cy = H * 0.62;
      campfire.flames = [];
      for (let i = 0; i < 7; i++) {
        campfire.flames.push(new Flame(
          cx + (Math.random() - 0.5) * 45 * baseScale,
          cy - 15 * baseScale - Math.random() * 25 * baseScale,
          { size: 18 + Math.random() * 28, permanent: true, color: [255, 150 + Math.random() * 80, 20 + Math.random() * 50] }
        ));
      }
    } else {
      campfire.flames = [];
    }
  }

  let cigLen; // used in onUp

  function animate() {
    ctx.clearRect(0, 0, W, H);

    if (sessionActive) {
      sessionTime += 1 / 60;
      const m = Math.floor(sessionTime / 60);
      const sec = Math.floor(sessionTime % 60);
      document.getElementById('timer-display').textContent = `⏱️ ${m}:${sec.toString().padStart(2, '0')}`;
      if (sessionTime >= sessionDuration) {
        if (mode === 'cigarette') { cig.lit = false; cig.done = true; }
        if (mode === 'match') { match.burning = false; match.done = true; }
        if (mode === 'candle') { candle.lit = false; candleFlame = null; }
        if (mode === 'campfire') { campfire.lit = false; campfire.flames = []; }
        if (mode === 'vape') vapePuffing = false;
        endSession();
      }
    }

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
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      chatMessages[i].update();
      chatMessages[i].draw(ctx);
      if (chatMessages[i].life <= 0) chatMessages.splice(i, 1);
    }
    animId = requestAnimationFrame(animate);
  }

  function drawBackground() {
    ctx.fillStyle = 'rgba(255,200,100,0.025)';
    for (let i = 0; i < 15; i++) {
      const bx = (i / 15) * W, bh = (15 + Math.sin(i * 2.3) * 10) * baseScale;
      ctx.fillRect(bx, H - 35 * baseScale - bh, W / 18, bh);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 40; i++) {
      const sx = ((42 * (i + 1) * 7) % 100) / 100 * W;
      const sy = ((42 * (i + 1) * 13) % 60) / 100 * H * 0.5;
      const ss = (0.5 + ((42 * (i + 1) * 3) % 3)) * baseScale;
      ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ═════════════ CIGARETTE ═════════════
  function updateCigarette() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5;
    cigLen = 120 * s; const cigW = 16 * s;
    const angle = -Math.PI / 6;

    if (cig.lit && !cig.done) {
      cig.burn += 0.004 + (isPressed ? 0.001 : 0);
      cig.ash += 0.003 + (isPressed ? 0.001 : 0);
      if (cig.burn >= cig.maxBurn) { cig.done = true; cig.lit = false; cig.totalSmoked = (cig.totalSmoked || 0) + 1; endSession(); }
      if (cig.ash >= cig.maxAsh) {
        const visRemaining = cigLen * (1 - cig.burn / cig.maxBurn);
        const t = rot(cx, cy, visRemaining, 0, angle);
        for (let i = 0; i < 5; i++) particles.push(new Ash(t.x, t.y));
        cig.ash = 0;
      }
      const visRemaining = cigLen * (1 - cig.burn / cig.maxBurn);
      const tip = rot(cx, cy, visRemaining, 0, angle);
      // Less smoke, bigger particles (like vape)
      if (Math.random() < 0.08) {
        particles.push(new VapeCloud(tip.x, tip.y));
      }
    }

    const burnRatio = cig.done ? 1 : (cig.burn / cig.maxBurn);
    const remaining = cigLen * (1 - burnRatio);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    if (remaining > 0) {
      // Filter — brown
      const grdF = ctx.createLinearGradient(0, -cigW / 2, 0, cigW / 2);
      grdF.addColorStop(0, '#6b4423'); grdF.addColorStop(0.5, '#5a3a1e'); grdF.addColorStop(1, '#4a3018');
      ctx.fillStyle = grdF;
      ctx.roundRect(0, -cigW / 2, 24 * s, cigW, 3 * s); ctx.fill();
      // Paper
      const grdP = ctx.createLinearGradient(0, -cigW / 2, 0, cigW / 2);
      grdP.addColorStop(0, '#f2ece0'); grdP.addColorStop(0.5, '#faf6ee'); grdP.addColorStop(1, '#e8e0d0');
      ctx.fillStyle = grdP;
      ctx.roundRect(24 * s, -cigW / 2, remaining - 24 * s, cigW, 1); ctx.fill();
      // Ash
      if (cig.ash > 3) {
        const ashH = Math.min(cig.ash / cig.maxAsh * cigW * 0.5, cigW * 0.4);
        ctx.fillStyle = 'rgba(100,85,70,0.6)';
        ctx.roundRect(remaining - 3 * s, -cigW / 2 - ashH * 0.3, 6 * s + (cig.ash / cig.maxAsh) * 4 * s, cigW + ashH * 0.6, 2 * s);
        ctx.fill();
      }
    }

    // Burning tip glow — vertical ellipse (90° rotated)
    if (cig.lit && !cig.done) {
      const tipX = remaining;
      const grd = ctx.createRadialGradient(tipX, 0, 0, tipX, 0, 10 * s);
      grd.addColorStop(0, 'rgba(255,200,80,0.7)');
      grd.addColorStop(0.3, 'rgba(255,120,30,0.5)');
      grd.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.ellipse(tipX, 0, 4 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(tipX, 0, 2 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,200,100,0.9)'; ctx.fill();
    }

    if (cig.done) {
      ctx.fillStyle = '#605040';
      ctx.roundRect(0, -cigW / 2, 20 * s, cigW, 2 * s); ctx.fill();
    }

    ctx.restore();
  }

  // ═════════════ BUBBLE ═════════════
  function updateBubble() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5;
    const wandX = cx, wandY = cy - 20 * s;
    if (isPressed) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push(new Bubble(wandX + Math.cos(a) * 8 * s, wandY + Math.sin(a) * 8 * s));
      }
    }
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, 20 * s); ctx.lineTo(0, -15 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,200,230,0.4)'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(0, -20 * s, 14 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,255,0.15)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(0, -20 * s, 11 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ═════════════ VAPE ═════════════
  function updateVape() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#1a1a24';
    ctx.roundRect(-16 * s, -5 * s, 32 * s, 70 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#22222e';
    ctx.roundRect(-14 * s, -3 * s, 28 * s, 64 * s, 5 * s); ctx.fill();
    const liquidH = (vapeLiquid / 100) * 35 * s;
    const grdL = ctx.createLinearGradient(0, 55 * s - liquidH, 0, 55 * s);
    grdL.addColorStop(0, 'rgba(0,200,255,0)');
    grdL.addColorStop(1, 'rgba(0,200,255,0.2)');
    ctx.fillStyle = grdL;
    ctx.roundRect(-10 * s, 55 * s - liquidH, 20 * s, liquidH, 3 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 10 * s, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = vapePuffing ? '#ff2200' : '#880022'; ctx.fill();
    if (vapePuffing) {
      ctx.beginPath(); ctx.arc(0, 10 * s, 14 * s, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(0, 10 * s, 0, 0, 10 * s, 14 * s);
      g.addColorStop(0, 'rgba(255,30,0,0.3)'); g.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 10 * s, 5 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3300'; ctx.fill();
    }
    ctx.fillStyle = '#3a3a48';
    ctx.roundRect(-8 * s, -18 * s, 16 * s, 14 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#4a4a58';
    ctx.roundRect(-6 * s, -22 * s, 12 * s, 6 * s, 2 * s); ctx.fill();
    ctx.restore();

    if (vapePuffing) {
      vapeLiquid = Math.max(0, vapeLiquid - 0.02);
      if (Math.random() < 0.35) {
        particles.push(new VapeCloud(cx + (Math.random() - 0.5) * 3 * s, cy - 24 * s));
      }
    }
  }

  // ═════════════ MATCH ═════════════
  function updateMatch() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    const stickLen = 80 * s;
    const headX = stickLen;

    ctx.fillStyle = '#d4b080';
    ctx.roundRect(0, -2.5 * s, stickLen, 5 * s, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,100,0.2)';
    ctx.lineWidth = 0.5;
    for (let g = 5 * s; g < stickLen; g += 8 * s) {
      ctx.beginPath(); ctx.moveTo(g, -2 * s); ctx.lineTo(g + 3 * s, 2 * s); ctx.stroke();
    }

    if (!match.burning && !match.done) {
      ctx.beginPath(); ctx.arc(headX, 0, 7 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#cc5533'; ctx.fill();
      ctx.beginPath(); ctx.arc(headX, 0, 9 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,80,40,0.12)'; ctx.fill();
    }

    if (match.burning && !match.done) {
      match.burn += 0.03;
      if (match.burn >= match.maxBurn) { match.done = true; match.burning = false; endSession(); }
      const burnRatio = match.burn / match.maxBurn;
      const burnedLen = burnRatio * 45 * s;
      const flameX = headX - burnedLen;
      const flSize = (10 - burnRatio * 5) * s;
      const flame = new Flame(flameX, -8 * s, { size: Math.max(flSize, 2 * s), color: [255, 180 - burnRatio * 80, 50 - burnRatio * 30] });
      flame.update(); flame.draw(ctx);
      // Ember glow — vertical ellipse
      ctx.beginPath(); ctx.ellipse(flameX, 0, 2 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,100,30,0.5)'; ctx.fill();
      // Ash fall — in world coordinates
      if (Math.random() < 0.08) {
        const wp = rot(cx, cy, flameX, 2 * s, Math.PI / 4);
        particles.push(new Ash(wp.x, wp.y));
      }
      if (Math.random() < 0.2) {
        const wp = rot(cx, cy, flameX, -12 * s, Math.PI / 4);
        particles.push(new Smoke(wp.x, wp.y, { vy: 0.5, size: 2.5 * s, color: 'rgba(255,200,150,ALPHA)' }));
      }
      if (burnedLen > 3 * s) {
        const grd = ctx.createLinearGradient(headX - burnedLen, 0, headX, 0);
        grd.addColorStop(0, '#3a2510'); grd.addColorStop(1, '#5a3520');
        ctx.fillStyle = grd;
        ctx.roundRect(headX - burnedLen, -2.5 * s, burnedLen, 5 * s, 1); ctx.fill();
      }
    }

    if (match.done) {
      ctx.fillStyle = '#3a2510';
      ctx.roundRect(headX - 40 * s, -2.5 * s, 40 * s, 5 * s, 1); ctx.fill();
    }
    ctx.restore();
  }

  // ═════════════ CANDLE ═════════════
  function updateCandle() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.6;
    const candleW = 24 * s;
    let candleH = Math.max(candle.height - candle.melt, 10) * s;

    ctx.save(); ctx.translate(cx, cy);
    const grd = ctx.createLinearGradient(-candleW / 2, 0, candleW / 2, 0);
    grd.addColorStop(0, '#d8ccb8'); grd.addColorStop(0.5, '#ece4d4'); grd.addColorStop(1, '#d0c4b0');
    ctx.fillStyle = grd;
    ctx.roundRect(-candleW / 2, -candleH, candleW, candleH, 4 * s); ctx.fill();
    if (candle.melt > 0) {
      ctx.fillStyle = 'rgba(200,185,165,0.35)';
      ctx.roundRect(-candleW / 2, -candleH, candleW, Math.min(candle.melt * s, 12 * s), 2 * s); ctx.fill();
      for (let d = 0; d < 3; d++) {
        const dx = -candleW / 2 + 4 * s + d * 8 * s;
        ctx.fillRect(dx, -candleH, 3 * s, (4 + Math.random() * 4) * s);
      }
    }
    ctx.strokeStyle = '#302018'; ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(0, -candleH);
    ctx.quadraticCurveTo(2 * s + Math.sin(Date.now() * 0.003) * 1.5 * s, -candleH - 8 * s, 1 * s, -candleH - 6 * s);
    ctx.stroke();
    ctx.restore();

    if (candle.lit && candleFlame) {
      candle.melt += 0.0035;
      if (candleH <= 10 * s) { candle.lit = false; candleFlame = null; endSession(); return; }
      const cx2 = cx + Math.sin(Date.now() * 0.003) * 1.5 * s;
      const cy2 = cy - candleH - 8 * s;
      candleFlame.x = cx2; candleFlame.y = cy2; candleFlame.baseY = cy2;
      const flameSizeRatio = Math.max(candleH / (candle.height * s), 0.2);
      candleFlame.maxSize = 14 * s * flameSizeRatio;
      candleFlame.update(); candleFlame.draw(ctx);
      if (Math.random() < 0.1) particles.push(new Smoke(cx2, cy2 - 12 * s, { vy: 0.3, size: 1.5 * s, color: 'rgba(200,180,160,ALPHA)' }));
    }
  }

  // ═════════════ CAMPFIRE ═════════════
  function updateCampfire() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.6;

    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 14 * s, 65 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2510';
    ctx.roundRect(-45 * s, -20 * s, 90 * s, 14 * s, 4 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,20,0.25)';
    for (let r = 0; r < 5; r++) {
      const rx = -38 * s + r * 20 * s;
      ctx.beginPath(); ctx.arc(rx, -6 * s, 3.5 * s, 0, Math.PI); ctx.stroke();
    }
    ctx.save(); ctx.rotate(0.15);
    ctx.fillStyle = '#4a3020';
    ctx.roundRect(-40 * s, -14 * s, 80 * s, 12 * s, 3 * s); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(-0.12);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-42 * s, -12 * s, 84 * s, 10 * s, 3 * s); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.3);
    ctx.fillStyle = '#4a3520';
    ctx.roundRect(-28 * s, -7 * s, 56 * s, 8 * s, 2 * s); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(-0.25);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-30 * s, -6 * s, 60 * s, 8 * s, 2 * s); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, -5 * s, 25 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,80,20,0.04)'; ctx.fill();
    ctx.restore();

    if (campfire.lit) {
      for (let i = campfire.flames.length - 1; i >= 0; i--) {
        campfire.flames[i].update(); campfire.flames[i].draw(ctx);
      }
      campfire.sparksTimer++;
      if (campfire.sparksTimer % 3 === 0) {
        for (let i = 0; i < 3; i++) particles.push(new Spark(cx, cy - 5 * s));
      }
      if (Math.random() < 0.2) {
        particles.push(new Smoke(cx + (Math.random() - 0.5) * 45 * s, cy - 35 * s, { vy: 0.6, size: 8 * s, color: 'rgba(180,160,140,ALPHA)' }));
      }
    }
  }

  function _setSocket(s) { socket = s; }

  function addChatMsg(nickname, text) {
    chatMessages.push(new ChatMsg(nickname, text));
    if (chatMessages.length > 20) chatMessages.shift();
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

  return { init, setMode, _setSocket, addChatMsg };
})();
