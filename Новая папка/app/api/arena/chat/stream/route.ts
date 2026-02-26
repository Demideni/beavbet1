import { subscribeChat } from "@/lib/arenaChatBus";

export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // initial hello (keeps EventSource happy)
      send({ type: "hello" });

      const unsub = subscribeChat((msg) => {
        send({ type: "msg", msg });
      });

      const keepAlive = setInterval(() => {
        send({ type: "ping", t: Date.now() });
      }, 25000);

      return () => {
        clearInterval(keepAlive);
        unsub();
      };
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
