type JoinInput = {
  duelId: string;
  userId: string;
};

export function joinCs2Duel({ duelId, userId }: JoinInput) {
  if (!duelId || !userId) {
    return { ok: false, error: "INVALID_DATA" };
  }

  // пока просто мок-логика
  return {
    ok: true,
    duelId,
    userId,
    message: "Joined successfully",
  };
}