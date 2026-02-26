import { NextRequest } from "next/server";
import { handleImageUpload } from "../_utils";

export async function POST(req: NextRequest) {
  return handleImageUpload(req, "rooms");
}