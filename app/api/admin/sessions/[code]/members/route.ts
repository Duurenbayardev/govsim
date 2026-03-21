import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, SessionModel } from "@/lib/models";

export async function GET(
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

  const members = await MemberModel.find({ sessionCode }).sort({ joinedAt: 1 }).lean();
  return NextResponse.json({
    members: members.map((m) => ({
      id: m._id.toString(),
      fullName: m.fullName,
      joinedAt: new Date(m.joinedAt).toISOString(),
      kickedAt: m.kickedAt ? new Date(m.kickedAt).toISOString() : null,
    })),
  });
}

