import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, PollModel, SessionModel, VoteModel } from "@/lib/models";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  const adminKey = req.headers.get("X-Admin-Key") ?? "";

  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  await connectToDb();

  const session = await SessionModel.findOne({ code: sessionCode }).lean();
  if (!session || session.adminKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const poll = await PollModel.findOneAndUpdate(
    { sessionCode, status: "open" },
    { $set: { status: "closed", closedAt: now, endsAt: now } },
    { sort: { startedAt: -1 }, new: true }
  ).lean();

  if (!poll) {
    return NextResponse.json({ error: "No open poll to close." }, { status: 400 });
  }

  const eligibleMembers = await MemberModel.find({ sessionCode, kickedAt: null })
    .select({ _id: 1, fullName: 1 })
    .lean();
  const existingVotes = await VoteModel.find({ pollId: poll._id }).select({ memberId: 1 }).lean();
  const votedSet = new Set(existingVotes.map((v) => v.memberId.toString()));
  const missing = eligibleMembers.filter((m) => !votedSet.has(m._id.toString()));

  if (missing.length > 0) {
    await VoteModel.bulkWrite(
      missing.map((m) => ({
        updateOne: {
          filter: { pollId: poll._id, memberId: m._id },
          update: {
            $set: {
              pollId: poll._id,
              sessionCode,
              memberId: m._id,
              fullNameSnapshot: m.fullName,
              choice: "deny",
              votedAt: now,
            },
          },
          upsert: true,
        },
      }))
    );
  }

  return NextResponse.json({ pollId: poll._id.toString() });
}

