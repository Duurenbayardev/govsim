import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, PollModel, VoteModel } from "@/lib/models";

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

  const body = await req.json().catch(() => null);
  const choice = body?.choice;
  if (choice !== "approve" && choice !== "deny") {
    return NextResponse.json({ error: "Invalid vote choice." }, { status: 400 });
  }

  await connectToDb();

  const member = await MemberModel.findOne({ sessionCode: sessionCode, token }).lean();
  if (!member || member.kickedAt) {
    return NextResponse.json({ error: "Member not found or kicked." }, { status: 401 });
  }

  const poll = await PollModel.findOne({ sessionCode: sessionCode, status: "open" })
    .sort({ startedAt: -1 })
    .lean();

  if (!poll) {
    return NextResponse.json({ error: "No active poll." }, { status: 400 });
  }

  const now = Date.now();
  const endsAt = new Date(poll.endsAt).getTime();
  if (now >= endsAt) {
    return NextResponse.json({ error: "Poll is closed." }, { status: 400 });
  }

  await VoteModel.updateOne(
    { pollId: poll._id, memberId: member._id },
    {
      $set: {
        pollId: poll._id,
        sessionCode: sessionCode,
        memberId: member._id,
        fullNameSnapshot: member.fullName,
        choice,
        votedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ myVote: choice });
}

