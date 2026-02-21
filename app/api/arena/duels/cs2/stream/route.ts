import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listCs2Duels } from "@/lib/arenaDuels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response("UNAUTHORIZED", { status: 401 });

  const encoder = new TextEncoder();

  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send("hello", { ok: true });

      const interval = setInterval(() => {
        if (closed) return;
        try {
          const data = listCs2Duels(user.id);
          const duels = (data as any).duels || [];
          const open = duels.filter((d: any) => d.status === "open");
          const mine = duels.filter((d: any) => {
            const pls = Array.isArray(d.players) ? d.players : [];
            return d.p1_user_id === user.id || d.p2_user_id === user.id || pls.some((p: any) => p.user_id === user.id);
          });
          send("duels", { ok: true, open, mine, duels, myRating: (data as any).myRating, ratingName: (data as any).ratingName });
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          // ignore
        }
      }, 2500);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      };

      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
