import type { SupabaseClient } from "@supabase/supabase-js";
import { getPollDurationSeconds } from "@/lib/pollDuration";

const AUTO_DENY_GRACE_MS = 3000;

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

export type ScreenResponse = {
  sessionCode: string;
  nowISO: string;
  isSpeechMode?: boolean;
  /** Санал хүсэлтийн горимд гар өргөхийг зөвшөөрөх эсэх (F-ээр нээлттэй/хаалттай) */
  speechFeedbackOpen?: boolean;
  /** DB-д speech_feedback_open багана байвал sync-ээр нөхөн тохируулна */
  speechFeedbackInDb?: boolean;
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    closedAt: string | null;
    status: "open" | "closed";
    isActive: boolean;
    anonymous?: boolean;
  } | null;
  results: null | {
    totalVotes: number;
    approveCount: number;
    denyCount: number;
    approvePercent: number;
    denyPercent: number;
    approve: Array<{ memberId: string; fullName: string }>;
    deny: Array<{ memberId: string; fullName: string }>;
    anonymous?: boolean;
  };
  attendance?: {
    eligibleMemberCount: number;
    plannedAttendeeCount?: number;
    votesCastCount: number;
    voteParticipationPercent: number;
  };
};

export async function loadSessionScreenState(
  client: SupabaseClient,
  sessionCode: string
): Promise<{ ok: true; data: ScreenResponse } | { ok: false; error: string }> {
  if (!client) {
    return { ok: false, error: "Системийн тохиргоо (Supabase) хийгдээгүй байна." };
  }
  if (!isValidCode(sessionCode)) {
    return { ok: false, error: "Invalid session code." };
  }

  const { data: session, error: sessionError } = await client
    .from("sessions")
    .select("*")
    .eq("code", sessionCode)
    .single();

  if (sessionError || !session) {
    return { ok: false, error: "Session not found." };
  }

  const { count: eligibleMemberCount, error: memberCountError } = await client
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("session_code", sessionCode)
    .is("kicked_at", null);

  if (memberCountError) {
    console.error("Member count error:", memberCountError);
  }

  const plannedAttendeeCount = Math.max(0, Number(session.planned_attendee_count ?? 0));
  const sess = session as Record<string, unknown>;
  const speechFeedbackInDb = Object.prototype.hasOwnProperty.call(sess, "speech_feedback_open");
  const speechFeedbackOpen = speechFeedbackInDb
    ? (sess.speech_feedback_open as boolean) !== false
    : true;

  let { data: poll } = await client
    .from("polls")
    .select("*")
    .eq("session_code", sessionCode)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  if (
    poll &&
    poll.status === "open" &&
    now.getTime() >= new Date(poll.ends_at).getTime() + AUTO_DENY_GRACE_MS
  ) {
    const { data: updatedPoll, error: closeError } = await client
      .from("polls")
      .update({ status: "closed", closed_at: now.toISOString() })
      .eq("id", poll.id)
      .select()
      .single();

    if (closeError) {
      console.error("Error closing poll:", closeError);
    } else if (updatedPoll) {
      poll = updatedPoll;
    }

    const { data: eligibleMembers } = await client
      .from("members")
      .select("id, full_name")
      .eq("session_code", sessionCode)
      .is("kicked_at", null);

    const { data: existingVotes } = await client
      .from("votes")
      .select("member_id")
      .eq("poll_id", poll!.id);

    const votedSet = new Set(existingVotes?.map((v: { member_id: string }) => v.member_id));
    const missing = eligibleMembers?.filter((m: { id: string }) => !votedSet.has(m.id)) || [];

    const anon = poll.anonymous === true;
    const snapshotFor = (fullName: string) => (anon ? "Нууц" : fullName);

    if (missing.length > 0) {
      const autoDenyVotes = missing.map((m: { id: string; full_name: string }) => ({
        poll_id: poll!.id,
        session_code: sessionCode,
        member_id: m.id,
        full_name_snapshot: snapshotFor(m.full_name),
        choice: "deny" as const,
        voted_at: now.toISOString(),
      }));

      const { error: insertError } = await client.from("votes").insert(autoDenyVotes);
      if (insertError) {
        console.error("Error inserting auto-deny votes:", insertError);
      }
    }
  }

  if (!poll) {
    const votesCastCount = 0;
    const voteParticipationPercent = (eligibleMemberCount || 0) > 0 ? 0 : 0;

    return {
      ok: true,
      data: {
        sessionCode,
        nowISO: now.toISOString(),
        isSpeechMode: !!session.is_speech_mode,
        speechFeedbackOpen,
        speechFeedbackInDb,
        poll: null,
        results: null,
        attendance: {
          eligibleMemberCount: eligibleMemberCount || 0,
          plannedAttendeeCount,
          votesCastCount,
          voteParticipationPercent,
        },
      },
    };
  }

  const isActive = poll.status === "open" && now.getTime() < new Date(poll.ends_at).getTime();
  const durationSeconds = getPollDurationSeconds({
    durationSeconds: poll.duration_seconds,
    startedAt: new Date(poll.started_at),
    endsAt: new Date(poll.ends_at),
  });

  const pollPayload = {
    id: poll.id,
    problem: poll.problem,
    startedAt: poll.started_at,
    endsAt: poll.ends_at,
    durationSeconds,
    closedAt: poll.closed_at,
    status: poll.status as "open" | "closed",
    isActive,
    anonymous: poll.anonymous === true,
  };

  let votesCastCount = 0;
  let totalVotes = 0;
  let approveCount = 0;
  let denyCount = 0;
  let approvePercent = 0;
  let denyPercent = 0;
  let approve: Array<{ memberId: string; fullName: string }> = [];
  let deny: Array<{ memberId: string; fullName: string }> = [];

  if (!isActive) {
    const { data: votes, error: votesError } = await client
      .from("votes")
      .select("*")
      .eq("poll_id", poll.id);

    if (!votesError && votes) {
      totalVotes = votes.length;
      approveCount = votes.filter((v: { choice: string }) => v.choice === "approve").length;
      denyCount = votes.filter((v: { choice: string }) => v.choice === "deny").length;
      votesCastCount = totalVotes;

      approvePercent = totalVotes ? (approveCount / totalVotes) * 100 : 0;
      denyPercent = totalVotes ? (denyCount / totalVotes) * 100 : 0;

      const isAnonymous = poll.anonymous === true;
      if (!isAnonymous) {
        approve = votes
          .filter((v: { choice: string }) => v.choice === "approve")
          .map((v: { member_id: string; full_name_snapshot: string }) => ({
            memberId: v.member_id,
            fullName: v.full_name_snapshot,
          }));
        deny = votes
          .filter((v: { choice: string }) => v.choice === "deny")
          .map((v: { member_id: string; full_name_snapshot: string }) => ({
            memberId: v.member_id,
            fullName: v.full_name_snapshot,
          }));
      }
    }
  } else {
    const { count, error: countError } = await client
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", poll.id);

    if (!countError) {
      votesCastCount = count || 0;
    }
  }

  const voteParticipationPercent =
    (eligibleMemberCount || 0) > 0
      ? Math.round((votesCastCount / (eligibleMemberCount || 1)) * 1000) / 10
      : 0;

  const attendance = {
    eligibleMemberCount: eligibleMemberCount || 0,
    plannedAttendeeCount,
    votesCastCount,
    voteParticipationPercent,
  };

  if (isActive) {
    return {
      ok: true,
      data: {
        sessionCode,
        nowISO: now.toISOString(),
        isSpeechMode: !!session.is_speech_mode,
        speechFeedbackOpen,
        speechFeedbackInDb,
        poll: pollPayload,
        results: null,
        attendance,
      },
    };
  }

  return {
    ok: true,
    data: {
      sessionCode,
      nowISO: now.toISOString(),
      isSpeechMode: !!session.is_speech_mode,
      speechFeedbackOpen,
      speechFeedbackInDb,
      poll: pollPayload,
      results: {
        totalVotes,
        approveCount,
        denyCount,
        approvePercent,
        denyPercent,
        approve,
        deny,
        anonymous: poll.anonymous === true,
      },
      attendance,
    },
  };
}
