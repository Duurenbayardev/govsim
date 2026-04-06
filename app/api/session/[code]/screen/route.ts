import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { loadSessionScreenState } from "@/lib/sessionScreenState";

export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");

  const result = await loadSessionScreenState(supabase, sessionCode);

  if (!result.ok) {
    const msg = result.error;
    if (msg === "Invalid session code.") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg === "Session not found.") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("тохиргоо")) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
