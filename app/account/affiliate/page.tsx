import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import AffiliatePanel from "@/components/AffiliatePanel";

export default async function AffiliatePage() {
  const session = await getSessionUser();
  if (!session) {
    return (
      <div className="max-w-[980px] mx-auto">
        <div className="rounded-3xl card-glass p-6">
          <div className="text-white text-xl font-semibold">Нужно войти</div>
          <div className="mt-4 flex gap-2">
            <Link href="/auth?tab=login" className="px-5 py-3 rounded-2xl btn-accent font-semibold">Войти</Link>
            <Link href="/" className="px-5 py-3 rounded-2xl bg-white/8 border border-white/10">На главную</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[980px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white text-2xl font-extrabold tracking-tight">Афилка</div>
          <div className="mt-1 text-white/60 text-sm">Реферальная ссылка, доход и вывод средств</div>
        </div>
        <Link href="/account" className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10">
          ← Кабинет
        </Link>
      </div>

      <div className="mt-6">
        <AffiliatePanel />
      </div>
    </div>
  );
}
