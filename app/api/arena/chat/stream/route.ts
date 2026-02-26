import { NextRequest } from "next/server";

// Robust SSE stream: never throws if client disconnects (Render will restart process on uncaught exceptions)
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;
  let interval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeClose = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        interval = null;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // If the controller is already closed, don't crash the process.
          safeClose();
        }
      };

      // Initial comment to open the stream immediately
      send(`: ok\n\n`);

      // Keepalive ping (some proxies cut idle connections)
      interval = setInterval(() => {
        send(`event: ping\ndata: {}\n\n`);
      }, 25_000);

      // Close on disconnect / abort
      const onAbort = () => safeClose();
      try {
        req.signal.addEventListener("abort", onAbort, { once: true });
      } catch {
        // ignore
      }
    },
    cancel() {
      // Called when the client disconnects
      closed = true;
      if (interval) clearInterval(interval);
      interval = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // For Nginx proxies, prevents buffering SSE
      "X-Accel-Buffering": "no",
    },
  });
}
