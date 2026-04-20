import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import DocType from "@/models/DocType";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const docTypes = await DocType.find({ email: session.user.email }).sort({ name: 1 }).lean();
  return NextResponse.json({ docTypes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, taskCategory, countType } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();
  const exists = await DocType.findOne({ email: session.user.email, name: name.trim() });
  if (exists) return NextResponse.json({ error: "Doc type already exists" }, { status: 409 });

  const docType = await DocType.create({
    name: name.trim(),
    email: session.user.email,
    taskCategory: taskCategory ?? "Production",
    countType: countType ?? "transaction",
  });
  return NextResponse.json({ docType }, { status: 201 });
}
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, taskCategory, countType } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await connectDB();

  const updateData: Record<string, unknown> = {};
  if (name?.trim()) updateData.name = name.trim();
  if (taskCategory)  updateData.taskCategory = taskCategory;
  if (countType)     updateData.countType = countType;

  const docType = await DocType.findOneAndUpdate(
    { _id: id, email: session.user.email },
    { $set: updateData },
    { new: true }
  );
  if (!docType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ docType });
}


export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await connectDB();
  await DocType.deleteOne({ _id: id, email: session.user.email });
  return NextResponse.json({ success: true });
}