// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import PulzBootOverlay from "@/components/PulzBootOverlay";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "BeavBet",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
  },
};

export const viewport = {
  themeColor: "#050a12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="bg-[#050a12] text-slate-100">
      <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
      <body className="bg-[#050a12] text-slate-100 antialiased">
        <PulzBootOverlay />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
