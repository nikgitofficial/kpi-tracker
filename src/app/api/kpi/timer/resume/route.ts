import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProductivityTimer from "@/models/ProductivityTimer";

/**
 * POST /api/kpi/timer/resume
 * Body: { agentId: string, date: string }
 *
 * Resumes a paused productivity timer by setting a fresh timerStartEpoch
 * and clearing the timerPaused flag.
 * Accumulated seconds from before the pause are preserved in productiveSeconds.
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

    record.timerStartEpoch = Date.now();
    record.timerPaused     = false;
    await record.save();

    return NextResponse.json({ record });
  } catch (err) {
    console.error("[POST /api/kpi/timer/resume]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}