import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { getPollDurationSeconds } from "@/lib/pollDuration";
import { MemberModel, PollModel, VoteModel } from "@/lib/models";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function GET(
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

  await connectToDb();

  const member = await MemberModel.findOne({ sessionCode: sessionCode, token }).lean();
  if (!member || member.kickedAt) {
    return NextResponse.json({ error: "Member not found or kicked." }, { status: 401 });
  }

  const now = new Date();
  const poll = await PollModel.findOne({ sessionCode: sessionCode }).sort({ startedAt: -1 }).lean();

  const durationSeconds = poll ? getPollDurationSeconds(poll) : 0;
  const pollPayload =
    poll && poll.status === "open" && now.getTime() < new Date(poll.endsAt).getTime()
      ? {
          id: poll._id.toString(),
          problem: poll.problem,
          startedAt: poll.startedAt.toISOString(),
          endsAt: poll.endsAt.toISOString(),
          durationSeconds,
          isActive: true,
          status: poll.status,
        }
      : poll
        ? {
            id: poll._id.toString(),
            problem: poll.problem,
            startedAt: poll.startedAt.toISOString(),
            endsAt: poll.endsAt.toISOString(),
            durationSeconds,
            isActive: false,
            status: poll.status,
          }
        : null;

  if (!poll) {
    return NextResponse.json({
      poll: null,
      myVote: null,
      member: { fullName: member.fullName },
    });
  }

  const vote = await VoteModel.findOne({
    pollId: poll._id,
    memberId: member._id,
  }).lean();

  return NextResponse.json({
    poll: pollPayload,
    myVote: vote ? (vote.choice as "approve" | "deny") : null,
    member: { fullName: member.fullName },
  });
}

