import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listCs2Duels } from "@/lib/arenaDuels";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const data = listCs2Duels(user.id);
  if (!data.ok) return NextResponse.json(data, { status: 500 });

  const duels = (data as any).duels || [];
  const open = duels.filter((d: any) => d.status === "open");
  const mine = duels.filter((d: any) => {
    const pls = Array.isArray(d.players) ? d.players : [];
    return d.p1_user_id === user.id || d.p2_user_id === user.id || pls.some((p: any) => p.user_id === user.id);
  });

  return NextResponse.json({
    ok: true,
    open,
    mine,
    duels,
    myRating: (data as any).myRating,
    ratingName: (data as any).ratingName,
  });
}
