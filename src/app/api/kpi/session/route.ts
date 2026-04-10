import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AgentSession from "@/models/AgentSession";

// GET /api/kpi/session?agentId=xxx&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const date    = searchParams.get("date");

  await connectDB();

  const doc = await AgentSession.findOne({
    ownerEmail: session.user.email,
    agentId,
    date,
  }).lean();

  return NextResponse.json({ session: doc ?? null });
}

// POST /api/kpi/session — start (or retrieve) today's session for an agent
export async function POST(req: NextRequest) {
  const auth_ = await auth();
  if (!auth_?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, agentName, date } = await req.json();

  await connectDB();

  const doc = await AgentSession.findOneAndUpdate(
    { ownerEmail: auth_.user.email, agentId, date },
    {
      $setOnInsert: {
        agentId,
        agentName,
        date,
        ownerEmail:        auth_.user.email,
        sessionStartEpoch: Date.now(),
        breaks:            [],
        totalBreakSeconds: 0,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ session: doc });
}

// PATCH /api/kpi/session — START_BREAK | END_BREAK | END_SESSION
export async function PATCH(req: NextRequest) {
  const auth_ = await auth();
  if (!auth_?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, date, action, breakType, breakId } = await req.json();

  await connectDB();

  const doc = await AgentSession.findOne({
    ownerEmail: auth_.user.email,
    agentId,
    date,
  });

  if (!doc)
    return NextResponse.json({ error: "No session found" }, { status: 404 });

  if (action === "START_BREAK") {
    // Only allow one active break at a time
    const hasActive = doc.breaks.some((b: any) => !b.endEpoch);
    if (!hasActive) {
      doc.breaks.push({ type: breakType, startEpoch: Date.now() } as any);
    }
  } else if (action === "END_BREAK") {
    const brk = doc.breaks.find(
      (b: any) => b._id.toString() === breakId && !b.endEpoch
    );
    if (brk) {
      brk.endEpoch        = Date.now();
      brk.durationSeconds = Math.floor((brk.endEpoch - brk.startEpoch) / 1000);
      doc.totalBreakSeconds = doc.breaks.reduce(
        (a: number, b: any) => a + (b.durationSeconds ?? 0),
        0
      );
    }
  } else if (action === "END_SESSION") {
    doc.sessionEndEpoch = Date.now();
  }

  await doc.save();
  return NextResponse.json({ session: doc });
}