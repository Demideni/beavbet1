import { subscribeChat } from "@/lib/arenaChatBus";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let unsub: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;

        try {
          controller.close();
        } catch {
          // ignore
        }

        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = null;
        }

        try {
          unsub?.();
        } catch {
          // ignore
        } finally {
          unsub = null;
        }
      };

      const send = (data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // If the client disconnected, enqueue will throw. Ensure we clean up.
          cleanup();
        }
      };

      // initial hello (keeps EventSource happy)
      send({ type: "hello" });

      unsub = subscribeChat((msg) => {
        send({ type: "msg", msg });
      });

      keepAlive = setInterval(() => {
        send({ type: "ping", t: Date.now() });
      }, 25000);

      // If the client disconnects (AbortSignal), clean up ASAP.
      try {
        req.signal.addEventListener("abort", cleanup, { once: true });
      } catch {
        // ignore
      }
    },

    cancel() {
      // Called when the consumer cancels the stream.
      if (closed) return;
      closed = true;

      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }

      try {
        unsub?.();
      } catch {
        // ignore
      } finally {
        unsub = null;
      }
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
