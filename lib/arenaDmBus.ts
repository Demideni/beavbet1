type DmMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  created_at: number;
};

// In-memory pub/sub for DM SSE. Works on a single Node process.
// If you later scale to multiple instances, swap to Redis pub/sub.

type Subscriber = (msg: DmMessage) => void;

const subsByThread = new Map<string, Set<Subscriber>>();

export function subscribeDm(threadId: string, fn: Subscriber) {
  const set = subsByThread.get(threadId) ?? new Set<Subscriber>();
  set.add(fn);
  subsByThread.set(threadId, set);
  return () => {
    const cur = subsByThread.get(threadId);
    if (!cur) return;
    cur.delete(fn);
    if (cur.size === 0) subsByThread.delete(threadId);
  };
}

export function broadcastDm(msg: DmMessage) {
  const set = subsByThread.get(msg.thread_id);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(msg);
    } catch {
      // ignore
    }
  }
}

export type { DmMessage };
