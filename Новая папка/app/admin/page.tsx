import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) {
    return (
      <div className="max-w-[1200px] mx-auto">
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

  if (!isAdminUser(session.id, session.email)) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="rounded-3xl card-glass p-6">
          <div className="text-white text-xl font-semibold">Доступ запрещён</div>
          <div className="mt-2 text-white/60">Эта страница только для админов.</div>
          <div className="mt-4">
            <Link href="/account" className="px-5 py-3 rounded-2xl bg-white/8 border border-white/10">← Кабинет</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white text-2xl font-extrabold tracking-tight">Админка</div>
          <div className="mt-1 text-white/60 text-sm">Игроки, балансы, афилка, выводы</div>
        </div>
        <Link href="/" className="px-4 py-2 rounded-2xl bg-white/8 border border-white/10 text-sm hover:bg-white/10">
          ← На главную
        </Link>
      </div>

      <div className="mt-6">
        <AdminPanel />
      </div>
    </div>
  );
}
