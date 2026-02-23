import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listArenaChatMessagesSince } from "@/lib/arenaChat";

export const runtime = "nodejs";

function enc(s: string) {
  return new TextEncoder().encode(s);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  let since = Number(url.searchParams.get("since") || 0);
  if (!Number.isFinite(since) || since < 0) since = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: string, data: any) => {
        if (closed) return;
        controller.enqueue(enc(`event: ${event}\n`));
        controller.enqueue(enc(`data: ${JSON.stringify(data)}\n\n`));
      };

      // initial hello
      send("hello", { ok: true });

      const tick = () => {
        try {
          const msgs = listArenaChatMessagesSince(since, 50);
          if (msgs.length) {
            since = msgs[msgs.length - 1].created_at;
            for (const m of msgs) send("message", m);
          } else {
            // keep-alive ping
            send("ping", { t: Date.now() });
          }
        } catch {
          // ignore transient db errors
        }
      };

      const interval = setInterval(tick, 1500);
      // run once quickly
      setTimeout(tick, 50);

      return () => {
        closed = true;
        clearInterval(interval);
      };
    },
    cancel() {
      // handled by start cleanup
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
