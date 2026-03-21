import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { PollModel, SessionModel } from "@/lib/models";

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

  return NextResponse.json({ pollId: poll._id.toString() });
}

