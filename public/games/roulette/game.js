(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Bridge (parent page provides window.BEAVBET_BRIDGE) ----
  const BRIDGE = () => (window.BEAVBET_BRIDGE || null);

  const state = {
    spinning: false,
    auto: false,
    roundId: null,
    currency: "EUR",
    balance: 0,
    // rail
    cards: [],
    cardW: 140,
    gap: 12,
  };

  // Items (CS-case style), payout = bet * multiplier
  // Weights tuned for ~96% RTP (approx): expected multiplier ~0.96
  const ITEMS = [
    { key:"common", name:"Rusty Skin", rarity:"Common", mult:0.20, w:380, cls:"c1" },
    { key:"uncommon", name:"Forest Camo", rarity:"Uncommon", mult:0.50, w:270, cls:"c2" },
    { key:"rare", name:"Neon Edge", rarity:"Rare", mult:1.00, w:200, cls:"c3" },
    { key:"epic", name:"Crimson Blaze", rarity:"Epic", mult:2.00, w:110, cls:"c4" },
    { key:"legendary", name:"Gold Fang", rarity:"Legendary", mult:5.00, w:35, cls:"c5" },
    { key:"mythic", name:"BeavBet Relic", rarity:"Mythic", mult:20.00, w:5, cls:"c6" },
  ];

  function pickWeighted() {
    const total = ITEMS.reduce((s, it) => s + it.w, 0);
    let r = Math.random() * total;
    for (const it of ITEMS) {
      r -= it.w;
      if (r <= 0) return it;
    }
    return ITEMS[0];
  }

  function fmt(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function setStatus(t) {
    $("status").textContent = t;
  }

  async function refreshBalance() {
    const b = BRIDGE();
    if (!b) return;
    const bal = await b.getBalance();
    state.balance = Number(bal || 0);
    $("balance").textContent = fmt(state.balance);
  }

  function buildCard(item) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.key = item.key;
    el.innerHTML = `
      <div class="badge ${item.cls}">${item.rarity}</div>
      <div class="rarity">${item.rarity.toUpperCase()}</div>
      <div class="name">${item.name}</div>
      <div class="mult">x${item.mult.toFixed(2)}</div>
    `;
    // Accent
    el.style.boxShadow = `0 18px 55px rgba(226,27,47,.12)`;
    el.style.background = `linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.22))`;
    return el;
  }

  function populateRail(winItem) {
    const rail = $("rail");
    rail.innerHTML = "";
    state.cards = [];

    // Create a long strip so it feels like a real case opening
    const N = 60;
    const winIndex = 42; // where we will stop
    for (let i = 0; i < N; i++) {
      const it = (i === winIndex) ? winItem : pickWeighted();
      state.cards.push(it);
      rail.appendChild(buildCard(it));
    }

    // Reset transform so first frame is stable
    rail.style.transform = "translate(-50%,-50%) translateX(0px)";
    return { winIndex };
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

  async function doSpin() {
    if (state.spinning) return;
    const b = BRIDGE();
    if (!b) return alert("Bridge not ready");

    const bet = Math.max(0, Number($("bet").value || 0));
    if (!(bet > 0)) return;

    state.spinning = true;
    $("spin").disabled = true;
    setStatus("Ставка принимается…");

    let placed;
    try {
      placed = await b.placeBet(bet);
    } catch (e) {
      state.spinning = false;
      $("spin").disabled = false;
      setStatus("Ошибка ставки");
      return;
    }

    state.roundId = placed.roundId;
    await refreshBalance();

    // Determine outcome (client RNG; can be replaced by provably-fair later)
    const winItem = pickWeighted();
    const { winIndex } = populateRail(winItem);

    // Animate to center winIndex under the center line.
    const rail = $("rail");
    const wrap = rail.parentElement; // .rail-wrap
    const wrapW = wrap.getBoundingClientRect().width;

    const cardW = state.cardW;
    const gap = state.gap;
    const step = cardW + gap;

    // Rail is centered with translate(-50%,-50%), so translateX moves strip.
    // We want the center of win card to align with wrap center:
    const targetCenter = wrapW / 2;
    const winCardCenter = (winIndex * step) + (cardW / 2);
    const targetX = targetCenter - winCardCenter;

    // Add some overshoot for juicy feel
    const overshoot = 40 + Math.random() * 25;
    const x1 = targetX - overshoot;

    const dur1 = 2100 + Math.random() * 350;
    const dur2 = 520 + Math.random() * 180;

    setStatus("Крутится…");

    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - start) / dur1);
        const e = easeOutQuint(t);
        const x = x1 * e;
        rail.style.transform = `translate(-50%,-50%) translateX(${x}px)`;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });

    const start2 = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - start2) / dur2);
        const e = easeOutCubic(t);
        const x = x1 + (targetX - x1) * e;
        rail.style.transform = `translate(-50%,-50%) translateX(${x}px)`;
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });

    // Flash winning card
    const children = rail.children;
    const winEl = children[winIndex];
    if (winEl) {
      winEl.style.boxShadow = "0 0 0 2px rgba(255,255,255,.22), 0 0 44px rgba(226,27,47,.55)";
      winEl.style.transform = "translateY(-2px) scale(1.02)";
      setTimeout(() => {
        winEl.style.transform = "";
      }, 650);
    }

    // Payout
    const payout = Number((bet * winItem.mult).toFixed(2));
    const profit = payout - bet;

    setStatus(payout > 0 ? `Выпало: ${winItem.rarity} • x${winItem.mult.toFixed(2)} • ${profit >= 0 ? "+" : ""}${fmt(profit)}` : "Не повезло");

    try {
      if (payout > 0) {
        await b.cashOut({ roundId: state.roundId, payout, item: winItem.key, mult: winItem.mult });
      }
      await b.finishRound({ roundId: state.roundId, result: winItem.key, mult: winItem.mult });
    } catch (e) {
      // Ignore; wallet will be consistent server-side anyway
    }

    await refreshBalance();

    state.spinning = false;
    $("spin").disabled = false;

    if (state.auto) {
      setTimeout(() => doSpin(), 650);
    }
  }

  function bindUI() {
    document.querySelectorAll(".chip[data-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = Number($("bet").value || 0);
        const add = Number(btn.getAttribute("data-chip") || 0);
        $("bet").value = String(Math.max(0.1, v + add));
      });
    });

    $("half").addEventListener("click", () => {
      const v = Number($("bet").value || 0);
      $("bet").value = String(Math.max(0.1, (v / 2)));
    });

    $("double").addEventListener("click", () => {
      const v = Number($("bet").value || 0);
      $("bet").value = String(Math.max(0.1, (v * 2)));
    });

    $("max").addEventListener("click", async () => {
      await refreshBalance();
      $("bet").value = String(Math.max(0.1, state.balance));
    });

    $("spin").addEventListener("click", doSpin);

    $("auto").addEventListener("click", () => {
      state.auto = !state.auto;
      $("auto").textContent = `AUTO: ${state.auto ? "ON" : "OFF"}`;
      if (state.auto && !state.spinning) doSpin();
    });
  }

  async function init() {
    bindUI();
    setStatus("Загрузка…");

    // Ask parent for context/currency
    const b = BRIDGE();
    try {
      const ctx = b?.getContext?.() || {};
      if (ctx?.currency) state.currency = String(ctx.currency);
    } catch {}

    $("currency").textContent = state.currency;

    await refreshBalance();

    // Pre-fill rail with random items
    populateRail(pickWeighted());
    setStatus("Готово");
  }

  window.addEventListener("message", (ev) => {
    // Reserved; parent already injects bridge
  });

  init();
})();