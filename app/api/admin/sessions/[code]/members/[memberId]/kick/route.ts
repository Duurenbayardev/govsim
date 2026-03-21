import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, SessionModel } from "@/lib/models";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string; memberId: string }> }
) {
  const { code, memberId } = await context.params;
  const sessionCode = String(code ?? "");
  const adminKey = req.headers.get("X-Admin-Key") ?? "";
  const memberIdStr = String(memberId ?? "");

  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }
  if (!mongoose.Types.ObjectId.isValid(memberIdStr)) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  await connectToDb();

  const session = await SessionModel.findOne({ code: sessionCode }).lean();
  if (!session || session.adminKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  await MemberModel.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(memberIdStr), sessionCode },
    { $set: { kickedAt: now } }
  );

  return NextResponse.json({ ok: true });
}

