import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await context.params;
  const code = String(rawCode ?? "");
  const adminKey = req.headers.get("X-Admin-Key");

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  const db = supabaseAdmin ?? supabase;

  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("admin_key")
    .eq("code", code)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Invalid admin key." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Expected { active: boolean }." }, { status: 400 });
  }
  const { active } = body;

  const main = await db
    .from("sessions")
    .update({ is_speech_mode: active })
    .eq("code", code);

  if (main.error) {
    console.error("Update error:", main.error);
    return NextResponse.json(
      { error: "Failed to update speech mode.", details: main.error.message },
      { status: 500 }
    );
  }

  if (active) {
    const open = await db.from("sessions").update({ speech_feedback_open: true }).eq("code", code);
    if (open.error) {
      console.warn("speech_feedback_open (optional):", open.error.message);
    }
  }

  if (!active) {
    await db.from("members").update({ hand_raised_at: null }).eq("session_code", code);
  }

  return NextResponse.json({ success: true, isSpeechMode: active });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("is_speech_mode")
    .eq("code", code)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ isSpeechMode: session.is_speech_mode });
}