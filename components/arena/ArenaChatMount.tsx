"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// avoid SSR for EventSource
const ArenaChatWidget = dynamic(() => import("@/components/arena/ArenaChatWidget"), { ssr: false });

export default function ArenaChatMount() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/arena")) return null;
  return <ArenaChatWidget />;
}
