import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, productiveSeconds, timerStartEpoch, timerPaused } = body;
    if (!id) return NextResponse.json({ ok: false });
    await connectDB();
    // Only update productiveSeconds if the timerStartEpoch still matches what the client sent
    // and the timer is still in a running state (not paused/ended by another tab or action).
    // This prevents a stale beacon from overwriting a manual pause or end.
    await Transaction.findOneAndUpdate(
      {
        _id: id,
        timerStartEpoch: timerStartEpoch ?? null, // must still match
        timerPaused: false,                        // must still be running
      },
      {
        $set: {
          productiveSeconds: productiveSeconds ?? 0,
        },
      }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}