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

export type ReportInput = {
  duelId: string;
  userId: string;
  result: any;
};

export function reportDuelResult({ duelId, userId, result }: ReportInput) {
  if (!duelId || !userId || !result) {
    return { ok: false as const, error: "INVALID_DATA" as const };
  }

  return {
    ok: true as const,
    duelId,
    userId,
    result,
    message: "Result reported",
  };
}