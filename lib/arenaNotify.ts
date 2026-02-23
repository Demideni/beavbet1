type NotifyEvent =
  | { type: "friend_request"; fromUserId: string; fromNick?: string | null; createdAt: number }
  | { type: "friend_accepted"; byUserId: string; byNick?: string | null; createdAt: number }
  | { type: "dm_message"; fromUserId: string; fromNick?: string | null; threadId: string; createdAt: number; preview: string }
  | { type: "gift"; fromUserId: string; fromNick?: string | null; amount: number; currency: string; createdAt: number };

type Listener = (ev: NotifyEvent) => void;

// In-memory pubsub (works on single instance). If you scale to multiple instances, swap to Redis.
const listenersByUser = new Map<string, Set<Listener>>();

export function subscribeUser(userId: string, cb: Listener) {
  const set = listenersByUser.get(userId) ?? new Set<Listener>();
  set.add(cb);
  listenersByUser.set(userId, set);
  return () => {
    const s = listenersByUser.get(userId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) listenersByUser.delete(userId);
  };
}

export function publishToUser(userId: string, ev: NotifyEvent) {
  const s = listenersByUser.get(userId);
  if (!s) return;
  for (const cb of s) {
    try {
      cb(ev);
    } catch {}
  }
}
