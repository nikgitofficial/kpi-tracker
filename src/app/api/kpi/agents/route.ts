// app/api/kpi/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Agent from "@/models/Agent";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const agents = await Agent.find({ email: session.user.email }).sort({ group: 1, name: 1 }).lean();
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, group } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();
  const exists = await Agent.findOne({ email: session.user.email, name: name.trim() });
  if (exists) return NextResponse.json({ error: "Agent already exists" }, { status: 409 });

  const agent = await Agent.create({ name: name.trim(), group: group?.trim() || undefined, email: session.user.email });
  return NextResponse.json({ agent }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, group } = await req.json();
  if (!id) return NextResponse.json({ error: "Agent ID required" }, { status: 400 });

  await connectDB();
  const agent = await Agent.findOneAndUpdate(
    { _id: id, email: session.user.email },
    { $set: { group: group?.trim() || undefined } },
    { new: true }
  );
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await connectDB();
  await Agent.deleteOne({ _id: id, email: session.user.email });
  return NextResponse.json({ success: true });
}