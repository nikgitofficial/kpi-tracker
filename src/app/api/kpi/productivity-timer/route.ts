import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";

// GET /api/kpi/productivity-timer?agentId=xxx&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const date = searchParams.get("date");

    if (!agentId || !date)
      return NextResponse.json({ error: "Missing agentId or date" }, { status: 400 });

    await connectDB();

    const record = await Transaction.findOne({
      ownerEmail: session.user.email,
      agentId,
      date,
      docType: "__PROD_TIMER__",
    }).lean();

    return NextResponse.json({ record: record ?? null });
  } catch (err) {
    console.error("[GET /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/kpi/productivity-timer — create timer record
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId, agentName, date } = await req.json();
    if (!agentId || !agentName || !date)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    await connectDB();

    // Upsert — only create if not already exists
    const existing = await Transaction.findOne({
      ownerEmail: session.user.email,
      agentId,
      date,
      docType: "__PROD_TIMER__",
    });

    if (existing) return NextResponse.json({ record: existing });

    const record = await Transaction.create({
      txId: `TIMER-${Date.now()}`,
      agentId,
      agentName,
      docType: "__PROD_TIMER__",
      companyName: "__timer__",
      volume: 1,
      startTime: "00:00",
      startEpoch: Date.now(),
      date,
      status: "PENDING",
      ownerEmail: session.user.email,
      taskCategory: "Non-Production",
      productiveSeconds: 0,
      timerStartEpoch: null,
      timerPaused: false,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/kpi/productivity-timer — update timer fields
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, productiveSeconds, timerStartEpoch, timerPaused } = body;

    if (!id)
      return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await connectDB();

    const updateData: Record<string, unknown> = {};
    if (productiveSeconds !== undefined) updateData.productiveSeconds = Number(productiveSeconds);
    if ("timerStartEpoch" in body) updateData.timerStartEpoch = timerStartEpoch ?? null;
    if ("timerPaused" in body) updateData.timerPaused = timerPaused ?? false;

    const record = await Transaction.findOneAndUpdate(
      { _id: id, ownerEmail: session.user.email },
      { $set: updateData },
      { new: true }
    );

    if (!record)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ record });
  } catch (err) {
    console.error("[PATCH /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}