(() => {
  // ====== Config / Rules ======
  const NUM_DECKS = 6;
  const MIN_BET = 5;
  const MAX_BET = 500;
  const DEALER_STANDS_SOFT_17 = true;
  const BLACKJACK_PAYOUT = 1.5; // 3:2

  const el = (id) => document.getElementById(id);

  // ====== UI (must exist) ======
  const dealerCardsEl = el("dealerCards");
  const playerCardsEl = el("playerCards");
  const dealerScoreEl = el("dealerScore");
  const playerScoreEl = el("playerScore");
  const messageEl = el("message");

  const balanceEl = el("balance");
  const betEl = el("bet");
  const betTopEl = el("betTop");

  // Layout sync: reserve space for fixed status + tapbar on all screens
  const tapbarEl = el("tapbar") || document.querySelector(".tapbar");
  function syncLayoutVars(){
    const tb = tapbarEl ? tapbarEl.getBoundingClientRect().height : 0;
    const root = document.documentElement;
    root.style.setProperty("--tapbarH", `${Math.ceil(tb)}px`);
  }
  window.addEventListener("resize", syncLayoutVars, { passive: true });
  window.addEventListener("orientationchange", syncLayoutVars, { passive: true });
  requestAnimationFrame(syncLayoutVars);
  setTimeout(syncLayoutVars, 250);

  const dealBtn = el("dealBtn");
  const hitBtn = el("hitBtn");
  const standBtn = el("standBtn");
  const doubleBtn = el("doubleBtn");

  // Bet modal (optional but expected)
  const betAdjustBtn = el("betAdjustBtn");
  const betModal = el("betModal");
  const betApply = el("betApply");
  const betCancel = el("betCancel");
  const betCloseBtn = el("betCloseBtn"); // ✕
  const pickDeltaEl = el("pickDelta");   // if present
  const carList = el("carList") || (betModal ? betModal.querySelector(".chips") : null);
  const carLeft = el("carLeft");
  const carRight = el("carRight");

  // ====== HARD GUARD ======
  const required = [
    dealerCardsEl, playerCardsEl, dealerScoreEl, playerScoreEl, messageEl,
    balanceEl, betEl, betTopEl,
    dealBtn, hitBtn, standBtn, doubleBtn
  ];
  if (required.some(x => !x)) {
    console.error("Blackjack: missing required DOM elements. Check ids in index.html");
    return;
  }

  // ====== State ======
  let shoe = [];
  let currency = "EUR";
  let balance = 1000;
  let bet = 10;

  const CURRENCY_SYMBOL = { USD: "$", EUR: "€", GBP: "£", RUB: "₽" };
  function fmtMoney(amount){
    const sym = CURRENCY_SYMBOL[currency] || (currency + " ");
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${sym}0.00`;
    return `${sym}${n.toFixed(2)}`;
  }

  async function loadWallet(){
    try{
      const res = await fetch('/api/account/wallet', { credentials: 'include' });
      const data = await res.json().catch(()=>null);
      if (!res.ok || !data?.ok){
        // Not logged in or API unavailable
        return;
      }
      currency = (data.main?.currency || data.defaultCurrency || 'EUR').toUpperCase();
      balance = Number(data.main?.balance ?? 0);
      clampBet();
      renderHands();
    }catch{}
  }

  async function apiWager(amount, meta){
    const res = await fetch('/api/casino/blackjack/wager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount, currency, meta })
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'WAGER_FAILED');
    return data;
  }

  async function apiPayout(amount, meta){
    const res = await fetch('/api/casino/blackjack/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount, currency, meta })
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'PAYOUT_FAILED');
    return data;
  }

  let dealerHand = [];
  let playerHand = [];
  let inRound = false;
  let dealerHoleHidden = true;
  let canDouble = false;

  // Bet modal state
  let pendingDelta = 0;

  // ====== Deck / Shoe ======
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  function buildShoe() {
    const cards = [];
    for (let d = 0; d < NUM_DECKS; d++) {
      for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function ensureShoe() {
    if (shoe.length < 52) shoe = buildShoe();
  }

  function draw() {
    ensureShoe();
    return shoe.pop();
  }

  // ====== Hand Value ======
  function cardValue(card) {
    if (card.r === "A") return 11;
    if (["K","Q","J"].includes(card.r)) return 10;
    return parseInt(card.r, 10);
  }

  function handTotals(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      total += cardValue(c);
      if (c.r === "A") aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    const raw = hand.reduce((sum,c)=>sum+cardValue(c),0);
    const isSoft = hand.some(c => c.r === "A") && raw !== total;
    return { total, isSoft };
  }

  function isBlackjack(hand) {
    return hand.length === 2 && handTotals(hand).total === 21;
  }

  // ====== Render ======
  function renderCard(card, faceDown=false) {
    const div = document.createElement("div");
    div.className = "card" + (faceDown ? " back" : "");

    if (faceDown) {
      div.style.background = `url("./assets/card-back.png") center/cover no-repeat`;
      div.style.borderColor = "#2c2c2c";
      return div;
    }

    const isRed = (card.s === "♥" || card.s === "♦");
    if (isRed) div.classList.add("red");

    const miniTop = document.createElement("div");
    miniTop.className = "mini";
    miniTop.textContent = `${card.r}${card.s}`;

    const miniBottom = document.createElement("div");
    miniBottom.className = "mini bottom";
    miniBottom.textContent = `${card.r}${card.s}`;

    const center = document.createElement("div");
    center.textContent = card.s;

    div.appendChild(miniTop);
    div.appendChild(center);
    div.appendChild(miniBottom);
    return div;
  }

  function renderHands() {
    dealerCardsEl.innerHTML = "";
    playerCardsEl.innerHTML = "";

    dealerHand.forEach((c, idx) => {
      const faceDown = (idx === 1 && dealerHoleHidden);
      dealerCardsEl.appendChild(renderCard(c, faceDown));
    });
    playerHand.forEach(c => playerCardsEl.appendChild(renderCard(c)));

    const dealerShown = dealerHoleHidden ? [dealerHand[0]] : dealerHand;

    dealerScoreEl.textContent = dealerHand.length
      ? (dealerHoleHidden
          ? `${handTotals(dealerShown).total} + ?`
          : `${handTotals(dealerHand).total}${handTotals(dealerHand).isSoft ? " (soft)" : ""}`)
      : "—";

    playerScoreEl.textContent = playerHand.length
      ? `${handTotals(playerHand).total}${handTotals(playerHand).isSoft ? " (soft)" : ""}`
      : "—";

    balanceEl.textContent = fmtMoney(balance);
    betEl.textContent = fmtMoney(bet);
    betTopEl.textContent = fmtMoney(bet);
  }

  function setMessage(txt) {
    messageEl.textContent = txt;
  }

  function setControls({ deal, hit, stand, dbl, betAdjust }) {
    dealBtn.disabled = !deal;
    hitBtn.disabled = !hit;
    standBtn.disabled = !stand;
    doubleBtn.disabled = !dbl;
    if (betAdjustBtn) betAdjustBtn.disabled = !betAdjust;
  }

  // ====== Betting clamp ======
  function clampBet() {
    bet = Math.max(MIN_BET, Math.min(MAX_BET, bet));
    if (bet > balance) bet = Math.max(MIN_BET, Math.min(balance, bet));
  }

  // ====== Round Flow ======
  async function startRound() {
    if (inRound) return;

    // если модалка открыта — не стартуем
    if (betModal && betModal.hidden === false) return;

    clampBet();
    if (bet > balance) {
      setMessage("Недостаточно баланса для ставки.");
      return;
    }

    inRound = true;
    dealerHoleHidden = true;
    canDouble = true;

    dealerHand = [draw(), draw()];
    playerHand = [draw(), draw()];

    // Debit real wallet on server
    try {
      setControls({ deal:false, hit:false, stand:false, dbl:false, betAdjust:false });
      setMessage("Ставка принимается...");
      const w = await apiWager(bet, { action: 'deal' });
      balance = Number(w.newBalance);
    } catch (e) {
      setMessage("Не удалось поставить. Проверьте баланс/авторизацию.");
      inRound = false;
      setControls({ deal:true, hit:false, stand:false, dbl:false, betAdjust:true });
      renderHands();
      return;
    }

    setControls({ deal:false, hit:true, stand:true, dbl:true, betAdjust:false });
    renderHands();

    const pBJ = isBlackjack(playerHand);
    const dBJ = isBlackjack(dealerHand);

    if (pBJ || dBJ) {
      dealerHoleHidden = false;
      renderHands();
      await settleBlackjack(pBJ, dBJ);
      return;
    }

    setMessage("Ваш ход: Hit / Stand / Double.");
  }

  async function settleBlackjack(pBJ, dBJ) {
  let payout = 0;

  if (pBJ && dBJ) {
    payout = bet; // refund
    setMessage("Push: у обоих Blackjack. Ставка возвращена.");
  } else if (pBJ) {
    payout = bet + bet * BLACKJACK_PAYOUT; // 2.5x total
    setMessage(`Blackjack! Выплата 3:2. Вы выиграли ${fmtMoney(bet * BLACKJACK_PAYOUT)}.`);
  } else {
    setMessage("У дилера Blackjack. Вы проиграли.");
  }

  if (payout > 0) {
    try {
      const p = await apiPayout(payout, { reason: "blackjack" });
      balance = Number(p.newBalance);
    } catch {}
  }

  endRound();
}

  function hit() {
    if (!inRound) return;

    playerHand.push(draw());
    canDouble = false;
    renderHands();

    const pt = handTotals(playerHand).total;
    if (pt > 21) {
      dealerHoleHidden = false;
      renderHands();
      setMessage("Bust! Вы перебрали. Проигрыш.");
      endRound();
      return;
    }

    setMessage("Ваш ход: Hit / Stand.");
    setControls({ deal:false, hit:true, stand:true, dbl:false, betAdjust:false });
  }

  async function stand() {
    if (!inRound) return;
    canDouble = false;
    setControls({ deal:false, hit:false, stand:false, dbl:false, betAdjust:false });
    await dealerPlay();
  }

  async function doubleDown() {
    if (!inRound) return;
    if (!canDouble || playerHand.length !== 2) return;

    if (balance < bet) {
      setMessage("Недостаточно баланса для Double.");
      return;
    }

    // Debit additional stake for Double
    try {
      setControls({ deal:false, hit:false, stand:false, dbl:false, betAdjust:false });
      setMessage("Double: ставка принимается...");
      const w = await apiWager(bet, { action: 'double' });
      balance = Number(w.newBalance);
    } catch (e) {
      setMessage("Не удалось сделать Double. Проверьте баланс/авторизацию.");
      setControls({ deal:false, hit:true, stand:true, dbl:true, betAdjust:false });
      renderHands();
      return;
    }

    bet *= 2;
    canDouble = false;

    playerHand.push(draw());
    renderHands();

    const pt = handTotals(playerHand).total;
    if (pt > 21) {
      dealerHoleHidden = false;
      renderHands();
      setMessage("Double: Bust. Проигрыш.");
      endRound();
      return;
    }

    setMessage("Double: авто Stand.");
    setControls({ deal:false, hit:false, stand:false, dbl:false, betAdjust:false });
    await dealerPlay();
  }

  async function dealerPlay() {
    dealerHoleHidden = false;
    renderHands();

    let { total: dt, isSoft } = handTotals(dealerHand);

    while (dt < 17 || (!DEALER_STANDS_SOFT_17 && dt === 17 && isSoft)) {
      dealerHand.push(draw());
      ({ total: dt, isSoft } = handTotals(dealerHand));
    }

    renderHands();
    await settleNormal();
  }

  async function settleNormal() {
  const pt = handTotals(playerHand).total;
  const dt = handTotals(dealerHand).total;

  let payout = 0;

  if (dt > 21) {
    payout = bet * 2;
    setMessage(`Дилер перебрал (${dt}). Вы выиграли ${fmtMoney(bet)}.`);
  } else if (pt > dt) {
    payout = bet * 2;
    setMessage(`Вы выиграли! ${pt} vs ${dt}. Профит ${fmtMoney(bet)}.`);
  } else if (pt < dt) {
    setMessage(`Вы проиграли. ${pt} vs ${dt}.`);
  } else {
    payout = bet; // refund
    setMessage(`Push. ${pt} vs ${dt}. Ставка возвращена.`);
  }

  if (payout > 0) {
    try {
      const p = await apiPayout(payout, { reason: "settle", playerTotal: pt, dealerTotal: dt });
      balance = Number(p.newBalance);
    } catch {}
  }

  endRound();
}

  function endRound() {
    inRound = false;
    clampBet();

    setControls({ deal:true, hit:false, stand:false, dbl:false, betAdjust:true });
    renderHands();

    if (balance <= 0) {
      setMessage("Баланс 0. Перезагрузите страницу или пополните баланс.");
      setControls({ deal:false, hit:false, stand:false, dbl:false, betAdjust:false });
    }
  }

  // ====== Bet Modal ======
  function openBetModal() {
    if (inRound) return;
    if (!betModal) return;

    pendingDelta = 0;
    if (pickDeltaEl) pickDeltaEl.textContent = "+0";
    if (betApply) betApply.disabled = true;

    if (carList) {
      carList.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
      // к плюсовой зоне
      carList.scrollLeft = Math.max(0, carList.scrollWidth / 2 - carList.clientWidth / 2);
    }

    betModal.hidden = false;

    // пока модалка открыта — не даём стартовать раунд
    dealBtn.disabled = true;
  }

  function closeBetModal() {
    if (!betModal) return;
    betModal.hidden = true;
    pendingDelta = 0;
    if (betApply) betApply.disabled = false;

    // возвращаем доступность Deal (если не в раунде)
    if (!inRound) dealBtn.disabled = false;
  }

  function setPendingDelta(v) {
    pendingDelta = v;
    if (pickDeltaEl) pickDeltaEl.textContent = (pendingDelta >= 0 ? `+${pendingDelta}` : `${pendingDelta}`);
    if (betApply) betApply.disabled = (pendingDelta === 0);
  }

  function applyDelta() {
    if (inRound) return;
    bet = bet + pendingDelta;
    clampBet();
    renderHands();
    closeBetModal();
  }

  // ====== Events ======
  dealBtn.addEventListener("click", startRound);
  hitBtn.addEventListener("click", hit);
  standBtn.addEventListener("click", stand);
  doubleBtn.addEventListener("click", doubleDown);

  if (betAdjustBtn) betAdjustBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openBetModal();
  });

  // ЖЕЛЕЗНОЕ закрытие по ✕ / Отмена / Добавить
  if (betCloseBtn) betCloseBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeBetModal();
  });

  if (betCancel) betCancel.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeBetModal();
  });

  if (betApply) betApply.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyDelta();
  });

  // Закрытие по клику вне окна (по оверлею)
  if (betModal) {
    betModal.addEventListener("pointerdown", (e) => {
      if (e.target === betModal) closeBetModal();
    });
  }

  // Закрытие по ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && betModal && betModal.hidden === false) closeBetModal();
  });

  // Выбор дельты
  if (carList) {
    carList.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const delta = parseInt(btn.dataset.delta, 10);

      carList.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      setPendingDelta(delta);
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  function scrollCarousel(dir) {
    if (!carList) return;
    carList.scrollBy({ left: dir * 220, behavior: "smooth" });
  }
  if (carLeft) carLeft.addEventListener("click", () => scrollCarousel(-1));
  if (carRight) carRight.addEventListener("click", () => scrollCarousel(1));

  // ====== Init ======
  // Sync real wallet (if user is logged in)
  window.addEventListener('DOMContentLoaded', () => { loadWallet(); });

  shoe = buildShoe();
  setControls({ deal:true, hit:false, stand:false, dbl:false, betAdjust:true });
  renderHands();
})();


// --- Tapbar spacer: keep content above fixed bottom bar (iOS safe-area friendly)
function syncTapbarHeight(){
  const tb = document.querySelector('.tapbar');
  if(!tb) return;
  const h = Math.ceil(tb.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--tapbarH', h + 'px');
}
window.addEventListener('resize', syncTapbarHeight);
window.addEventListener('orientationchange', syncTapbarHeight);
document.addEventListener('DOMContentLoaded', () => {
  // slight delay helps after iOS address bar settles
  syncTapbarHeight();
  setTimeout(syncTapbarHeight, 50);
  setTimeout(syncTapbarHeight, 250);
});

