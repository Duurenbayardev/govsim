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

  const body = await req.json().catch(() => null);
  const problem = String(body?.problem ?? "").trim();
  if (problem.length < 3) {
    return NextResponse.json({ error: "Problem text is required." }, { status: 400 });
  }

  const rawDur = body?.durationSeconds;
  let durationSec = 10;
  if (typeof rawDur === "number" && Number.isFinite(rawDur)) {
    durationSec = Math.round(rawDur);
  } else if (typeof rawDur === "string" && rawDur.trim() !== "") {
    const n = parseInt(rawDur, 10);
    if (!Number.isNaN(n)) durationSec = n;
  }
  durationSec = Math.min(600, Math.max(5, durationSec));

  await connectToDb();

  const session = await SessionModel.findOne({ code: sessionCode }).lean();
  if (!session || session.adminKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + durationSec * 1000);

  // Ensure only one poll is open at a time.
  await PollModel.updateMany(
    { sessionCode, status: "open" },
    { $set: { status: "closed", closedAt: now, endsAt: now } }
  );

  const poll = await PollModel.create({
    sessionCode,
    problem,
    startedAt: now,
    endsAt,
    durationSeconds: durationSec,
    status: "open",
    closedAt: null,
  });

  return NextResponse.json({ pollId: poll._id.toString(), durationSeconds: durationSec });
}

