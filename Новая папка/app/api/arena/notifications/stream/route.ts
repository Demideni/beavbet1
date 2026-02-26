import { getSessionUser } from "@/lib/auth";
import { subscribeUser } from "@/lib/arenaNotify";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ type: "hello", ts: Date.now() });

      const unsub = subscribeUser(session.id, (ev) => send(ev));
      const keepAlive = setInterval(() => send({ type: "ping", ts: Date.now() }), 25000);

      cleanup = () => {
        clearInterval(keepAlive);
        unsub();
        try {
          controller.close();
        } catch {}
      };
    },
    cancel() {
      cleanup?.();
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
