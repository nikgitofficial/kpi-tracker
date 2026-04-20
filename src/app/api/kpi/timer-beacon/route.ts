import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, productiveSeconds, timerStartEpoch, timerPaused } = body;
    if (!id) return NextResponse.json({ ok: false });
    await connectDB();
    await Transaction.findByIdAndUpdate(id, {
      $set: {
        productiveSeconds: productiveSeconds ?? 0,
        timerStartEpoch: timerStartEpoch ?? null,
        timerPaused: timerPaused ?? false,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}