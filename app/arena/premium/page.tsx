import ArenaShell from "@/app/arena/ArenaShell";

export default function PremiumPage() {
  return (
    <ArenaShell>
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="text-white/50 text-xs font-semibold tracking-[0.18em] uppercase">Premium</div>
        <h1 className="mt-2 text-3xl font-extrabold text-white">Оформить Premium</h1>
        <p className="mt-3 text-white/70 max-w-[70ch]">
          Здесь будет подписка и преимущества. Сейчас это заглушка — подключим оплату и уровни доступа.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-accent text-black font-extrabold px-5 py-3">
          Скоро
        </div>
      </div>
    </ArenaShell>
  );
}