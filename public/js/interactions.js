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
  let cigCx = 0, cigCy = 0;

  let cig = { burn: 0, maxBurn: 80, ash: 0, maxAsh: 50, lit: false, done: false, total: 0 };
  let match = { burning: false, burn: 0, maxBurn: 100, done: false, total: 0 };
  let candle = { lit: false, melt: 0, height: 150, total: 0 };
  let candleFlame = null;
  let campfire = { lit: false, flames: [], sparksTimer: 0, total: 0 };
  let pipe = { lit: false, tobacco: 100, ash: 0, done: false, total: 0 };
  let vapePuffing = false;
  let vapeLiquid = 100;
  let vape = { total: 0 };
  let bubble = { total: 0 };
  let bubbleSoap = 100;
  let bubbleFrame = 0;

  let trashAnim = null;

  let baseScale = 1;

  function calcScale() {
    const sMax = Math.min(W, H) / 200;
    const fit = Math.min(W * 0.75 / (120 * 0.866), H * 0.7 / 170);
    baseScale = Math.max(0.5, Math.min(sMax, fit));
  }

  class Smoke {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 3 * s;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.15 * s;
      this.vy = (-Math.random() * 0.5 - 0.15) * s;
      this.size = (2 + Math.random() * 4) * s;
      this.life = 1;
      this.decay = 0.008 + Math.random() * 0.008;
      this.phase = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.vx + Math.sin(this.phase) * 0.25 * baseScale;
      this.y += this.vy;
      this.vy *= 0.995;
      this.life -= this.decay;
      this.phase += 0.025;
      this.size *= 0.998;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const a = Math.min(this.life * 1.5, 0.15);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(185,185,195,${a})`;
      ctx.fill();
    }
  }

  class Ash {
    constructor(x, y) {
      const s = baseScale;
      this.x = x + (Math.random() - 0.5) * 3 * s;
      this.y = y;
      this.size = (1 + Math.random() * 1.5) * s;
      this.life = 1;
      this.vy = (Math.random() * 1.5 + 1) * s;
      this.vx = (Math.random() - 0.5) * 0.8 * s;
      this.friction = 0.96;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy *= this.friction; this.vx *= 0.97;
      this.life -= 0.015;
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
      this.size = (4 + Math.random() * 30) * s;
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
      this.color = null;
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
      ctx.fillStyle = this.color ? this.color.replace('ALPHA', alpha) : `rgba(200,200,210,${alpha})`;
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
      this.decay = 0.002 + Math.random() * 0.002;
      this.x = 10 + Math.random() * Math.max(W - 80, 100);
      this.y = H * 0.25 + Math.random() * H * 0.25;
      this.vy = (-0.2 - Math.random() * 0.25) * baseScale;
      this.vx = (Math.random() - 0.5) * 0.08 * baseScale;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy *= 0.995;
      this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.min(this.life * 2, 0.85);
      const s = baseScale;
      ctx.font = `bold ${9 * s}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const nickW = ctx.measureText(this.nickname + ': ').width;
      const fullText = this.nickname + ': ' + this.text;
      const m = ctx.measureText(fullText);
      const tw = Math.min(m.width, W * 0.75);
      const tx = Math.max(8, Math.min(this.x, W - tw - 8));
      ctx.fillStyle = `rgba(240,160,80,${alpha * 0.85})`;
      ctx.fillText(this.nickname + ':', tx, this.y);
      ctx.fillStyle = `rgba(220,205,185,${alpha * 0.75})`;
      ctx.fillText(this.text, tx + ctx.measureText(this.nickname + ': ').width, this.y);
    }
  }

  function updateTotals() {
    const el = document.getElementById('totals');
    if (!el) return;
    el.textContent = `🚬${cig.total}  🫧${bubble.total}  💨${vape.total}  🔥${match.total}  🕯️${candle.total}  🪔${pipe.total}`;
  }

  function resetState() {
    cig = { burn: 0, maxBurn: 80, ash: 0, maxAsh: 50, lit: false, done: false, total: cig.total || 0 };
    match = { burning: false, burn: 0, maxBurn: 100, done: false, total: match.total || 0 };
    candle = { lit: false, melt: 0, height: 150, total: candle.total || 0 };
    candleFlame = null;
    campfire = { lit: false, flames: [], sparksTimer: 0, total: campfire.total || 0, wood: 200 };
    pipe = { lit: false, tobacco: 100, ash: 0, done: false, total: pipe.total || 0 };
    vapePuffing = false;
    vapeLiquid = 100;
    bubbleSoap = 100;
    particles = [];
    trashAnim = null;
    sessionActive = false;
    sessionTime = 0;
    const td = document.getElementById('timer-display');
    if (td) td.textContent = '⏱️';
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'none';
    updateTotals();
  }

  function init(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    setupEvents();
    animate();
    updateTotals();
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'none';
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
    updateTotals();
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
    const m = Math.floor(sessionTime / 60);
    const sec = Math.floor(sessionTime % 60);
    const td = document.getElementById('timer-display');
    if (td) td.textContent = `✅ ${m}:${sec.toString().padStart(2, '0')}`;
    if (mode === 'cigarette' && cig.done) {
      cig.total++; if (socket) socket.emit('cigarette-done');
    }
    if (mode === 'bubble') bubble.total++;
    if (mode === 'vape') vape.total++;
    if (mode === 'match' && match.done) match.total++;
    if (mode === 'candle' && !candle.lit) candle.total++;
    if (mode === 'pipe' && pipe.done) pipe.total++;
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'flex';
    updateTotals();
  }

  function startTrashAnim() {
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'none';
    const s = baseScale;
    const cx = W / 2 - 50 * s, cy = H * 0.5 + 30 * s;
    const angle = -Math.PI / 6;
    const filterW = 22 * s;
    const buttCx = cx + (filterW / 2) * Math.cos(angle);
    const buttCy = cy + (filterW / 2) * Math.sin(angle);
    const canX = W - 60 * s, canY = H - 50 * s;
    trashAnim = { phase: 0, buttX: buttCx, buttY: buttCy, canX, canY };
  }

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
      } else if (mode === 'pipe') {
        if (!pipe.lit) { pipe.lit = true; startSession(); }
      } else if (mode === 'vape') {
        vapePuffing = true;
        if (!sessionActive) startSession();
      } else if (mode === 'bubble') {
        if (!sessionActive) startSession();
      }
    }
    function onMove(e) { e.preventDefault(); }
    function onUp(e) {
      e.preventDefault();
      if (mode === 'cigarette' && cig.lit && !cig.done && (Date.now() - pressStart) < 300) {
        const angle = -Math.PI / 6;
        const visRemaining = 120 * baseScale * (1 - cig.burn / cig.maxBurn);
        const tip = rot(cigCx, cigCy, visRemaining, 0, angle);
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
    const moreBtn = document.getElementById('more-btn');
    const doneBtn = document.getElementById('done-btn');
    if (moreBtn) moreBtn.onclick = () => resetState();
    if (doneBtn) doneBtn.onclick = () => startTrashAnim();
  }

  function rot(cx, cy, dx, dy, angle) {
    return {
      x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
    };
  }

  function handleCandle() {
    candle.lit = !candle.lit;
    const s = baseScale;
    const cx = W / 2, cy2 = H * 0.5 + 75 * s, ch = Math.max(candle.height - candle.melt, 10);
    if (candle.lit) {
      candleFlame = new Flame(cx, cy2 - ch - 6, { size: 14, permanent: true, color: [255, 200, 80] });
    } else {
      candleFlame = null;
    }
  }

  function handleCampfire() {
    campfire.lit = !campfire.lit;
    if (campfire.lit) {
      const cx = W / 2, cy = H * 0.5 + 10 * baseScale;
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

  function animate() {
    ctx.clearRect(0, 0, W, H);

    if (sessionActive) {
      sessionTime += 1 / 60;
      const m = Math.floor(sessionTime / 60);
      const sec = Math.floor(sessionTime % 60);
      const el = document.getElementById('timer-display');
      if (el) el.textContent = `⏱️ ${m}:${sec.toString().padStart(2, '0')}`;
      if (sessionTime >= sessionDuration) {
        if (mode === 'cigarette') { cig.lit = false; cig.done = true; }
        if (mode === 'match') { match.burning = false; match.done = true; }
        if (mode === 'candle') { candle.lit = false; candleFlame = null; }
        if (mode === 'campfire') { campfire.lit = false; campfire.flames = []; }
        if (mode === 'pipe') pipe.lit = false;
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
      case 'pipe': updatePipe(); break;
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

    if (trashAnim) {
      const s = baseScale;
      trashAnim.phase += 0.012;
      if (trashAnim.phase >= 1) {
        trashAnim = null;
        resetState();
      } else {
        const t = trashAnim.phase;
        const bX = trashAnim.buttX, bY = trashAnim.buttY;
        const cX = trashAnim.canX, cY = trashAnim.canY;
        const mx = (bX + cX) / 2, my = Math.min(bY, cY) - 60 * s * (1 - t);
        const px = (1 - t) * (1 - t) * bX + 2 * (1 - t) * t * mx + t * t * cX;
        const py = (1 - t) * (1 - t) * bY + 2 * (1 - t) * t * my + t * t * cY;
        const rot = t * Math.PI * 3;

        // trash can
        ctx.save();
        ctx.translate(cX, cY);
        ctx.fillStyle = '#3a3530';
        ctx.roundRect(-16 * s, -22 * s, 32 * s, 34 * s, [2 * s, 2 * s, 6 * s, 6 * s]); ctx.fill();
        ctx.fillStyle = '#4a4540';
        ctx.roundRect(-16 * s, -22 * s, 32 * s, 6 * s, 2 * s); ctx.fill();
        ctx.strokeStyle = '#5a5550';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(-10 * s, -16 * s); ctx.lineTo(-10 * s, 8 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -16 * s); ctx.lineTo(0, 8 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10 * s, -16 * s); ctx.lineTo(10 * s, 8 * s); ctx.stroke();
        // lid
        ctx.fillStyle = '#4a4540';
        ctx.roundRect(-18 * s, -28 * s, 36 * s, 4 * s, 2 * s); ctx.fill();
        ctx.restore();

        // flying butt
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        const fw = 22 * s, fh = 16 * s;
        const grd = ctx.createLinearGradient(0, -fh / 2, 0, fh / 2);
        grd.addColorStop(0, '#bf8740'); grd.addColorStop(0.3, '#daa858');
        grd.addColorStop(0.7, '#c89048'); grd.addColorStop(1, '#a87030');
        ctx.fillStyle = grd;
        ctx.roundRect(-fw / 2, -fh / 2, fw, fh, 2 * s); ctx.fill();
        ctx.fillStyle = 'rgba(50,40,30,0.35)';
        ctx.roundRect(fw / 2 - 3 * s, -fh / 2, 3 * s, fh, 1 * s); ctx.fill();
        ctx.restore();

        // trail
        if (t > 0.1) {
          particles.push({ x: px, y: py, life: 0.3, decay: 0.02, size: 3 * s, draw(p) { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(200,190,170,${this.life * 0.3})`; ctx.fill(); }, update() { this.life -= this.decay; this.x += (Math.random() - 0.5) * 0.5; this.y += (Math.random() - 0.5) * 0.5; } });
        }
      }
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
    const cx = W / 2 - 50 * s, cy = H * 0.5 + 30 * s;
    cigCx = cx; cigCy = cy;
    const cigLen = 120 * s, cigW = 16 * s;
    const angle = -Math.PI / 6;

    if (cig.lit && !cig.done) {
      cig.burn += (0.004 + (isPressed ? 0.006 : 0)) * 1.2;
      cig.ash += (0.003 + (isPressed ? 0.005 : 0)) * 1.2;
      if (cig.burn >= cig.maxBurn || cigLen * (1 - cig.burn / cig.maxBurn) <= 22 * s) { cig.done = true; cig.lit = false; endSession(); }
      if (cig.ash >= cig.maxAsh) {
        const r = cigLen * (1 - cig.burn / cig.maxBurn);
        const t = rot(cx, cy, r, 0, angle);
        for (let i = 0; i < 5; i++) particles.push(new Ash(t.x, t.y));
        cig.ash = 0;
      }
      const r = cigLen * (1 - cig.burn / cig.maxBurn);
      const tip = rot(cx, cy, r, 0, angle);
      if (Math.random() < 0.04) {
        particles.push(new Smoke(tip.x, tip.y));
      }
    }

    const burnRatio = cig.burn / cig.maxBurn;
    const remaining = cigLen * (1 - burnRatio);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const filterW = 22 * s;
    const bodyR = cigW / 2;

    if (remaining > 0) {
      const paperLen = Math.max(0, remaining - filterW);
      const bodyTop = -bodyR, bodyBot = bodyR;

      // ── paper body with 3D shading ──
      if (paperLen > 0) {
        const grdP = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
        grdP.addColorStop(0, '#e8e2d8'); grdP.addColorStop(0.25, '#f8f4ee'); grdP.addColorStop(0.55, '#f8f4ee');
        grdP.addColorStop(0.8, '#ece6dc'); grdP.addColorStop(1, '#d4cec4');
        ctx.fillStyle = grdP;
        ctx.roundRect(filterW, bodyTop, paperLen, cigW, 1); ctx.fill();
        // paper seam line at bottom
        ctx.strokeStyle = 'rgba(160,150,140,0.12)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(filterW, bodyBot - 1); ctx.lineTo(filterW + paperLen, bodyBot - 1); ctx.stroke();
      }

      // ── cork filter ──
      const grdF = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
      grdF.addColorStop(0, '#bf8740'); grdF.addColorStop(0.2, '#daa858'); grdF.addColorStop(0.45, '#e8b868');
      grdF.addColorStop(0.7, '#daa858'); grdF.addColorStop(0.85, '#c89048'); grdF.addColorStop(1, '#a87030');
      ctx.fillStyle = grdF;
      ctx.roundRect(0, bodyTop, filterW, cigW, [3 * s, 0, 0, 3 * s]); ctx.fill();
      // cork texture: small brown specks
      ctx.fillStyle = 'rgba(140,100,50,0.12)';
      for (let t = 0; t < 16; t++) {
        const tx = Math.random() * filterW;
        const ty = bodyTop + Math.random() * cigW;
        ctx.beginPath(); ctx.arc(tx, ty, (0.3 + Math.random() * 0.8) * s, 0, Math.PI * 2); ctx.fill();
      }
      // cork border lines
      ctx.strokeStyle = 'rgba(80,55,25,0.2)'; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(filterW - 1, bodyTop + 3 * s); ctx.lineTo(filterW - 1, bodyBot - 3 * s); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,55,25,0.1)'; ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(filterW - 2.5 * s, bodyTop + 4 * s); ctx.lineTo(filterW - 2.5 * s, bodyBot - 4 * s); ctx.stroke();

      // ── ash ──
      if (cig.ash > 2 || (cig.lit && !cig.done)) {
        const ashLen = 4 * s + (cig.ash / cig.maxAsh) * 10 * s;
        const alpha = 0.45 + (cig.ash / cig.maxAsh) * 0.25;
        ctx.fillStyle = `rgba(110,100,90,${alpha})`;
        ctx.roundRect(remaining - ashLen, bodyTop - 1, ashLen + 2 * s, cigW + 2, 2 * s); ctx.fill();
        ctx.fillStyle = `rgba(140,130,115,${alpha * 0.5})`;
        ctx.roundRect(remaining - ashLen * 0.7, bodyTop, ashLen * 0.7, cigW, 1); ctx.fill();
      }
    }

    // ── ember ──
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

    // done: scorched tip on filter
    if (cig.done) {
      ctx.fillStyle = 'rgba(50,40,30,0.35)';
      ctx.roundRect(Math.max(0, remaining - 2 * s), bodyTop, 3 * s, cigW, 1); ctx.fill();
      ctx.fillStyle = 'rgba(80,60,40,0.15)';
      ctx.roundRect(Math.max(0, remaining - 4 * s), bodyTop, 2 * s, cigW, 1); ctx.fill();
    }

    ctx.restore();
  }

  // ═════════════ BUBBLE ═════════════
  function updateBubble() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5 + 10 * s;
    const wandX = cx, wandY = cy - 20 * s;
    if (isPressed && bubbleSoap > 0) {
      bubbleFrame++;
      if (bubbleFrame % 12 === 0) {
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          particles.push(new Bubble(wandX + Math.cos(a) * 8 * s, wandY + Math.sin(a) * 8 * s));
        }
      }
      bubbleSoap = Math.max(0, bubbleSoap - 0.004);
      if (bubbleSoap <= 0) { sessionActive = false; endSession(); }
    }
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, 20 * s); ctx.lineTo(0, -15 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,200,230,0.4)'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(0, -20 * s, 14 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,255,0.15)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(0, -20 * s, 11 * s, 0, Math.PI * 2); ctx.stroke();
    // Soap bottle with liquid level
    ctx.save(); ctx.translate(-35 * s, 50 * s);
    const bottleH = 30 * s, bottleW = 24 * s;
    ctx.strokeStyle = 'rgba(200,220,255,0.2)'; ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(-bottleW / 2, -bottleH, bottleW, bottleH, 3 * s);
    const soapH = (bubbleSoap / 100) * (bottleH - 4 * s);
    ctx.fillStyle = 'rgba(180,220,255,0.15)';
    ctx.roundRect(-bottleW / 2 + 2 * s, -bottleH + 2 * s + (bottleH - 4 * s - soapH), bottleW - 4 * s, soapH, 2 * s);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ═════════════ VAPE ═════════════
  function updateVape() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5 - 30 * s;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#182038';
    ctx.roundRect(-16 * s, -5 * s, 32 * s, 70 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#203050';
    ctx.roundRect(-14 * s, -3 * s, 28 * s, 64 * s, 5 * s); ctx.fill();
    const liquidH = (vapeLiquid / 100) * 40 * s;
    const barX = 14 * s, barW = 3 * s, barY = 18 * s;
    ctx.fillStyle = 'rgba(200,230,255,0.08)';
    ctx.roundRect(barX, barY, barW, 40 * s, 1.5 * s); ctx.fill();
    ctx.fillStyle = 'rgba(100,200,255,0.5)';
    ctx.roundRect(barX, barY + 40 * s - liquidH, barW, liquidH, 1.5 * s); ctx.fill();
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
      vapeLiquid = Math.max(0, vapeLiquid - 0.0015);
      if (vapeLiquid <= 0) { vapePuffing = false; sessionActive = false; endSession(); }
      if (Math.random() < 0.35) {
        particles.push(new VapeCloud(cx + (Math.random() - 0.5) * 3 * s, cy - 24 * s));
      }
    }
  }

  // ═════════════ MATCH ═════════════
  function updateMatch() {
    const s = baseScale;
    const cx = W / 2 - 28 * s, cy = H * 0.5 - 28 * s;
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
      ctx.beginPath(); ctx.ellipse(flameX, 0, 2 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,100,30,0.5)'; ctx.fill();
      if (Math.random() < 0.08) {
        particles.push(new Ash(rot(cx, cy, flameX, 2 * s, Math.PI / 4).x, rot(cx, cy, flameX, 2 * s, Math.PI / 4).y));
      }
      if (Math.random() < 0.2) {
        const p = rot(cx, cy, flameX, -12 * s, Math.PI / 4);
        particles.push(new Smoke(p.x, p.y));
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
    const cx = W / 2, cy = H * 0.5 + 75 * s;
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
      candle.melt += 0.006;
      if (candleH <= 10 * s) { candle.lit = false; candleFlame = null; endSession(); return; }
      const cx2 = cx + Math.sin(Date.now() * 0.003) * 1.5 * s;
      const cy2 = cy - candleH - 8 * s;
      candleFlame.x = cx2; candleFlame.y = cy2; candleFlame.baseY = cy2;
      const flameSizeRatio = Math.max(candleH / (candle.height * s), 0.2);
      candleFlame.maxSize = 14 * s * flameSizeRatio;
      candleFlame.update(); candleFlame.draw(ctx);
      if (Math.random() < 0.1) particles.push(new Smoke(cx2, cy2 - 12 * s));
    }
  }

  // ═════════════ CAMPFIRE ═════════════
  function updateCampfire() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5 + 10 * s;

    const woodRatio = Math.max(0, campfire.wood / 200);
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 14 * s, 65 * s * woodRatio, 14 * s * woodRatio, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2510';
    ctx.roundRect(-45 * s * woodRatio, -20 * s * woodRatio, 90 * s * woodRatio, 14 * s * woodRatio, 4 * s * woodRatio); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,20,0.25)';
    for (let r = 0; r < 5; r++) {
      const rx = (-38 + r * 20) * s * woodRatio;
      ctx.beginPath(); ctx.arc(rx, -6 * s * woodRatio, 3.5 * s * woodRatio, 0, Math.PI); ctx.stroke();
    }
    ctx.save(); ctx.rotate(0.15);
    ctx.fillStyle = '#4a3020';
    ctx.roundRect(-40 * s * woodRatio, -14 * s * woodRatio, 80 * s * woodRatio, 12 * s * woodRatio, 3 * s * woodRatio); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(-0.12);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-42 * s * woodRatio, -12 * s * woodRatio, 84 * s * woodRatio, 10 * s * woodRatio, 3 * s * woodRatio); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.3);
    ctx.fillStyle = '#4a3520';
    ctx.roundRect(-28 * s * woodRatio, -7 * s * woodRatio, 56 * s * woodRatio, 8 * s * woodRatio, 2 * s * woodRatio); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(-0.25);
    ctx.fillStyle = '#3d2818';
    ctx.roundRect(-30 * s * woodRatio, -6 * s * woodRatio, 60 * s * woodRatio, 8 * s * woodRatio, 2 * s * woodRatio); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, -5 * s * woodRatio, 25 * s * woodRatio, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,80,20,0.04)'; ctx.fill();
    ctx.restore();

    if (campfire.lit) {
      for (let i = campfire.flames.length - 1; i >= 0; i--) {
        campfire.flames[i].maxSize = (18 + 28 * woodRatio) * s * woodRatio;
        campfire.flames[i].update(); campfire.flames[i].draw(ctx);
      }
      campfire.sparksTimer++;
      campfire.wood -= 0.02;
      if (campfire.wood <= 0) { campfire.lit = false; campfire.flames = []; endSession(); return; }
      if (campfire.sparksTimer % Math.max(3, 12 - woodRatio * 9) === 0) {
        for (let i = 0; i < 1 + woodRatio * 2; i++) particles.push(new Spark(cx, cy - 5 * s));
      }
      if (Math.random() < 0.2 * woodRatio) {
        particles.push(new Smoke(cx + (Math.random() - 0.5) * 45 * s, cy - 35 * s));
      }
    }
  }

  // ═════════════ PIPE ═════════════
  function updatePipe() {
    const s = baseScale;
    const cx = W / 2 - 20 * s, cy = H * 0.5 + 20 * s;

    ctx.save(); ctx.translate(cx, cy);

    const tRatio = pipe.done ? 0 : pipe.tobacco / 100;

    // stem (curved, from bottom of bowl going right and up)
    ctx.strokeStyle = '#3d2212';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18 * s, -4 * s);
    ctx.quadraticCurveTo(40 * s, 24 * s, 70 * s, 8 * s);
    ctx.quadraticCurveTo(85 * s, 2 * s, 100 * s, -2 * s);
    ctx.stroke();

    // mouthpiece
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(96 * s, -1 * s);
    ctx.lineTo(108 * s, -4 * s);
    ctx.stroke();
    ctx.fillStyle = '#4a3020';
    ctx.roundRect(105 * s, -6 * s, 8 * s, 5 * s, 2 * s); ctx.fill();

    // bowl
    const bw = 30 * s, bh = 34 * s;
    ctx.save();

    // shadow under bowl
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 10 * s, bw * 0.55, 6 * s, 0, 0, Math.PI * 2); ctx.fill();

    // bowl body (rounded cylinder)
    const grad = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, -bh / 2);
    grad.addColorStop(0, '#3a1f10'); grad.addColorStop(0.3, '#5a3520');
    grad.addColorStop(0.6, '#5a3520'); grad.addColorStop(1, '#2d180a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 4 * s, -bh / 2);
    ctx.quadraticCurveTo(-bw / 2 - 2 * s, -bh / 4, -bw / 2 + 2 * s, bh / 2);
    ctx.lineTo(bw / 2 - 2 * s, bh / 2);
    ctx.quadraticCurveTo(bw / 2 + 2 * s, -bh / 4, bw / 2 - 4 * s, -bh / 2);
    ctx.closePath(); ctx.fill();

    // bowl rim
    ctx.strokeStyle = '#6a4528';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 5 * s, -bh / 2 + 2 * s);
    ctx.quadraticCurveTo(0, -bh / 2 - 4 * s, bw / 2 - 5 * s, -bh / 2 + 2 * s);
    ctx.stroke();

    // chamber opening (ellipse at top)
    ctx.fillStyle = '#1a0e06';
    ctx.beginPath();
    ctx.ellipse(0, -bh / 2 + 2 * s, bw / 2 - 6 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // tobacco in chamber
    if (tRatio > 0) {
      const tH = (bw - 12 * s) * 0.4 * tRatio;
      const tY = -bh / 2 + 2 * s + (1 - tRatio) * 8 * s;
      const grdT = ctx.createLinearGradient(0, tY, 0, tY + tH);
      grdT.addColorStop(0, '#7a5028'); grdT.addColorStop(1, '#4a2a12');
      ctx.fillStyle = grdT;
      ctx.beginPath();
      ctx.ellipse(0, tY + tH / 2, bw / 2 - 7 * s, tH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // tobacco specks
      ctx.fillStyle = 'rgba(30,18,8,0.2)';
      for (let i = 0; i < 6; i++) {
        const tx = (Math.random() - 0.5) * (bw - 16 * s);
        const ty = tY + tH * (0.1 + Math.random() * 0.8);
        ctx.beginPath(); ctx.arc(tx, ty, (0.3 + Math.random() * 0.6) * s, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ash on top
    if (pipe.lit && !pipe.done && tRatio > 0) {
      const aY = -bh / 2 + 2 * s + (1 - tRatio) * 8 * s;
      ctx.fillStyle = 'rgba(100,90,80,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, aY - 1 * s, bw / 2 - 7 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ember
    if (pipe.lit && !pipe.done && tRatio > 0) {
      const eY = -bh / 2 + 2 * s + (1 - tRatio) * 8 * s;
      const grd = ctx.createRadialGradient(0, eY, 0, 0, eY, 5 * s);
      grd.addColorStop(0, 'rgba(255,200,80,0.5)');
      grd.addColorStop(0.3, 'rgba(255,120,30,0.3)');
      grd.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, eY, 5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, eY, 1.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,200,100,0.8)'; ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    // update
    if (pipe.lit && !pipe.done) {
      pipe.tobacco = Math.max(0, pipe.tobacco - 0.01);
      if (pipe.tobacco <= 0) { pipe.done = true; pipe.lit = false; endSession(); }
      if (Math.random() < 0.03) particles.push(new Smoke(cx, cy - bh * 0.6));
    }
  }

  function _setSocket(s) { socket = s; }

  function addChatMsg(nickname, text) {
    chatMessages.push(new ChatMsg(nickname, text));
    if (chatMessages.length > 30) chatMessages.shift();
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
