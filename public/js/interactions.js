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

  let cig = { burn: 0, maxBurn: 24, ash: 0, maxAsh: 50, lit: false, done: false, total: 0 };
  let match = { burning: false, burn: 0, maxBurn: 100, done: false, total: 0 };
  let candle = { lit: false, melt: 0, height: 150, total: 0 };
  let candleFlame = null;
  let campfire = { lit: false, flames: [], sparksTimer: 0, total: 0 };
  let pipe = { lit: false, tobacco: 100, ash: 0, done: false, total: 0 };
  let vapePuffing = false;
  let vapeLiquid = 100;
  let vape = { total: 0 };
  let bubble = { total: 0 };
  let bubbleSoap = 30;
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
      this.straight = opts.straight || false;
    }
    update() {
      this.flicker += 0.05 + Math.random() * 0.12;
      this.size = this.maxSize * (0.78 + Math.sin(this.flicker) * 0.22 + Math.random() * 0.04);
      if (!this.straight) this.x += Math.sin(this.flicker * 0.5) * 0.3 * baseScale + this.wind;
      this.y = this.straight ? this.baseY - 1.5 * baseScale : this.baseY - Math.abs(Math.sin(this.flicker * 0.3)) * 2 * baseScale;
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
    cig = { burn: 0, maxBurn: 24, ash: 0, maxAsh: 50, lit: false, done: false, total: cig.total || 0 };
    match = { burning: false, burn: 0, maxBurn: 100, done: false, total: match.total || 0 };
    candle = { lit: false, melt: 0, height: 150, total: candle.total || 0 };
    candleFlame = null;
    campfire = { lit: false, flames: [], sparksTimer: 0, total: campfire.total || 0, wood: 200 };
    pipe = { lit: false, tobacco: 100, ash: 0, done: false, total: pipe.total || 0 };
    vapePuffing = false;
    vapeLiquid = 100;
    bubbleSoap = 30;
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
    const canX = W - 60 * s, canY = H - 50 * s;
    let sx, sy;
    switch (mode) {
      case 'cigarette': {
        const cx = W / 2 - 50 * s, cy = H * 0.5 + 30 * s;
        const a = -Math.PI / 6;
        sx = cx + 11 * s * Math.cos(a);
        sy = cy + 11 * s * Math.sin(a);
        break;
      }
      case 'bubble': sx = W / 2; sy = H * 0.5 + 10 * s; break;
      case 'vape': sx = W / 2; sy = H * 0.5 - 30 * s; break;
      case 'match': {
        const cx = W / 2 - 28 * s, cy = H * 0.5 - 28 * s;
        const m = rot(cx, cy, 70 * s, 0, Math.PI / 4);
        sx = m.x; sy = m.y; break;
      }
      case 'candle': sx = W / 2; sy = H * 0.5 + 75 * s; break;
      case 'pipe': sx = W / 2 - 20 * s; sy = H * 0.5 + 20 * s; break;
      default: sx = W / 2; sy = H * 0.5;
    }
    trashAnim = { phase: 0, buttX: sx, buttY: sy, canX, canY, mode };
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
        vapeLiquid = Math.max(0, vapeLiquid - 0.5);
      } else if (mode === 'bubble') {
        if (!sessionActive) startSession();
        bubbleSoap = Math.max(0, bubbleSoap - 0.5);
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

        // flying item (mode-specific)
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        const tm = trashAnim.mode || 'cigarette';
        if (tm === 'cigarette') {
          const fw = 22 * s, fh = 16 * s;
          const grd = ctx.createLinearGradient(0, -fh / 2, 0, fh / 2);
          grd.addColorStop(0, '#bf8740'); grd.addColorStop(0.3, '#daa858');
          grd.addColorStop(0.7, '#c89048'); grd.addColorStop(1, '#a87030');
          ctx.fillStyle = grd;
          ctx.roundRect(-fw / 2, -fh / 2, fw, fh, 2 * s); ctx.fill();
          ctx.fillStyle = 'rgba(50,40,30,0.35)';
          ctx.roundRect(fw / 2 - 3 * s, -fh / 2, 3 * s, fh, 1 * s); ctx.fill();
        } else if (tm === 'bubble') {
          ctx.strokeStyle = 'rgba(180,220,255,0.6)'; ctx.lineWidth = 2.5 * s;
          ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(180,220,255,0.15)'; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath(); ctx.arc(-3 * s, -4 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
        } else if (tm === 'vape') {
          ctx.fillStyle = '#182038'; ctx.roundRect(-10 * s, -20 * s, 20 * s, 40 * s, 4 * s); ctx.fill();
          ctx.fillStyle = '#4a4a58'; ctx.roundRect(-6 * s, -24 * s, 12 * s, 6 * s, 2 * s); ctx.fill();
          ctx.fillStyle = '#880022'; ctx.beginPath(); ctx.arc(0, 4 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
        } else if (tm === 'match') {
          ctx.fillStyle = '#3a2510'; ctx.roundRect(-30 * s, -2.5 * s, 60 * s, 5 * s, 1); ctx.fill();
          ctx.fillStyle = '#cc5533'; ctx.beginPath(); ctx.arc(30 * s, 0, 6 * s, 0, Math.PI * 2); ctx.fill();
        } else if (tm === 'candle') {
          ctx.fillStyle = '#d8ccb8'; ctx.roundRect(-12 * s, -20 * s, 24 * s, 30 * s, 4 * s); ctx.fill();
          ctx.fillStyle = '#302018'; ctx.lineWidth = 2 * s;
          ctx.beginPath(); ctx.moveTo(0, -20 * s); ctx.lineTo(0, -30 * s); ctx.stroke();
        } else if (tm === 'pipe') {
          ctx.fillStyle = '#3a1f10'; ctx.roundRect(-14 * s, -16 * s, 28 * s, 30 * s, 4 * s); ctx.fill();
          ctx.strokeStyle = '#3d2212'; ctx.lineWidth = 4 * s;
          ctx.beginPath(); ctx.moveTo(14 * s, -6 * s); ctx.quadraticCurveTo(30 * s, 6 * s, 44 * s, -2 * s); ctx.stroke();
        }
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
      cig.burn += (0.0024 + (isPressed ? 0.0032 : 0)) * 1.2;
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
    const bodyTop = -bodyR, bodyBot = bodyR;

    if (remaining > 0) {
      const paperLen = Math.max(0, remaining - filterW);

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
        // subtle vertical fiber lines on paper
        ctx.strokeStyle = 'rgba(160,150,140,0.06)'; ctx.lineWidth = 0.4;
        for (let f = filterW + 2; f < filterW + paperLen - 2; f += 4) {
          ctx.beginPath(); ctx.moveTo(f, bodyTop + 1); ctx.lineTo(f, bodyBot - 1); ctx.stroke();
        }
        // scorch gradient near tip (when lit, paper near ember darkens)
        if (cig.lit && !cig.done) {
          const tipX = remaining;
          const scorchW = 18 * s;
          const scorchGrd = ctx.createLinearGradient(tipX - scorchW, 0, tipX, 0);
          scorchGrd.addColorStop(0, 'rgba(80,60,40,0)');
          scorchGrd.addColorStop(0.5, 'rgba(100,75,50,0.25)');
          scorchGrd.addColorStop(1, 'rgba(50,35,20,0.5)');
          ctx.fillStyle = scorchGrd;
          ctx.fillRect(Math.max(filterW, tipX - scorchW), bodyTop, scorchW, cigW);
        }
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
      if (bubbleFrame % 60 === 0) {
        particles.push(new Bubble(wandX + (Math.random() - 0.5) * 8 * s, wandY + (Math.random() - 0.5) * 8 * s));
      }
      bubbleSoap = Math.max(0, bubbleSoap - 0.03);
    }
    if (bubbleSoap <= 0 && sessionActive) { sessionActive = false; endSession(); }
    ctx.save(); ctx.translate(cx, cy);

    // wand handle (wooden stick with grain)
    const handleGrd = ctx.createLinearGradient(-3 * s, 0, 3 * s, 0);
    handleGrd.addColorStop(0, '#5a4a3a');
    handleGrd.addColorStop(0.5, '#8a7a65');
    handleGrd.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = handleGrd;
    ctx.fillRect(-3 * s, 18 * s, 6 * s, -32 * s);
    ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 0.6;
    for (let g = 18 * s; g > -16 * s; g -= 4 * s) {
      ctx.beginPath(); ctx.moveTo(-2.5 * s, g); ctx.lineTo(2.5 * s, g - 1); ctx.stroke();
    }

    // wand neck (curved bend into ring)
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -14 * s);
    ctx.quadraticCurveTo(0, -18 * s, 6 * s, -18 * s);
    ctx.stroke();

    // ring loop (bubble film)
    const ringGrd = ctx.createLinearGradient(0, -32 * s, 0, -8 * s);
    ringGrd.addColorStop(0, '#7a6a5a');
    ringGrd.addColorStop(0.5, '#a08a78');
    ringGrd.addColorStop(1, '#5a4a3a');
    ctx.strokeStyle = ringGrd; ctx.lineWidth = 2.2 * s;
    ctx.beginPath(); ctx.arc(6 * s, -18 * s, 14 * s, -Math.PI / 2, Math.PI / 2); ctx.stroke();

    // soap film inside ring (only when wet)
    if (bubbleSoap > 1) {
      ctx.save();
      ctx.beginPath(); ctx.rect(-8 * s, -34 * s, 28 * s, 30 * s); ctx.clip();
      ctx.beginPath(); ctx.arc(6 * s, -18 * s, 12.5 * s, 0, Math.PI * 2);
      const filmAlpha = 0.2 + Math.sin(Date.now() * 0.003) * 0.05;
      const filmGrd = ctx.createRadialGradient(6 * s, -20 * s, 0, 6 * s, -18 * s, 12 * s);
      filmGrd.addColorStop(0, `rgba(220,240,255,${filmAlpha + 0.15})`);
      filmGrd.addColorStop(0.5, `rgba(150,200,255,${filmAlpha})`);
      filmGrd.addColorStop(1, `rgba(80,140,220,${filmAlpha - 0.1})`);
      ctx.fillStyle = filmGrd; ctx.fill();
      ctx.beginPath(); ctx.arc(2 * s, -22 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      ctx.restore();
    }

    // soap gauge bar with circle at end
    const barX = -30 * s, barY = 40 * s, barW = 60 * s, barH = 8 * s;
    const fillW = (bubbleSoap / 30) * barW;
    ctx.fillStyle = 'rgba(30,40,60,0.5)';
    ctx.roundRect(barX, barY, barW, barH, 4 * s); ctx.fill();
    ctx.fillStyle = '#3399ff';
    ctx.roundRect(barX, barY, fillW, barH, 4 * s); ctx.fill();
    const dotR = 6 * s;
    ctx.beginPath(); ctx.arc(barX + fillW, barY + barH / 2, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#66ccff'; ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(barX + fillW, barY + barH / 2, dotR + 1 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ═════════════ VAPE ═════════════
  function updateVape() {
    const s = baseScale;
    const cx = W / 2, cy = H * 0.5 - 30 * s;
    ctx.save(); ctx.translate(cx, cy);

    // body shell (dark metallic)
    const bodyGrd = ctx.createLinearGradient(-16 * s, 0, 16 * s, 0);
    bodyGrd.addColorStop(0, '#0a1020');
    bodyGrd.addColorStop(0.25, '#1a2540');
    bodyGrd.addColorStop(0.55, '#203050');
    bodyGrd.addColorStop(0.85, '#1a2540');
    bodyGrd.addColorStop(1, '#0a1020');
    ctx.fillStyle = bodyGrd;
    ctx.roundRect(-16 * s, -5 * s, 32 * s, 70 * s, 6 * s); ctx.fill();

    // body inner highlight
    ctx.fillStyle = 'rgba(80,110,160,0.15)';
    ctx.fillRect(-14 * s, 0, 28 * s, 2 * s);

    // bottom cap (510 connector)
    ctx.fillStyle = '#0a0a14';
    ctx.roundRect(-13 * s, 60 * s, 26 * s, 8 * s, 3 * s); ctx.fill();
    ctx.strokeStyle = '#3a4a60'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-11 * s, 62 * s); ctx.lineTo(11 * s, 62 * s); ctx.stroke();

    // top tank section (clearomizer, slightly tapered)
    const tankGrd = ctx.createLinearGradient(-10 * s, 0, 10 * s, 0);
    tankGrd.addColorStop(0, '#1a1a2a');
    tankGrd.addColorStop(0.5, '#2a2a3a');
    tankGrd.addColorStop(1, '#1a1a2a');
    ctx.fillStyle = tankGrd;
    ctx.roundRect(-10 * s, -22 * s, 20 * s, 20 * s, [3 * s, 3 * s, 0, 0]); ctx.fill();
    // glass tube window
    ctx.fillStyle = 'rgba(60,80,110,0.25)';
    ctx.fillRect(-8 * s, -19 * s, 16 * s, 15 * s);
    // e-liquid inside (mini visual)
    const liqH = 15 * s * (vapeLiquid / 100);
    const liqGrd = ctx.createLinearGradient(0, -4 * s, 0, -4 * s + liqH);
    liqGrd.addColorStop(0, 'rgba(255,200,50,0.5)');
    liqGrd.addColorStop(1, 'rgba(200,140,20,0.4)');
    ctx.fillStyle = liqGrd;
    ctx.fillRect(-7.5 * s, -4 * s, 15 * s, liqH);

    // drip tip (mouthpiece) — black narrow cone
    ctx.fillStyle = '#08080c';
    ctx.beginPath();
    ctx.moveTo(-5 * s, -22 * s);
    ctx.lineTo(-6 * s, -30 * s);
    ctx.lineTo(6 * s, -30 * s);
    ctx.lineTo(5 * s, -22 * s);
    ctx.closePath();
    ctx.fill();
    // drip tip highlight
    ctx.fillStyle = 'rgba(80,80,100,0.4)';
    ctx.fillRect(-5 * s, -29 * s, 10 * s, 1 * s);

    // wide gauge bar inside body
    const iGW = 22 * s, iGH = 12 * s, iGX = -11 * s, iGY = 24 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(iGX, iGY, iGW, iGH, 3 * s); ctx.fill();
    // gauge bezel
    ctx.strokeStyle = '#4a5a78'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(iGX, iGY, iGW, iGH, 3 * s); ctx.stroke();
    const iGFill = (vapeLiquid / 100) * (iGW - 6 * s);
    const gG = ctx.createLinearGradient(iGX, iGY, iGX + iGW, iGY);
    gG.addColorStop(0, '#ff8800');
    gG.addColorStop(0.5, '#ffcc00');
    gG.addColorStop(1, '#44ff44');
    ctx.fillStyle = gG;
    ctx.roundRect(iGX + 3 * s, iGY + 2 * s, iGFill, iGH - 4 * s, 2 * s); ctx.fill();

    // fire button (round, red LED ring)
    const btnY = 45 * s;
    ctx.beginPath(); ctx.arc(0, btnY, 6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2a'; ctx.fill();
    ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = 1;
    ctx.stroke();
    if (vapePuffing) {
      ctx.beginPath(); ctx.arc(0, btnY, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ff2200'; ctx.fill();
      // LED glow
      ctx.beginPath(); ctx.arc(0, btnY, 9 * s, 0, Math.PI * 2);
      const ledG = ctx.createRadialGradient(0, btnY, 0, 0, btnY, 9 * s);
      ledG.addColorStop(0, 'rgba(255,30,0,0.45)');
      ledG.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = ledG; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, btnY, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#440011'; ctx.fill();
    }

    // brand text on body
    ctx.fillStyle = 'rgba(140,170,210,0.35)';
    ctx.font = `bold ${3.5 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VAPE', 0, 14 * s);
    ctx.textAlign = 'start';

    ctx.restore();
    if (vapePuffing) {
      vapeLiquid = Math.max(0, vapeLiquid - 0.015);
      if (vapeLiquid <= 0) { vapePuffing = false; sessionActive = false; endSession(); }
      if (Math.random() < 0.35) {
        particles.push(new VapeCloud(cx + (Math.random() - 0.5) * 3 * s, cy - 32 * s));
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

    // wood stick with gradient
    const stickGrd = ctx.createLinearGradient(0, -2.5 * s, 0, 2.5 * s);
    stickGrd.addColorStop(0, '#b8945e');
    stickGrd.addColorStop(0.3, '#e0c290');
    stickGrd.addColorStop(0.55, '#d8b880');
    stickGrd.addColorStop(0.85, '#a8845a');
    stickGrd.addColorStop(1, '#8a6a40');
    ctx.fillStyle = stickGrd;
    ctx.roundRect(0, -2.5 * s, stickLen, 5 * s, 1.2); ctx.fill();
    // wood grain lines
    ctx.strokeStyle = 'rgba(120,80,40,0.18)';
    ctx.lineWidth = 0.4;
    for (let g = 3 * s; g < stickLen; g += 3.5 * s) {
      ctx.beginPath(); ctx.moveTo(g, -2 * s); ctx.lineTo(g + 1.5 * s, 2 * s); ctx.stroke();
    }
    // tip end (rounded cap)
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, 2.5 * s, Math.PI / 2, -Math.PI / 2); ctx.fill();

    if (!match.burning && !match.done) {
      // chemical head with red stripes (like safety matches)
      const headGrd = ctx.createRadialGradient(headX, 0, 0, headX, 0, 8 * s);
      headGrd.addColorStop(0, '#ee7755');
      headGrd.addColorStop(0.6, '#cc4a2a');
      headGrd.addColorStop(1, '#8a2810');
      ctx.fillStyle = headGrd;
      ctx.beginPath(); ctx.arc(headX, 0, 7 * s, 0, Math.PI * 2); ctx.fill();
      // dark stripes (sulfur + oxidizer pattern)
      ctx.strokeStyle = 'rgba(40,15,5,0.45)'; ctx.lineWidth = 0.8;
      for (let st = -5; st <= 5; st += 2.5) {
        ctx.beginPath();
        ctx.moveTo(headX + Math.cos(st * 0.3) * 6 * s, st * s);
        ctx.lineTo(headX + Math.cos(st * 0.3) * 3 * s, st * s + 1);
        ctx.stroke();
      }
      // small highlight
      ctx.fillStyle = 'rgba(255,200,150,0.35)';
      ctx.beginPath(); ctx.arc(headX - 2 * s, -2 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
      // glow halo
      ctx.beginPath(); ctx.arc(headX, 0, 11 * s, 0, Math.PI * 2);
      const haloGrd = ctx.createRadialGradient(headX, 0, 5 * s, headX, 0, 11 * s);
      haloGrd.addColorStop(0, 'rgba(200,80,40,0.0)');
      haloGrd.addColorStop(1, 'rgba(200,80,40,0.18)');
      ctx.fillStyle = haloGrd; ctx.fill();
    }

    if (match.burning && !match.done) {
      match.burn += 0.03;
      if (match.burn >= match.maxBurn) { match.done = true; match.burning = false; endSession(); }
      const burnRatio = match.burn / match.maxBurn;
      const burnedLen = burnRatio * 45 * s;
      const flameX = headX - burnedLen;
      const flSize = (10 - burnRatio * 5) * s;
      const flame = new Flame(flameX, -8 * s, { size: Math.max(flSize, 2 * s), color: [255, 180 - burnRatio * 80, 50 - burnRatio * 30], straight: true });
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
        // char texture
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let c = 0; c < 6; c++) {
          const cx2 = headX - Math.random() * burnedLen;
          ctx.fillRect(cx2, -2.5 * s, 0.5, 5 * s);
        }
      }
    }

    if (match.done) {
      ctx.fillStyle = '#3a2510';
      ctx.roundRect(headX - 40 * s, -2.5 * s, 40 * s, 5 * s, 1); ctx.fill();
      // black char tip
      ctx.fillStyle = '#1a0a02';
      ctx.beginPath(); ctx.arc(headX, 0, 2.5 * s, 0, Math.PI * 2); ctx.fill();
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
    // body gradient (3D)
    const grd = ctx.createLinearGradient(-candleW / 2, 0, candleW / 2, 0);
    grd.addColorStop(0, '#c8b8a0');
    grd.addColorStop(0.15, '#dcc8a8');
    grd.addColorStop(0.5, '#ece0c4');
    grd.addColorStop(0.85, '#d4c0a0');
    grd.addColorStop(1, '#b8a888');
    ctx.fillStyle = grd;
    ctx.roundRect(-candleW / 2, -candleH, candleW, candleH, 4 * s); ctx.fill();

    // top wax pool (darker, melted)
    const poolH = Math.min(candle.melt * s, 6 * s);
    if (poolH > 0) {
      ctx.fillStyle = '#a89070';
      ctx.beginPath(); ctx.ellipse(0, -candleH + 2 * s, candleW / 2 - 1 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    // wax drips on sides
    if (candle.melt > 5) {
      const dripCount = Math.min(Math.floor(candle.melt / 4), 4);
      ctx.fillStyle = 'rgba(220,200,170,0.7)';
      for (let d = 0; d < dripCount; d++) {
        const dAngle = (d / dripCount) * Math.PI * 2 + Date.now() * 0.0002;
        const dx = Math.cos(dAngle) * (candleW / 2 - 2 * s);
        const dy = -candleH + Math.random() * 4 * s;
        const dripLen = (5 + Math.random() * 8) * s;
        ctx.beginPath();
        ctx.moveTo(dx - 1.5 * s, dy);
        ctx.quadraticCurveTo(dx, dy + dripLen * 0.5, dx, dy + dripLen);
        ctx.quadraticCurveTo(dx, dy + dripLen * 0.5, dx + 1.5 * s, dy);
        ctx.fill();
      }
    }

    // wick (black, slightly bent)
    const wickTop = -candleH - 6 * s;
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -candleH);
    ctx.quadraticCurveTo(1 * s, -candleH - 4 * s, 0, wickTop);
    ctx.stroke();
    // burnt wick tip (glowing)
    if (candle.lit) {
      ctx.fillStyle = '#ffaa44';
      ctx.beginPath(); ctx.arc(0, wickTop + 1 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (candle.lit && candleFlame) {
      candle.melt += 0.006;
      if (candleH <= 10 * s) { candle.lit = false; candleFlame = null; endSession(); return; }
      const cx2 = cx + Math.sin(Date.now() * 0.003) * 1.5 * s;
      const cy2 = cy - candleH - 6 * s;
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
