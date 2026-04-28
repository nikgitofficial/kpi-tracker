import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AgentSession from "@/models/AgentSession";

/**
 * POST /api/kpi/session/end
 * Body: { agentId: string, date: string }
 *
 * Clocks the agent out by setting sessionEndEpoch.
 * Also closes any still-open bio break so totals stay accurate.
 */
export async function POST(req: NextRequest) {
  try {
    const auth_ = await auth();
    if (!auth_?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId, date } = await req.json();

    if (!agentId || !date)
      return NextResponse.json({ error: "Missing agentId or date" }, { status: 400 });

    await connectDB();

    const doc = await AgentSession.findOne({
      ownerEmail: auth_.user.email,
      agentId,
      date,
    });

    if (!doc)
      return NextResponse.json({ error: "No session found" }, { status: 404 });

    const now = Date.now();

    // Close any open break before ending the session
    let breaksClosed = false;
    for (const brk of doc.breaks) {
      if (!brk.endEpoch) {
        brk.endEpoch        = now;
        brk.durationSeconds = Math.floor((now - brk.startEpoch) / 1000);
        breaksClosed        = true;
      }
    }

    if (breaksClosed) {
      doc.totalBreakSeconds = doc.breaks.reduce(
        (acc: number, b: { durationSeconds?: number }) => acc + (b.durationSeconds ?? 0),
        0
      );
    }

    doc.sessionEndEpoch = now;
    await doc.save();

    return NextResponse.json({ session: doc });
  } catch (err) {
    console.error("[POST /api/kpi/session/end]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}