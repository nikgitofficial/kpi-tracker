import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

// POST /api/auth/verify-password
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password } = await req.json();
    if (!password)
      return NextResponse.json({ error: "Password required" }, { status: 400 });

    await connectDB();

    // Must select password explicitly since it has select: false
    const user = await User.findOne({ email: session.user.email }).select("+password");

    if (!user || !user.password) {
      // Google-only accounts have no password — deny edit access
      return NextResponse.json(
        { error: "No password set for this account. Use the app password instead." },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/verify-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}