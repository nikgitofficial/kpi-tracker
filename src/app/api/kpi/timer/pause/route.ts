import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProductivityTimer from "@/models/ProductivityTimer";

/**
 * POST /api/kpi/timer/pause
 * Body: { agentId: string, date: string }
 *
 * Pauses the running productivity timer for an agent.
 * Accumulates elapsed seconds into productiveSeconds before clearing
 * timerStartEpoch so no time is lost.
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

    const record = await ProductivityTimer.findOne({
      ownerEmail: auth_.user.email,
      agentId,
      date,
    });

    if (!record)
      return NextResponse.json({ error: "Timer record not found" }, { status: 404 });

    // Accumulate any live seconds before pausing
    let accumulated = record.productiveSeconds ?? 0;
    if (record.timerStartEpoch && !record.timerPaused) {
      const elapsed = Math.floor((Date.now() - record.timerStartEpoch) / 1000);
      if (elapsed > 0) accumulated += elapsed;
    }

    record.productiveSeconds = accumulated;
    record.timerStartEpoch   = null;
    record.timerPaused       = true;
    await record.save();

    return NextResponse.json({ record });
  } catch (err) {
    console.error("[POST /api/kpi/timer/pause]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}