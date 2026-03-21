import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, VoteModel } from "@/lib/models";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  if (!isValidCode(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const token = getBearerToken(_req);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  await connectToDb();

  const member = await MemberModel.findOne({ sessionCode, token }).lean();
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await VoteModel.deleteMany({ memberId: member._id });
  await MemberModel.deleteOne({ _id: member._id });

  return NextResponse.json({ ok: true });
}
