import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { getPollDurationSeconds } from "@/lib/pollDuration";
import { MemberModel, PollModel, SessionModel, VoteModel } from "@/lib/models";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
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

  await connectToDb();

  const session = await SessionModel.findOne({ code: sessionCode }).lean();
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const eligibleMemberCount = await MemberModel.countDocuments({
    sessionCode: sessionCode,
    kickedAt: null,
  });
  const plannedAttendeeCount = Math.max(0, Number(session.plannedAttendeeCount ?? 0));

  let poll = await PollModel.findOne({ sessionCode: sessionCode }).sort({ startedAt: -1 }).lean();
  const now = new Date();

  if (poll && poll.status === "open" && now.getTime() >= new Date(poll.endsAt).getTime()) {
    await PollModel.updateOne(
      { _id: poll._id, status: "open" },
      { $set: { status: "closed", closedAt: now, endsAt: now } }
    );
    const eligibleMembers = await MemberModel.find({ sessionCode, kickedAt: null })
      .select({ _id: 1, fullName: 1 })
      .lean();
    const existingVotes = await VoteModel.find({ pollId: poll._id }).select({ memberId: 1 }).lean();
    const votedSet = new Set(existingVotes.map((v) => v.memberId.toString()));
    const missing = eligibleMembers.filter((m) => !votedSet.has(m._id.toString()));
    const anon = poll.anonymous === true;
    const snapshotFor = (fullName: string) => (anon ? "Нууц" : fullName);
    if (missing.length > 0) {
      await VoteModel.bulkWrite(
        missing.map((m) => ({
          updateOne: {
            filter: { pollId: poll!._id, memberId: m._id },
            update: {
              $set: {
                pollId: poll!._id,
                sessionCode: sessionCode,
                memberId: m._id,
                fullNameSnapshot: snapshotFor(m.fullName),
                choice: "deny",
                votedAt: now,
              },
            },
            upsert: true,
          },
        }))
      );
    }
    poll = await PollModel.findById(poll._id).lean();
  }

  if (!poll) {
    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
      poll: null,
      results: null,
      attendance: {
        eligibleMemberCount,
        plannedAttendeeCount,
        votesCastCount: 0,
        voteParticipationPercent: 0,
      },
    });
  }

  const isActive = poll.status === "open" && now.getTime() < new Date(poll.endsAt).getTime();
  const durationSeconds = getPollDurationSeconds(poll);
  const pollPayload = {
    id: poll._id.toString(),
    problem: poll.problem,
    startedAt: poll.startedAt.toISOString(),
    endsAt: poll.endsAt.toISOString(),
    durationSeconds,
    closedAt: poll.closedAt ? new Date(poll.closedAt).toISOString() : null,
    status: poll.status as "open" | "closed",
    isActive,
    anonymous: poll.anonymous === true,
  };

  const votesCastCount = await VoteModel.countDocuments({ pollId: poll._id });
  const voteParticipationPercent =
    eligibleMemberCount > 0 ? Math.round((votesCastCount / eligibleMemberCount) * 1000) / 10 : 0;

  const attendance = {
    eligibleMemberCount,
    plannedAttendeeCount,
    votesCastCount,
    voteParticipationPercent,
  };

  if (isActive) {
    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
      poll: pollPayload,
      results: null,
      attendance,
    });
  }

  const votes = await VoteModel.find({ pollId: poll._id }).lean();
  const totalVotes = votes.length;
  const approveCount = votes.filter((v) => v.choice === "approve").length;
  const denyCount = votes.filter((v) => v.choice === "deny").length;

  const approvePercent = totalVotes ? (approveCount / totalVotes) * 100 : 0;
  const denyPercent = totalVotes ? (denyCount / totalVotes) * 100 : 0;

  const isAnonymous = poll.anonymous === true;
  const approve = isAnonymous
    ? []
    : votes
        .filter((v) => v.choice === "approve")
        .map((v) => ({ memberId: v.memberId.toString(), fullName: v.fullNameSnapshot }));
  const deny = isAnonymous
    ? []
    : votes
        .filter((v) => v.choice === "deny")
        .map((v) => ({ memberId: v.memberId.toString(), fullName: v.fullNameSnapshot }));

  return NextResponse.json({
    sessionCode: sessionCode,
    nowISO: now.toISOString(),
    poll: pollPayload,
    results: {
      totalVotes,
      approveCount,
      denyCount,
      approvePercent,
      denyPercent,
      approve,
      deny,
      anonymous: isAnonymous,
    },
    attendance: {
      eligibleMemberCount,
      plannedAttendeeCount,
      votesCastCount: totalVotes,
      voteParticipationPercent:
        eligibleMemberCount > 0 ? Math.round((totalVotes / eligibleMemberCount) * 1000) / 10 : 0,
    },
  });
}
