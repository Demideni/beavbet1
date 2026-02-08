import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBalance } from "@/lib/robinson";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const balance = getBalance(user.id, "USD");
  return NextResponse.json({ balance });
}
