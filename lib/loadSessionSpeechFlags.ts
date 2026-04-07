import { supabase, supabaseAdmin } from "@/lib/supabase";

export type SessionSpeechFlags = {
  isSpeechMode: boolean;
  speechFeedbackOpen: boolean;
  /** DB-д speech_feedback_open багана байгаа (бүрэн select амжилттай) */
  speechFeedbackInDb: boolean;
};

/**
 * Session-ийн санал хүсэлтийн төлөвийг унших.
 * Эхлээд service role (RLS алгасах), дараа нь anon — бичих/унших зөв ажиллана.
 */
export async function loadSessionSpeechFlags(
  sessionCode: string
): Promise<SessionSpeechFlags | null> {
  const primary = supabaseAdmin ?? supabase;

  const full = await primary
    .from("sessions")
    .select("is_speech_mode, speech_feedback_open")
    .eq("code", sessionCode)
    .maybeSingle();

  if (full.data) {
    const d = full.data as {
      is_speech_mode?: boolean;
      speech_feedback_open?: boolean | null;
    };
    return {
      isSpeechMode: !!d.is_speech_mode,
      speechFeedbackOpen: d.speech_feedback_open !== false,
      speechFeedbackInDb: true,
    };
  }

  const slim = await primary
    .from("sessions")
    .select("is_speech_mode")
    .eq("code", sessionCode)
    .maybeSingle();

  if (!slim.data) return null;

  return {
    isSpeechMode: !!slim.data.is_speech_mode,
    speechFeedbackOpen: true,
    speechFeedbackInDb: false,
  };
}
