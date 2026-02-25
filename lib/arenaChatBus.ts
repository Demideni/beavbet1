type ChatMessage = {
  id: string;
  user_id: string;
  nickname: string | null;
  message: string;
  created_at: number;
  streamerBadge?: string | null;
};

// In-memory pub/sub for SSE. Works on a single Node process (Render).
// If you later scale to multiple instances, swap to Redis pub/sub.

type Subscriber = (msg: ChatMessage) => void;

const subs = new Set<Subscriber>();

export function subscribeChat(fn: Subscriber) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function broadcastChat(msg: ChatMessage) {
  for (const fn of subs) {
    try {
      fn(msg);
    } catch {
      // ignore
    }
  }
}

export type { ChatMessage };
