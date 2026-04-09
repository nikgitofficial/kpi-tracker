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
  const { agentId, agentName, docType, companyName, volume, startTime, date, status, notes } = body;

  if (!agentId || !agentName || !docType || !companyName || !volume || !startTime || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  const txId = `TX${Date.now()}`;

  const tx = await Transaction.create({
    txId,
    agentId,
    agentName,
    docType,
    companyName,
    volume: Number(volume),
    startTime,
    date,
    status: status || "PENDING",
    notes: notes || undefined,
    ownerEmail: session.user.email,
  });

  return NextResponse.json({ transaction: tx }, { status: 201 });
}

// PATCH /api/kpi/transactions — update status/endTime/notes/docType/companyName/volume/startTime
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, endTime, notes, docType, companyName, volume, startTime } = await req.json();
  if (!id) return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

  await connectDB();

  const updateData: Record<string, unknown> = {};

  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (docType) updateData.docType = docType;
  if (companyName) updateData.companyName = companyName;
  if (volume !== undefined) updateData.volume = Number(volume);
  if (startTime) updateData.startTime = startTime;

  if (endTime) {
    updateData.endTime = endTime;

    const existing = await Transaction.findOne(
      { _id: id, ownerEmail: session.user.email }
    ).lean<{ startTime: string }>();

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resolvedStart = (startTime as string) || existing.startTime;
    const [sh, sm] = resolvedStart.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const tatSec = (eh * 60 + em - (sh * 60 + sm)) * 60;
    updateData.tat = tatSec >= 0 ? tatSec : 0;
  }

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