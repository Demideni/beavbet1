(() => {
  const $ = (id) => document.getElementById(id);

  const elBal = $("bal");
  const elMult = $("mult");
  const elHint = $("hint");
  const elBet = $("bet");
  const elBtnBet = $("btnBet");
  const elBtnCash = $("btnCash");
  const elStatus = $("status");
  const elLast = $("last");
  const elToast = $("toast");

  let balance = 0;
  let roundId = null;
  let bet = 1;
  let raf = 0;

  const fmt = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(elToast._t);
    elToast._t = setTimeout(() => elToast.classList.remove("show"), 1800);
  }

  async function getApi() {
    const api = window.PULZ_GAME;
    if (!api) throw new Error("CASINO_API_NOT_READY");
    return api;
  }

  async function refreshBalance() {
    try {
      const api = await getApi();
      balance = await api.getBalance();
      elBal.textContent = fmt(balance);
    } catch (e) {
      elBal.textContent = "—";
    }
  }

  function setIdleUi() {
    elStatus.textContent = "Idle";
    elHint.textContent = "Готов к взлёту";
    elMult.textContent = "x1.00";
    elBtnBet.disabled = false;
    elBtnCash.disabled = true;
    roundId = null;
  }

  function setRunningUi() {
    elStatus.textContent = "Flying";
    elHint.textContent = "Лови момент и жми CASH OUT";
    elBtnBet.disabled = true;
    elBtnCash.disabled = false;
  }

  function setCrashedUi(crash) {
    elStatus.textContent = "Crashed";
    elHint.textContent = "Самолёт улетел 😵";
    elBtnBet.disabled = false;
    elBtnCash.disabled = true;
    elLast.textContent = "Last: x" + Number(crash || 1).toFixed(2);
  }

  function setCashedUi(mult) {
    elStatus.textContent = "Cashed";
    elHint.textContent = "Забрал на x" + Number(mult || 1).toFixed(2);
    elBtnBet.disabled = false;
    elBtnCash.disabled = true;
  }

  async function onBet() {
    bet = Number(elBet.value || 0);
    if (!Number.isFinite(bet) || bet <= 0) return toast("Неверная ставка");

    try {
      const api = await getApi();
      elBtnBet.disabled = true;
      const res = await api.placeBet(bet);
      roundId = res.roundId;
      balance = Number(res.balance ?? balance);
      elBal.textContent = fmt(balance);

      window.AviatorGame.startRound({ roundId, bet });
      setRunningUi();
      toast("Ставка принята");
    } catch (e) {
      elBtnBet.disabled = false;
      toast("Не удалось поставить");
      refreshBalance();
    }
  }

  async function onCashOut() {
    try {
      const api = await getApi();
      const res = window.AviatorGame.cashOut();
      if (!res) return;
      elBtnCash.disabled = true;

      const j = await api.cashOut({ roundId: res.roundId, multiplier: res.multiplier });
      balance = Number(j.balance ?? balance);
      elBal.textContent = fmt(balance);

      setCashedUi(res.multiplier);
      elLast.textContent = "Last: x" + Number(res.multiplier).toFixed(2);

      // cleanup context
      await api.finishRound({ roundId: res.roundId, result: "cashout" });
      roundId = null;

      toast("Выплата зачислена");
    } catch (e) {
      toast("Ошибка выплаты");
      refreshBalance();
    }
  }

  function loop() {
    const g = window.AviatorGame?.state;
    if (g) {
      elMult.textContent = "x" + Number(g.mult).toFixed(2);

      if (g.running) {
        elBtnCash.textContent = "CASH OUT • " + fmt(bet * g.mult);
      } else {
        elBtnCash.textContent = "CASH OUT";
      }

      if (g.crashed) {
        // round ended by crash
        elBtnCash.disabled = true;
        if (roundId) {
          const crash = g.crashPoint;
          setCrashedUi(crash);
          // cleanup context (no payout)
          getApi()
            .then((api) => api.finishRound({ roundId, result: "crash", crashPoint: crash }))
            .then(() => refreshBalance())
            .catch(() => {});
          roundId = null;
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function wire() {
    elBtnBet.addEventListener("click", onBet);
    elBtnCash.addEventListener("click", onCashOut);

    document.querySelectorAll(".chip").forEach((b) => {
      b.addEventListener("click", () => {
        const v = Number(b.getAttribute("data-chip") || 0);
        const cur = Number(elBet.value || 0);
        const next = Math.max(0.1, cur + v);
        elBet.value = String(Math.round(next * 100) / 100);
      });
    });

    // keyboard: space = cashout
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        if (!elBtnCash.disabled) onCashOut();
      }
    });
  }

  window.AviatorUI = {
    async init() {
      wire();
      await refreshBalance();
      setIdleUi();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    refreshBalance,
  };
})();
