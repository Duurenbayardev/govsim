import { NextResponse } from "next/server";
import { connectToDb } from "@/lib/mongodb";
import { SessionModel } from "@/lib/models";
import crypto from "crypto";

function generateSessionCode() {
  const num = crypto.randomInt(0, 1_000_000);
  return String(num).padStart(6, "0");
}

function generateAdminKey() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request) {
  await connectToDb();
  const body = await req.json().catch(() => null);
  const rawPlanned = body?.plannedAttendeeCount;
  const plannedAttendeeCount =
    typeof rawPlanned === "number"
      ? Math.max(0, Math.floor(rawPlanned))
      : typeof rawPlanned === "string" && rawPlanned.trim() !== ""
        ? Math.max(0, parseInt(rawPlanned, 10) || 0)
        : 0;

  for (let i = 0; i < 8; i++) {
    const code = generateSessionCode();
    const adminKey = generateAdminKey();
    try {
      const session = await SessionModel.create({ code, adminKey, plannedAttendeeCount });
      return NextResponse.json({
        code: session.code,
        adminKey: session.adminKey,
        plannedAttendeeCount: session.plannedAttendeeCount ?? 0,
      });
    } catch {
      // Likely duplicate code; retry.
    }
  }

  return NextResponse.json({ error: "Failed to create session. Try again." }, { status: 500 });
}

