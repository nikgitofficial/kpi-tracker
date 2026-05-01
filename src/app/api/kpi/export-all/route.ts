// app/api/kpi/export-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import Agent from "@/models/Agent";
import DocType from "@/models/DocType";

// Import these models if they exist in your project:
// import AgentSession from "@/models/AgentSession";
// import ProductivityTimer from "@/models/ProductivityTimer";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");
    const agentId  = searchParams.get("agentId") ?? undefined;
    const collection = searchParams.get("collection") ?? "all"; // all | transactions | agents | docTypes | sessions | timers

    await connectDB();

    const email = session.user.email;
    const result: Record<string, unknown> = {};

    // ── Transactions ──
    if (collection === "all" || collection === "transactions") {
      const txQuery: Record<string, unknown> = { ownerEmail: email };
      if (dateFrom) txQuery.date = { ...((txQuery.date as object) ?? {}), $gte: dateFrom };
      if (dateTo)   txQuery.date = { ...((txQuery.date as object) ?? {}), $lte: dateTo };
      if (agentId)  txQuery.agentId = agentId;

      result.transactions = await Transaction.find(txQuery).sort({ date: -1, createdAt: -1 }).lean();
    }

    // ── Agents ──
    if (collection === "all" || collection === "agents") {
      // Try different model names depending on your schema
      try {
        const AgentModel = (await import("@/models/Agent")).default;
        result.agents = await AgentModel.find({ ownerEmail: email }).lean();
      } catch {
        // fallback: get unique agents from transactions
        const txs = await Transaction.find({ ownerEmail: email }).select("agentId agentName").lean();
        const agentMap = new Map<string, { _id: string; name: string }>();
        txs.forEach((t) => {
          if (!agentMap.has(t.agentId)) agentMap.set(t.agentId, { _id: t.agentId, name: t.agentName });
        });
        result.agents = Array.from(agentMap.values());
      }
    }

    // ── Doc Types ──
    if (collection === "all" || collection === "docTypes") {
      try {
        result.docTypes = await DocType.find({ ownerEmail: email }).lean();
      } catch {
        // If DocType model has email field instead
        try {
          const DT = (await import("@/models/DocType")).default;
          result.docTypes = await DT.find({ email }).lean();
        } catch {
          result.docTypes = [];
        }
      }
    }

    // ── Sessions (Bio breaks) ──
    if (collection === "all" || collection === "sessions") {
      try {
        const SessionModel = (await import("@/models/AgentSession")).default;
        const sessionQuery: Record<string, unknown> = { ownerEmail: email };
        if (dateFrom) sessionQuery.date = { ...((sessionQuery.date as object) ?? {}), $gte: dateFrom };
        if (dateTo)   sessionQuery.date = { ...((sessionQuery.date as object) ?? {}), $lte: dateTo };
        if (agentId)  sessionQuery.agentId = agentId;
        result.sessions = await SessionModel.find(sessionQuery).lean();
      } catch {
        result.sessions = [];
      }
    }

    // ── Productivity Timers ──
    if (collection === "all" || collection === "timers") {
      try {
        const TimerModel = (await import("@/models/ProductivityTimer")).default;
        const timerQuery: Record<string, unknown> = { ownerEmail: email };
        if (dateFrom) timerQuery.date = { ...((timerQuery.date as object) ?? {}), $gte: dateFrom };
        if (dateTo)   timerQuery.date = { ...((timerQuery.date as object) ?? {}), $lte: dateTo };
        if (agentId)  timerQuery.agentId = agentId;
        result.timers = await TimerModel.find(timerQuery).lean();
      } catch {
        result.timers = [];
      }
    }

    result.exportedAt = new Date().toISOString();
    result.exportedBy = email;

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/kpi/export-all]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}