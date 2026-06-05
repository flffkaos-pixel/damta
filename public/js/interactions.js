const Interactions = (() => {
  let canvas, ctx, W, H, dpr;
  let mode = 'vape';
  let particles = [];
  let chatMessages = [];
  let isPressed = false;
  let pressStart = 0;
  let animId = null;
  let socket = null;

  let sessionActive = false;
  let sessionTime = 0;
  let sessionDuration = 300 + Math.floor(Math.random() * 120);

  let vapePuffing = false;
  let vapeLiquid = 100;
  let vape = { total: 0 };

  let trashAnim = null;

  let baseScale = 1;

  function calcScale() {
    const sMax = Math.min(W, H) / 200;
    const fit = Math.min(W * 0.75 / (120 * 0.866), H * 0.7 / 170);
    baseScale = Math.max(0.5, Math.min(sMax, fit));
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
    el.textContent = `💨${vape.total}`;
  }

  function resetState() {
    vapePuffing = false;
    vapeLiquid = 100;
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
    if (mode === 'vape') vape.total++;
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'flex';
    updateTotals();
  }

  function startTrashAnim() {
    const opts = document.getElementById('end-options');
    if (opts) opts.style.display = 'none';
    const s = baseScale;
    const canX = W - 60 * s, canY = H - 50 * s;
    const sx = W / 2, sy = H * 0.5 - 30 * s;
    trashAnim = { phase: 0, buttX: sx, buttY: sy, canX, canY, mode };
  }

  function setupEvents() {
    function onDown(e) {
      e.preventDefault();
      isPressed = true;
      pressStart = Date.now();
      if (mode === 'vape') {
        vapePuffing = true;
        if (!sessionActive) startSession();
        vapeLiquid = Math.max(0, vapeLiquid - 0.5);
      }
    }
    function onMove(e) { e.preventDefault(); }
    function onUp(e) {
      e.preventDefault();
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

  function animate() {
    ctx.clearRect(0, 0, W, H);

    if (sessionActive) {
      sessionTime += 1 / 60;
      const m = Math.floor(sessionTime / 60);
      const sec = Math.floor(sessionTime % 60);
      const el = document.getElementById('timer-display');
      if (el) el.textContent = `⏱️ ${m}:${sec.toString().padStart(2, '0')}`;
      if (sessionTime >= sessionDuration) {
        if (mode === 'vape') vapePuffing = false;
        endSession();
      }
    }

    drawBackground();
    updateVape();
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

        // flying vape
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillStyle = '#182038'; ctx.roundRect(-10 * s, -20 * s, 20 * s, 40 * s, 4 * s); ctx.fill();
        ctx.fillStyle = '#4a4a58'; ctx.roundRect(-6 * s, -24 * s, 12 * s, 6 * s, 2 * s); ctx.fill();
        ctx.fillStyle = '#880022'; ctx.beginPath(); ctx.arc(0, 4 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
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
