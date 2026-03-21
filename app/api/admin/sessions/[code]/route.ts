import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, PollModel, SessionModel, VoteModel } from "@/lib/models";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const adminKey = req.headers.get("X-Admin-Key") ?? "";
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  await connectToDb();

  const session = await SessionModel.findOne({ code: sessionCode }).lean();
  if (!session || session.adminKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const polls = await PollModel.find({ sessionCode }).select("_id").lean();
  const pollIds = polls.map((p) => p._id);

  if (pollIds.length > 0) {
    await VoteModel.deleteMany({ pollId: { $in: pollIds } });
  }
  await PollModel.deleteMany({ sessionCode });
  await MemberModel.deleteMany({ sessionCode });
  await SessionModel.deleteOne({ code: sessionCode });

  return NextResponse.json({ ok: true });
}
