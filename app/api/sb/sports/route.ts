import { NextResponse } from "next/server";
import { oddsGet } from "@/lib/oddsApi";

export const dynamic = "force-dynamic";

// Returns list of sports (dynamic) from The Odds API
export async function GET() {
  try {
    const { data, usage } = await oddsGet<any[]>("/sports", { all: "false" });
    return NextResponse.json({ usage, data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch sports" },
      { status: 500 }
    );
  }
}
