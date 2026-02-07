import { NextResponse } from "next/server";
import { oddsGet } from "@/lib/oddsApi";

// Returns list of sports (dynamic) from The Odds API
export async function GET() {
  const { data, usage } = await oddsGet<any[]>("/sports", {
    all: "false",
  });
  return NextResponse.json({ usage, data });
}
