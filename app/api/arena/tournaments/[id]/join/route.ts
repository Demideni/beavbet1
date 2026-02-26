import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  getTournament,
  getTournamentPlayersCount,
  startTournamentIfFull,
} from "@/lib/arena";
import { lockFunds } from "@/lib/wallet";

/**
 * POST /api/arena/tournaments/[id]/join
 * Совместимость с ArenaClient.tsx
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Авторизация
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // В Next 15 params — это Promise
    const { id } = await params;
    const tournamentId = String(id || "").trim();

    if (!tournamentId) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const tournament = getTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (tournament.status !== "open") {
      return NextResponse.json(
        { ok: false, error: "NOT_OPEN" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Проверяем, не участвует ли уже
    const already = db
      .prepare(
        "SELECT 1 as x FROM arena_participants WHERE tournament_id = ? AND user_id = ?"
      )
      .get(tournamentId, user.id) as { x: number } | undefined;

    if (already?.x) {
      return NextResponse.json({ ok: true, joined: true });
    }

    // Проверяем лимит игроков
    const count = getTournamentPlayersCount(tournamentId);
    if (count >= tournament.max_players) {
      return NextResponse.json(
        { ok: false, error: "FULL" },
        { status: 400 }
      );
    }

    // Блокируем средства
    const lock = lockFunds(
      user.id,
      tournament.currency,
      tournament.entry_fee,
      tournamentId
    );

    if (!lock.ok) {
      return NextResponse.json(
        { ok: false, error: lock.error || "INSUFFICIENT_FUNDS" },
        { status: 400 }
      );
    }

    // Добавляем участника
    db.prepare(
      `
      INSERT INTO arena_participants 
      (id, tournament_id, user_id, joined_at) 
      VALUES (?,?,?,?)
    `
    ).run(randomUUID(), tournamentId, user.id, Date.now());

    // Если турнир заполнился — стартуем
    startTournamentIfFull(tournamentId);

    return NextResponse.json({ ok: true, joined: true });
  } catch (err) {
    console.error("JOIN_TOURNAMENT_ERROR:", err);

    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}