import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { loadSessionSpeechFlags } from "@/lib/loadSessionSpeechFlags";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  
  if (!isValidCode(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const speech = await loadSessionSpeechFlags(sessionCode);
  if (!speech) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (!speech.isSpeechMode) {
    return NextResponse.json({ error: "Speech mode is not active." }, { status: 403 });
  }

  if (!speech.speechFeedbackOpen) {
    return NextResponse.json(
      { error: "Feedback is closed." },
      { status: 403 }
    );
  }

  // Member шалгах
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, hand_raised_at")
    .eq("session_code", sessionCode)
    .eq("token", token)
    .maybeSingle();

  if (memberError || !member || member.kicked_at) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Гар өргөлтийг toggle хийх
  const newHandRaisedAt = member.hand_raised_at ? null : new Date().toISOString();

  const { error: updateError } = await supabase
    .from("members")
    .update({ hand_raised_at: newHandRaisedAt })
    .eq("id", member.id);

  if (updateError) {
    console.error("Update error:", updateError);
    return NextResponse.json({ error: "Failed to update hand status." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    handRaisedAt: newHandRaisedAt,
  });
}