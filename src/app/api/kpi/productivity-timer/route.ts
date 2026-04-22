import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProductivityTimer from "@/models/ProductivityTimer";

/* ─────────────────────────────────────────────────────────────
   GET /api/kpi/productivity-timer?agentId=xxx&date=YYYY-MM-DD
   Returns the timer record for an agent+date combo, plus the
   current server epoch so the client can correct clock skew.
───────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const date    = searchParams.get("date");

    if (!agentId || !date)
      return NextResponse.json(
        { error: "Missing agentId or date" },
        { status: 400 }
      );

    await connectDB();

    const record = await ProductivityTimer.findOne({
      ownerEmail: session.user.email,
      agentId,
      date,
    }).lean();

    // serverNow lets the client compute clock-skew offset
    return NextResponse.json({ record: record ?? null, serverNow: Date.now() });
  } catch (err) {
    console.error("[GET /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/kpi/productivity-timer
   Creates a timer record for an agent+date if one doesn't exist.
   Idempotent — returns existing record on duplicate.
───────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { agentId, agentName, date } = body;

    if (!agentId || !agentName || !date)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    await connectDB();

    // findOneAndUpdate with upsert is atomic — safe under concurrent requests
    // from thousands of agents hitting the endpoint simultaneously.
    const record = await ProductivityTimer.findOneAndUpdate(
      {
        ownerEmail: session.user.email,
        agentId,
        date,
      },
      {
        $setOnInsert: {
          ownerEmail:        session.user.email,
          agentId,
          agentName,
          date,
          productiveSeconds: 0,
          timerStartEpoch:   null,
          timerPaused:       false,
        },
      },
      {
        upsert:         true,
        new:            true,
        // runValidators ensures schema constraints are respected on insert
        runValidators:  true,
      }
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────
   PATCH /api/kpi/productivity-timer
   Partial update of timer fields.
   Accepts: { id, productiveSeconds?, timerStartEpoch?, timerPaused? }
───────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, productiveSeconds, timerStartEpoch, timerPaused } = body;

    if (!id)
      return NextResponse.json({ error: "Missing timer id" }, { status: 400 });

    await connectDB();

    const patch: Record<string, unknown> = {};

    if (productiveSeconds !== undefined)
      patch.productiveSeconds = Math.max(0, Number(productiveSeconds));

    // Explicit presence check — caller may want to explicitly set null
    if ("timerStartEpoch" in body)
      patch.timerStartEpoch = timerStartEpoch ?? null;

    if ("timerPaused" in body)
      patch.timerPaused = Boolean(timerPaused);

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const record = await ProductivityTimer.findOneAndUpdate(
      { _id: id, ownerEmail: session.user.email },
      { $set: patch },
      { new: true, runValidators: true }
    );

    if (!record)
      return NextResponse.json({ error: "Timer record not found" }, { status: 404 });

    return NextResponse.json({ record });
  } catch (err) {
    console.error("[PATCH /api/kpi/productivity-timer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}