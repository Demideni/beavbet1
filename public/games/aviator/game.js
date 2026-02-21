(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: true });

  const state = {
    dpr: 1,
    w: 0,
    h: 0,

    // round
    running: false,
    crashed: false,
    cashed: false,
    roundId: null,
    bet: 0,
    t0: 0,
    t: 0,
    crashPoint: 1.2,
    mult: 1.0,

    lastCrash: null,

    // visuals
    trail: [],
    particles: [],
    shake: 0,
  };

  function resize() {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    state.dpr = dpr;
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (w === state.w && h === state.h) return;
    state.w = w;
    state.h = h;
    canvas.width = w;
    canvas.height = h;
  }

  function sampleCrashPoint() {
    // Heavy-tail distribution with a small house edge.
    // Not "original Aviator" math; just a BeavBet-styled crash feel.
    const houseEdge = 0.035; // 3.5%
    const u = Math.random(); // (0,1)
    const raw = (1 - houseEdge) / Math.max(1e-6, u);
    // soften tail to feel nice on mobile
    const softened = Math.pow(raw, 0.60);
    return clamp(softened, 1.05, 300);
  }

  function startRound({ roundId, bet }) {
    state.running = true;
    state.crashed = false;
    state.cashed = false;
    state.roundId = roundId;
    state.bet = bet;
    state.t0 = performance.now();
    state.t = 0;
    state.mult = 1.0;
    state.crashPoint = sampleCrashPoint();
    state.trail.length = 0;
    state.particles.length = 0;
    state.shake = 0;
  }

  function cashOut() {
    if (!state.running || state.crashed || state.cashed) return null;
    state.cashed = true;
    state.shake = 0.6;
    spawnBurst();
    return { multiplier: state.mult, roundId: state.roundId };
  }

  function forceCrash() {
    if (!state.running || state.crashed) return;
    state.crashed = true;
    state.running = false;
    state.lastCrash = state.crashPoint;
    state.shake = 1.0;
    spawnExplosion();
  }

  function tick(now) {
    resize();

    const w = state.w, h = state.h;
    ctx.clearRect(0, 0, w, h);

    // time
    const dt = 16.666;
    if (state.running) {
      state.t = (now - state.t0) / 1000;
      // multiplier growth: smooth exponential
      const rate = 0.22; // growth speed
      state.mult = Math.max(1, Math.exp(state.t * rate));
      if (state.mult >= state.crashPoint) {
        state.mult = state.crashPoint;
        forceCrash();
      }
    }

    // background
    drawBackground(now);

    // graph & plane
    drawGraph();

    // particles
    updateParticles(dt / 1000);
    drawParticles();

    requestAnimationFrame(tick);
  }

  function drawBackground(now) {
    const w = state.w, h = state.h;
    const t = now / 1000;

    // subtle stars
    ctx.save();
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 70; i++) {
      const x = (Math.sin(i * 999 + t * 0.13) * 0.5 + 0.5) * w;
      const y = (Math.sin(i * 333 + t * 0.08) * 0.5 + 0.5) * h * 0.65;
      const a = (Math.sin(i * 111 + t * 0.6) * 0.5 + 0.5) * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${0.05 + a * 0.12})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();

    // clouds (parallax ribbons)
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) {
      const y = h * (0.18 + i * 0.12) + Math.sin(t * 0.6 + i) * 10 * state.dpr;
      const xoff = (t * (35 + i * 12) * state.dpr) % (w + 600 * state.dpr);
      const x = -300 * state.dpr + (w + 600 * state.dpr) - xoff;
      const grad = ctx.createLinearGradient(x, y, x + 520 * state.dpr, y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.3, "rgba(255,255,255,0.06)");
      grad.addColorStop(0.7, "rgba(255,255,255,0.03)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 520 * state.dpr, 90 * state.dpr);
    }
    ctx.restore();

    // horizon glow
    const g = ctx.createRadialGradient(w * 0.6, h * 0.2, 0, w * 0.6, h * 0.2, h * 0.9);
    g.addColorStop(0, "rgba(234,59,59,0.18)");
    g.addColorStop(0.45, "rgba(234,59,59,0.06)");
    g.addColorStop(1, "rgba(234,59,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawGraph() {
    const w = state.w, h = state.h;
    const pad = 26 * state.dpr;
    const gw = w - pad * 2;
    const gh = h - pad * 2;

    // shake
    const shake = state.shake;
    if (shake > 0) state.shake = Math.max(0, shake - 0.04);
    const sx = (Math.random() - 0.5) * 6 * shake * state.dpr;
    const sy = (Math.random() - 0.5) * 6 * shake * state.dpr;

    ctx.save();
    ctx.translate(sx, sy);

    // grid
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1 * state.dpr;
    for (let i = 1; i <= 6; i++) {
      const x = pad + (gw * i) / 6;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + gh); ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const y = pad + (gh * i) / 5;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + gw, y); ctx.stroke();
    }
    ctx.restore();

    // curve points
    const maxT = 16; // seconds display range
    const rate = 0.22;
    const currentT = state.running ? state.t : (state.crashed ? Math.log(state.crashPoint) / rate : 0);
    const viewT = Math.max(4, Math.min(maxT, currentT + 1.2));
    const maxMult = Math.max(2.2, Math.min(60, (state.running ? state.mult : (state.lastCrash || 2)) * 1.25));

    const toX = (t) => pad + (t / viewT) * gw;
    const toY = (m) => pad + gh - (Math.log(m) / Math.log(maxMult)) * gh;

    // line
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5 * state.dpr;

    // glow
    ctx.strokeStyle = "rgba(234,59,59,0.22)";
    ctx.lineWidth = 10 * state.dpr;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const t = (viewT * i) / 160;
      const m = Math.max(1, Math.exp(t * rate));
      const x = toX(t);
      const y = toY(m);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // main
    ctx.strokeStyle = "rgba(255,90,90,0.95)";
    ctx.lineWidth = 3.4 * state.dpr;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const t = (viewT * i) / 160;
      const m = Math.max(1, Math.exp(t * rate));
      const x = toX(t);
      const y = toY(m);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // plane position at current multiplier
    const mNow = state.running ? state.mult : (state.crashed ? state.crashPoint : 1);
    const tNow = state.running ? state.t : (state.crashed ? Math.log(state.crashPoint) / rate : 0);
    const px = toX(Math.min(viewT, tNow));
    const py = toY(mNow);

    // trail
    state.trail.push({ x: px, y: py, a: 1 });
    if (state.trail.length > 60) state.trail.shift();
    drawTrail();

    // plane + beaver
    drawPlane(px, py, mNow);

    // crash text
    if (state.crashed) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawTrail() {
    ctx.save();
    ctx.lineWidth = 2.5 * state.dpr;
    ctx.lineCap = "round";
    for (let i = 1; i < state.trail.length; i++) {
      const a = i / state.trail.length;
      ctx.strokeStyle = `rgba(255,90,90,${0.06 + a * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(state.trail[i - 1].x, state.trail[i - 1].y);
      ctx.lineTo(state.trail[i].x, state.trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlane(x, y, mult) {
    const s = 1.0 + Math.min(0.25, (Math.log(mult) / Math.log(30)) * 0.22);
    const rot = clamp(-0.25 + (Math.log(mult) / Math.log(60)) * 0.55, -0.25, 0.55);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s * state.dpr, s * state.dpr);

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.ellipse(-6, 18, 46, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // body
    roundedRect(-62, -10, 120, 20, 10, "rgba(255,255,255,0.92)");
    // nose
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(58, -10);
    ctx.lineTo(86, 0);
    ctx.lineTo(58, 10);
    ctx.closePath();
    ctx.fill();

    // wing
    ctx.fillStyle = "rgba(234,59,59,0.90)";
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(32, 40);
    ctx.lineTo(12, 40);
    ctx.lineTo(-38, 6);
    ctx.closePath();
    ctx.fill();

    // tail
    ctx.fillStyle = "rgba(234,59,59,0.92)";
    ctx.beginPath();
    ctx.moveTo(-62, -10);
    ctx.lineTo(-92, -34);
    ctx.lineTo(-78, -4);
    ctx.lineTo(-92, 34);
    ctx.lineTo(-62, 10);
    ctx.closePath();
    ctx.fill();

    // cockpit (beaver window)
    ctx.fillStyle = "rgba(30,30,40,0.80)";
    ctx.beginPath();
    ctx.ellipse(30, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(35, -2, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // beaver head (simple)
    ctx.save();
    ctx.translate(28, 0);
    ctx.scale(0.9, 0.9);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // logo
    ctx.strokeStyle = "rgba(234,59,59,0.95)";
    ctx.lineWidth = 2.5;
    roundStroke(-24, -7, 40, 14, 6);
    ctx.fillStyle = "rgba(234,59,59,0.95)";
    ctx.font = "900 10px ui-sans-serif, system-ui";
    ctx.fillText("BB", -15, 4);

    // engine fire
    if (state.running && !state.crashed) {
      const flick = (Math.sin(performance.now() / 90) * 0.5 + 0.5);
      const len = 22 + flick * 14;
      const grad = ctx.createLinearGradient(-70, 0, -70 - len, 0);
      grad.addColorStop(0, "rgba(255,160,80,0.95)");
      grad.addColorStop(0.4, "rgba(255,90,90,0.85)");
      grad.addColorStop(1, "rgba(255,90,90,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-62, -6);
      ctx.lineTo(-62 - len, 0);
      ctx.lineTo(-62, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function roundedRect(x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
  function roundStroke(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.stroke();
  }

  function spawnBurst() {
    const n = 30;
    for (let i = 0; i < n; i++) {
      state.particles.push({
        x: state.w * 0.5,
        y: state.h * 0.5,
        vx: (Math.random() - 0.5) * 420 * state.dpr,
        vy: (Math.random() - 0.7) * 420 * state.dpr,
        life: 0.6 + Math.random() * 0.5,
        t: 0,
        kind: "spark",
      });
    }
  }

  function spawnExplosion() {
    const n = 70;
    for (let i = 0; i < n; i++) {
      state.particles.push({
        x: state.w * 0.5,
        y: state.h * 0.42,
        vx: (Math.random() - 0.5) * 520 * state.dpr,
        vy: (Math.random() - 0.5) * 520 * state.dpr,
        life: 0.9 + Math.random() * 0.8,
        t: 0,
        kind: i % 3 === 0 ? "smoke" : "spark",
      });
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy = p.vy * 0.98 + 240 * dt * state.dpr;
    }
    state.particles = state.particles.filter((p) => p.t < p.life);
  }

  function drawParticles() {
    for (const p of state.particles) {
      const k = 1 - p.t / p.life;
      if (p.kind === "spark") {
        ctx.fillStyle = `rgba(255,120,80,${0.18 + k * 0.75})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (2 + k * 3) * state.dpr, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + k * 0.10})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (18 + (1 - k) * 22) * state.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  window.AviatorGame = {
    state,
    startRound,
    cashOut,
    forceCrash,
  };

  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);
})();
