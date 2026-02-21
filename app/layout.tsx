import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/app/components/Sidebar";
import { Topbar } from "@/app/components/Topbar";
import { MobileNav } from "@/app/components/MobileNav";
import RefCapture from "@/app/components/RefCapture";
import { Suspense } from "react";
import DepositBoostToast from "@/components/DepositBoostToast";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import LanguageGate from "@/components/i18n/LanguageGate";
import { LANG_COOKIE } from "@/lib/i18n";


export const metadata: Metadata = {
  title: "BeavBet — Crypto Only",
  description: "BeavBet lobby (MVP UI).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLang = cookies().get(LANG_COOKIE)?.value ?? null;

  return (
    <html lang={initialLang ?? "en"}>
      <body>
        <I18nProvider initialLang={initialLang}>
          {/* Language select on first visit */}
          <LanguageGate />

          {/* RefCapture uses useSearchParams(), so it must be wrapped in Suspense */}
          <Suspense fallback={null}>
            <RefCapture />
          </Suspense>

          <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <Topbar />
              {/* leave space for bottom nav on mobile */}
              <main className="px-4 lg:px-6 py-4 lg:py-7 pb-24 md:pb-6">
                <div className="max-w-[1400px] mx-auto">{children}</div>
              </main>
            </div>
          </div>

          {/* Deposit boost toast */}
          <DepositBoostToast minutes={30} percent={170} />

          {/* Mobile bottom tab bar (matches the reference mobile UI) */}
          <MobileNav />
        </I18nProvider>
      </body>
    </html>
  );
}
