import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { subscribeDm } from "@/lib/arenaDmBus";

function canAccessThread(db: any, userId: string, threadId: string) {
  const t = db
    .prepare("SELECT user1_id, user2_id FROM arena_dm_threads WHERE id = ?")
    .get(threadId) as { user1_id: string; user2_id: string } | undefined;
  if (!t) return false;
  return t.user1_id === userId || t.user2_id === userId;
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const threadId = String(searchParams.get("threadId") || "").trim();
  if (!threadId) return new NextResponse("bad_request", { status: 400 });

  const db = getDb();
  if (!canAccessThread(db, session.id, threadId)) return new NextResponse("forbidden", { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // hello
      send({ type: "hello" });

      const unsubscribe = subscribeDm(threadId, (msg) => {
        send({ type: "message", msg });
      });

      const keepAlive = setInterval(() => {
        send({ type: "ping", ts: Date.now() });
      }, 25000);

      // close handling
      // @ts-ignore
      req.signal?.addEventListener?.("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
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
