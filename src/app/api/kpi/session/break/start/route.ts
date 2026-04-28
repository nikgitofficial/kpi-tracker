import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AgentSession from "@/models/AgentSession";

/**
 * POST /api/kpi/session/break/start
 * Body: { agentId: string }
 *
 * Starts a BIO break for today's session.
 * Enforces one active break at a time.
 * Auto-creates the session document if it doesn't exist yet.
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

    // Auto-create session if it doesn't exist (graceful fallback)
    let doc = await AgentSession.findOne({
      ownerEmail: auth_.user.email,
      agentId,
      date,
    });

    if (!doc) {
      doc = await AgentSession.create({
        ownerEmail:        auth_.user.email,
        agentId,
        date,
        sessionStartEpoch: Date.now(),
        breaks:            [],
        totalBreakSeconds: 0,
      });
    }

    // Only one active break at a time
    const hasActive = doc.breaks.some((b: { endEpoch?: number }) => !b.endEpoch);
    if (hasActive)
      return NextResponse.json({ error: "A break is already active" }, { status: 409 });

    doc.breaks.push({ type: "BIO", startEpoch: Date.now() });
    await doc.save();

    return NextResponse.json({ session: doc });
  } catch (err) {
    console.error("[POST /api/kpi/session/break/start]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}