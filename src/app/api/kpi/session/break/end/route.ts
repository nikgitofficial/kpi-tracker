import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AgentSession from "@/models/AgentSession";

/**
 * POST /api/kpi/session/break/end
 * Body: { agentId: string }
 *
 * Closes the currently open bio break for today's session.
 * Recalculates totalBreakSeconds from all completed breaks.
 */
export async function POST(req: NextRequest) {
  try {
    const auth_ = await auth();
    if (!auth_?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await req.json();

    if (!agentId)
      return NextResponse.json({ error: "Missing agentId" }, { status: 400 });

    const date = new Date().toISOString().split("T")[0];

    await connectDB();

    const doc = await AgentSession.findOne({
      ownerEmail: auth_.user.email,
      agentId,
      date,
    });

    if (!doc)
      return NextResponse.json({ error: "No session found" }, { status: 404 });

    const now    = Date.now();
    const active = doc.breaks.find((b: { endEpoch?: number }) => !b.endEpoch);

    if (!active)
      return NextResponse.json({ error: "No active break found" }, { status: 409 });

    active.endEpoch        = now;
    active.durationSeconds = Math.floor((now - active.startEpoch) / 1000);

    doc.totalBreakSeconds = doc.breaks.reduce(
      (acc: number, b: { durationSeconds?: number }) => acc + (b.durationSeconds ?? 0),
      0
    );

    await doc.save();

    return NextResponse.json({ session: doc });
  } catch (err) {
    console.error("[POST /api/kpi/session/break/end]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}