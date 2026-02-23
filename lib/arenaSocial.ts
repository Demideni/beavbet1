import { randomUUID } from "node:crypto";

export function normalizePair(a: string, b: string) {
  return a < b ? [a, b] as const : [b, a] as const;
}

export function getOrCreateDmThread(db: any, meId: string, otherId: string) {
  const [u1, u2] = normalizePair(meId, otherId);
  const existing = db
    .prepare("SELECT id FROM arena_dm_threads WHERE user1_id = ? AND user2_id = ?")
    .get(u1, u2) as { id: string } | undefined;
  if (existing?.id) return existing.id;

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    "INSERT INTO arena_dm_threads (id, user1_id, user2_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, u1, u2, now, now);
  return id;
}

export function upsertFriendRequest(db: any, meId: string, otherId: string) {
  if (meId === otherId) return { ok: false, error: "SELF" } as const;
  const now = Date.now();

  // If already friends either direction
  const accepted = db
    .prepare(
      "SELECT 1 FROM arena_friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted' LIMIT 1"
    )
    .get(meId, otherId, otherId, meId);
  if (accepted) return { ok: true, status: "accepted" } as const;

  // If they already requested me, accept both sides
  const incoming = db
    .prepare("SELECT status FROM arena_friends WHERE user_id = ? AND friend_id = ?")
    .get(otherId, meId) as { status: string } | undefined;
  if (incoming?.status === "pending") {
    db.prepare(
      "INSERT OR REPLACE INTO arena_friends (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'accepted', COALESCE((SELECT created_at FROM arena_friends WHERE user_id=? AND friend_id=?), ?), ?)"
    ).run(otherId, meId, otherId, meId, now, now);
    db.prepare(
      "INSERT OR REPLACE INTO arena_friends (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'accepted', COALESCE((SELECT created_at FROM arena_friends WHERE user_id=? AND friend_id=?), ?), ?)"
    ).run(meId, otherId, meId, otherId, now, now);
    return { ok: true, status: "accepted" } as const;
  }

  // Otherwise create pending request me -> other
  db.prepare(
    "INSERT OR REPLACE INTO arena_friends (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'pending', COALESCE((SELECT created_at FROM arena_friends WHERE user_id=? AND friend_id=?), ?), ?)"
  ).run(meId, otherId, meId, otherId, now, now);

  return { ok: true, status: "pending" } as const;
}

export function acceptFriend(db: any, meId: string, otherId: string) {
  const now = Date.now();
  const incoming = db
    .prepare("SELECT status FROM arena_friends WHERE user_id = ? AND friend_id = ?")
    .get(otherId, meId) as { status: string } | undefined;
  if (!incoming) return { ok: false, error: "NOT_FOUND" } as const;

  db.prepare(
    "INSERT OR REPLACE INTO arena_friends (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'accepted', COALESCE((SELECT created_at FROM arena_friends WHERE user_id=? AND friend_id=?), ?), ?)"
  ).run(otherId, meId, otherId, meId, now, now);
  db.prepare(
    "INSERT OR REPLACE INTO arena_friends (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'accepted', COALESCE((SELECT created_at FROM arena_friends WHERE user_id=? AND friend_id=?), ?), ?)"
  ).run(meId, otherId, meId, otherId, now, now);

  return { ok: true } as const;
}

export function removeFriendOrRequest(db: any, meId: string, otherId: string) {
  db.prepare("DELETE FROM arena_friends WHERE user_id = ? AND friend_id = ?").run(meId, otherId);
  db.prepare("DELETE FROM arena_friends WHERE user_id = ? AND friend_id = ?").run(otherId, meId);
  return { ok: true } as const;
}
