(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: true });

  // --- BeavJet assets (optional). If missing, falls back to procedural graphics.
  const ASSET_ROOT = "/aviator";
  const IMG = {};
  const IMG_READY = { value: false };

  function loadImage(name, src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { IMG[name] = im; resolve(true); };
      im.onerror = () => { IMG[name] = null; resolve(false); };
      im.src = src;
    });
  }

  async function loadAssets() {
    const list = {
      plane: `${ASSET_ROOT}/plane/plane.png`,
      planeBoost: `${ASSET_ROOT}/plane/plane_boost.png`,
      fire: `${ASSET_ROOT}/plane/engine_fire.png`,
      shadow: `${ASSET_ROOT}/plane/plane_shadow.png`,
      sky: `${ASSET_ROOT}/bg/sky.png`,
      clouds: `${ASSET_ROOT}/bg/clouds.png`,
      city: `${ASSET_ROOT}/bg/city.png`,
      spark: `${ASSET_ROOT}/effects/spark.png`,
      particle: `${ASSET_ROOT}/effects/particle.png`,
      explosion: `${ASSET_ROOT}/effects/explosion.png`,
      smoke: `${ASSET_ROOT}/effects/smoke.png`,
    };
    const results = await Promise.all(Object.entries(list).map(([k, v]) => loadImage(k, v)));
    // ready if at least the core visuals exist
    IMG_READY.value = Boolean(IMG.plane && IMG.sky && IMG.clouds && IMG.city);
    return results;
  }


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
    boomT: 0,
    boomOn: false,
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
    state.boomOn = false;
    state.boomT = 0;
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
    state.boomOn = true;
    state.boomT = 0;
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

    // crash explosion overlay (image-based if available)
    if (state.boomOn) {
      state.boomT += dt / 1000;
      drawBoom();
      if (state.boomT > 1.0) state.boomOn = false;
    }

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

    // If branded images are available, use parallax layers.
    if (IMG_READY.value) {
      ctx.save();

      // SKY
      const sky = IMG.sky;
      if (sky) {
        // cover
        const scale = Math.max(w / sky.width, h / sky.height);
        const dw = sky.width * scale;
        const dh = sky.height * scale;
        ctx.globalAlpha = 1;
        ctx.drawImage(sky, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }

      // subtle vignette
      ctx.save();
      const vg = ctx.createRadialGradient(w * 0.65, h * 0.25, 20, w * 0.55, h * 0.45, Math.max(w, h));
      vg.addColorStop(0, "rgba(234,59,59,0.10)");
      vg.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // CITY (slow)
      const city = IMG.city;
      if (city) {
        const y = h - city.height * (w / city.width);
        const scale = w / city.width;
        const dh = city.height * scale;
        const dy = h - dh;
        const off = (t * 8 * state.dpr) % (w * 0.35);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(city, -off, dy, w + off, dh);
      }

      // CLOUDS (faster)
      const clouds = IMG.clouds;
      if (clouds) {
        const scale = w / clouds.width;
        const dh = clouds.height * scale;
        const dy = h * 0.05;
        const off = (t * 32 * state.dpr) % w;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(clouds, -off, dy, w, dh);
        ctx.drawImage(clouds, -off + w, dy, w, dh);
      }

      ctx.restore();
      return;
    }

    // --- Fallback procedural background ---
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
    const s = 1.0 + Math.min(0.28, (Math.log(mult) / Math.log(30)) * 0.22);
    const rot = clamp(-0.25 + (Math.log(mult) / Math.log(60)) * 0.55, -0.25, 0.55);

    // Micro-bob for premium feel
    const bob = Math.sin(performance.now() / 180) * 2.0 * state.dpr;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(rot);
    ctx.scale(s * state.dpr, s * state.dpr);

    // If we have branded images, use them
    if (IMG.plane) {
      // Shadow (separate image looks cleaner)
      if (IMG.shadow) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.drawImage(IMG.shadow, -IMG.shadow.width * 0.5, 18, IMG.shadow.width, IMG.shadow.height);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.beginPath();
        ctx.ellipse(-6, 18, 46, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Engine fire flicker (behind)
      const wantsBoost = state.running && !state.cashed && mult >= 2.2;
      const fire = IMG.fire;
      if (fire) {
        const f = 0.78 + (Math.sin(performance.now() / 55) * 0.10 + Math.random() * 0.08);
        ctx.save();
        ctx.globalAlpha = wantsBoost ? 0.95 : 0.65;
        ctx.translate(-72, 2);
        ctx.scale(f, f);
        ctx.drawImage(fire, -fire.width * 0.5, -fire.height * 0.5, fire.width, fire.height);
        ctx.restore();
      }

      // Plane image (switch to boost skin at higher mult)
      const im = (mult >= 6 || state.cashed) && IMG.planeBoost ? IMG.planeBoost : IMG.plane;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(im, -im.width * 0.5, -im.height * 0.5, im.width, im.height);
      ctx.restore();

      ctx.restore();
      return;
    }

    // --- fallback procedural plane ---
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
    ctx.fillStyle = "rgba(240,240,240,0.95)";
    ctx.beginPath();
    ctx.moveTo(58, -10);
    ctx.quadraticCurveTo(72, 0, 58, 10);
    ctx.closePath();
    ctx.fill();

    // stripe
    const grad = ctx.createLinearGradient(-40, -10, 50, 10);
    grad.addColorStop(0, "rgba(234,59,59,0.10)");
    grad.addColorStop(0.3, "rgba(234,59,59,0.70)");
    grad.addColorStop(1, "rgba(255,90,90,0.10)");
    roundedRect(-40, -10, 90, 20, 10, grad);

    // wing
    roundedRect(-26, 2, 46, 12, 6, "rgba(255,255,255,0.92)");
    // tail
    roundedRect(-54, -18, 18, 12, 6, "rgba(255,255,255,0.92)");

    // cockpit
    roundedRect(10, -18, 26, 12, 6, "rgba(20,20,24,0.85)");
    // beaver head
    ctx.fillStyle = "rgba(144,94,60,0.95)";
    ctx.beginPath();
    ctx.arc(-4, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    // ear
    ctx.fillStyle = "rgba(134,84,52,0.95)";
    ctx.beginPath();
    ctx.arc(-10, -24, 4, 0, Math.PI * 2);
    ctx.fill();
    // goggles
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-8, -20, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2, -20, 3.5, 0, Math.PI * 2);
    ctx.stroke();

    // glow at high mult
    const glow = clamp((Math.log(mult) / Math.log(30)) * 0.9, 0, 1);
    if (glow > 0.1) {
      ctx.save();
      ctx.globalAlpha = glow * 0.45;
      ctx.shadowColor = "rgba(255,90,90,1)";
      ctx.shadowBlur = 18 * state.dpr;
      ctx.fillStyle = "rgba(255,90,90,0.25)";
      roundedRect(-66, -14, 132, 28, 12, "rgba(255,90,90,0.10)");
      ctx.restore();
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
    // big boom sprite (center)
    state.particles.push({
      x: state.w * 0.5,
      y: state.h * 0.42,
      vx: 0,
      vy: 0,
      life: 0.85,
      t: 0,
      kind: "boom",
      rot: Math.random() * Math.PI * 2,
    });

    const n = 84;
    for (let i = 0; i < n; i++) {
      const smoke = i % 4 === 0;
      state.particles.push({
        x: state.w * 0.5 + (Math.random() - 0.5) * 30 * state.dpr,
        y: state.h * 0.42 + (Math.random() - 0.5) * 30 * state.dpr,
        vx: (Math.random() - 0.5) * (smoke ? 260 : 620) * state.dpr,
        vy: (Math.random() - 0.5) * (smoke ? 260 : 620) * state.dpr,
        life: (smoke ? 1.4 : 0.95) + Math.random() * 0.7,
        t: 0,
        kind: smoke ? "smoke" : (i % 3 === 0 ? "particle" : "spark"),
        rot: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawBoom() {
    const w = state.w, h = state.h;
    const t = state.boomT;
    const k = 1 - Math.min(1, t / 1.0);

    // flash
    ctx.save();
    ctx.globalAlpha = 0.25 * k;
    ctx.fillStyle = "rgba(255,90,90,1)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // center glow
    ctx.save();
    const r = (120 + t * 420) * state.dpr;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, r);
    g.addColorStop(0, `rgba(255,120,90,${0.55 * k})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
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

      if (IMG_READY.value && (p.kind === "spark" || p.kind === "smoke" || p.kind === "particle" || p.kind === "boom")) {
        let im = null;
        if (p.kind === "spark") im = IMG.spark;
        if (p.kind === "smoke") im = IMG.smoke;
        if (p.kind === "particle") im = IMG.particle;
        if (p.kind === "boom") im = IMG.explosion;

        if (im) {
          const base = (p.kind === "smoke") ? 90 : (p.kind === "boom" ? 420 : 42);
          const size = (base * (0.65 + (1 - k) * 0.55)) * state.dpr;
          ctx.save();
          ctx.globalAlpha = (p.kind === "smoke") ? (0.06 + k * 0.22) : (0.10 + k * 0.85);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot || 0) + (1 - k) * 0.6);
          ctx.drawImage(im, -size * 0.5, -size * 0.5, size, size);
          ctx.restore();
          continue;
        }
      }

      // fallback primitives
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
  // fire-and-forget asset loading
  loadAssets().catch(() => {});
  requestAnimationFrame(tick);
})();
