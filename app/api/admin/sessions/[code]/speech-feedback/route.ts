import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  const adminKey = req.headers.get("X-Admin-Key");

  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.open !== "boolean") {
    return NextResponse.json(
      { error: "Expected { open: boolean }." },
      { status: 400 }
    );
  }
  const open = body.open;

  const db = supabaseAdmin ?? supabase;

  const { data: session, error: sessionError } = await db
    .from("sessions")
    .select("admin_key, is_speech_mode")
    .eq("code", sessionCode)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Invalid admin key." }, { status: 401 });
  }
  if (!session.is_speech_mode) {
    return NextResponse.json(
      { error: "Speech mode is not active." },
      { status: 400 }
    );
  }

  const { error: updateError } = await db
    .from("sessions")
    .update({ speech_feedback_open: open })
    .eq("code", sessionCode);

  if (updateError) {
    const msg = `${updateError.message ?? ""} ${updateError.details ?? ""}`;
    if (/speech_feedback_open|column|42703|PGRST204|schema cache/i.test(msg)) {
      return NextResponse.json({
        success: true,
        speechFeedbackOpen: open,
        persisted: false,
      });
    }
    console.error("speech_feedback_open update:", updateError);
    return NextResponse.json(
      { error: "Failed to update feedback status.", details: updateError.message },
      { status: 500 }
    );
  }

  if (!open) {
    await db
      .from("members")
      .update({ hand_raised_at: null })
      .eq("session_code", sessionCode)
      .is("kicked_at", null);
  }

  return NextResponse.json({
    success: true,
    speechFeedbackOpen: open,
    persisted: true,
  });
}
