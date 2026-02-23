import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { subscribeUser } from "@/lib/arenaNotify";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // hello
      send({ type: "hello" });

      const unsubscribe = subscribeUser(session.id, (ev) => {
        send({ type: "event", ev });
      });

      const keepAlive = setInterval(() => {
        send({ type: "ping", ts: Date.now() });
      }, 25000);

      // @ts-ignore
      req.signal?.addEventListener?.("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
