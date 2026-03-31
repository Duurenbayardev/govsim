import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { MemberModel, SessionModel } from "@/lib/models";
import crypto from "crypto";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

const MEMBER_NAME_PATTERN = /^[А-ЯӨҮЁ][а-яөүё]+(?:-[А-ЯӨҮЁ][а-яөүё]+)*\.[А-ЯӨҮЁ]$/u;

export async function POST(req: Request) {
  try {
    await connectToDb();
  } catch {
    return NextResponse.json({ error: "Database connection failed." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const code = String(body.code ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Session code must be 6 digits." }, { status: 400 });
  }
  if (!MEMBER_NAME_PATTERN.test(fullName)) {
    return NextResponse.json({ error: "Нэрийг Батмөнх.А эсвэл Энх-Ариун.О хэлбэрээр оруулна уу." }, { status: 400 });
  }

  const session = await SessionModel.findOne({ code }).lean();
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const token = crypto.randomBytes(24).toString("hex");

  const member = await MemberModel.create({
    sessionCode: code,
    fullName,
    token,
  });

  return NextResponse.json({
    memberId: member._id.toString(),
    token,
  });
}

