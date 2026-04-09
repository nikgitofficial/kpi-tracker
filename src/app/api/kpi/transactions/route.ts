import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";

// GET /api/kpi/transactions?date=YYYY-MM-DD&agentId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const agentId = searchParams.get("agentId");

  await connectDB();

  const query: Record<string, string> = { ownerEmail: session.user.email };
  if (date) query.date = date;
  if (agentId) query.agentId = agentId;

  const transactions = await Transaction.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ transactions });
}

// POST /api/kpi/transactions — create a new transaction
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    agentId, agentName, docType, companyName, volume,
    date, status, notes,
    startEpoch,      // unix ms — replaces startTime string
    elapsedSeconds,  // always 0 on create
  } = body;

  if (!agentId || !agentName || !docType || !companyName || !volume || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  const txId = `TX${Date.now()}`;

  // Keep startTime as a human-readable string for legacy display / export
  const startTime = new Date(startEpoch ?? Date.now()).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const tx = await Transaction.create({
    txId,
    agentId,
    agentName,
    docType,
    companyName,
    volume: Number(volume),
    startTime,
    startEpoch: startEpoch ?? Date.now(),
    date,
    status: status || "PENDING",
    notes: notes || undefined,
    ownerEmail: session.user.email,
    elapsedSeconds: elapsedSeconds ?? 0,
    pausedAt: null,
  });

  return NextResponse.json({ transaction: tx }, { status: 201 });
}

// PATCH /api/kpi/transactions — update timer state, status, end, or metadata
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    id,
    // timer fields
    elapsedSeconds,
    pausedAt,        // null = running, number = unix ms when paused
    tat,             // final elapsed seconds, set on end
    endEpoch,        // unix ms when ended
    // end fields
    endTime,         // human-readable HH:mm string for display
    status,
    notes,
    // editable metadata
    docType,
    companyName,
    volume,
    startTime,       // legacy string, only set in edit modal
  } = body;

  if (!id) return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

  await connectDB();

  const updateData: Record<string, unknown> = {};

  // Timer state
  if (elapsedSeconds !== undefined) updateData.elapsedSeconds = Number(elapsedSeconds);
  if (pausedAt !== undefined) updateData.pausedAt = pausedAt; // null or number
  if (tat !== undefined) updateData.tat = Number(tat);
  if (endEpoch !== undefined) updateData.endEpoch = endEpoch;

  // End / status
  if (endTime) updateData.endTime = endTime;
  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  // Editable metadata
  if (docType) updateData.docType = docType;
  if (companyName) updateData.companyName = companyName;
  if (volume !== undefined) updateData.volume = Number(volume);
  if (startTime) updateData.startTime = startTime;

  const tx = await Transaction.findOneAndUpdate(
    { _id: id, ownerEmail: session.user.email },
    { $set: updateData },
    { new: true }
  );

  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ transaction: tx });
}

// DELETE /api/kpi/transactions { id }
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await connectDB();
  await Transaction.deleteOne({ _id: id, ownerEmail: session.user.email });
  return NextResponse.json({ success: true });
}