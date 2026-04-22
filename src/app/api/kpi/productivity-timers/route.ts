// app/api/kpi/productivity-timers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import ProductivityTimer from "@/models/ProductivityTimer";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");

    await connectDB();

    let dateFilter = {};
    if (from && to) {
      dateFilter = { date: { $gte: from, $lte: to } };
    } else if (from) {
      dateFilter = { date: from };
    } else if (to) {
      dateFilter = { date: to };
    } else if (date) {
      dateFilter = { date };
    }

    const timers = await ProductivityTimer.find({
      ownerEmail: session.user.email,
      ...dateFilter,
    }).lean();

    return NextResponse.json({ timers: timers ?? [] });
  } catch (err) {
    console.error("[GET /api/kpi/productivity-timers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}