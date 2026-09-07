import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAuth";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ email: auth.ctx.email });
}
