export type JoinInput = {
  duelId: string;
  userId: string;
};

export function joinCs2Duel({ duelId, userId }: JoinInput) {
  if (!duelId || !userId) {
    return { ok: false as const, error: "INVALID_DATA" as const };
  }

  return {
    ok: true as const,
    duelId,
    userId,
    message: "Joined successfully",
  };
}

export type ReadyInput = {
  duelId: string;
  userId: string;
};

export function setDuelReady({ duelId, userId }: ReadyInput) {
  if (!duelId || !userId) {
    return { ok: false as const, error: "INVALID_DATA" as const };
  }

  return {
    ok: true as const,
    duelId,
    userId,
    message: "Player is ready",
  };
}