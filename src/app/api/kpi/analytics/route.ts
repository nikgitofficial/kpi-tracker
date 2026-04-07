import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";

// GET /api/kpi/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectDB();

  const query: Record<string, unknown> = { ownerEmail: session.user.email };
  if (from && to) {
    query.date = { $gte: from, $lte: to };
  } else if (from) {
    query.date = from;
  }

  const txs = await Transaction.find(query).lean();

  // Aggregate stats
  const totalTx = txs.length;
  const done = txs.filter((t) => t.status === "DONE").length;
  const pending = txs.filter((t) => t.status === "PENDING").length;
  const noDoc = txs.filter((t) => t.status === "NO_DOC").length;
  const escalated = txs.filter((t) => t.status === "ESCALATED").length;

  const tatsWithValue = txs.filter((t) => t.tat !== undefined && t.tat !== null);
  const avgTat = tatsWithValue.length
    ? Math.round(tatsWithValue.reduce((a, t) => a + (t.tat ?? 0), 0) / tatsWithValue.length)
    : 0;

  const completionRate = totalTx ? Math.round((done / totalTx) * 100) : 0;

  // Per-agent aggregation
  const agentMap: Record<string, { name: string; total: number; done: number; pending: number; noDoc: number; escalated: number; tatSum: number; tatCount: number }> = {};
  for (const tx of txs) {
    if (!agentMap[tx.agentId]) {
      agentMap[tx.agentId] = { name: tx.agentName, total: 0, done: 0, pending: 0, noDoc: 0, escalated: 0, tatSum: 0, tatCount: 0 };
    }
    const a = agentMap[tx.agentId];
    a.total++;
    if (tx.status === "DONE") a.done++;
    if (tx.status === "PENDING") a.pending++;
    if (tx.status === "NO_DOC") a.noDoc++;
    if (tx.status === "ESCALATED") a.escalated++;
    if (tx.tat !== undefined && tx.tat !== null) { a.tatSum += tx.tat; a.tatCount++; }
  }

  const agentStats = Object.entries(agentMap).map(([id, a]) => ({
    agentId: id,
    name: a.name,
    total: a.total,
    done: a.done,
    pending: a.pending,
    noDoc: a.noDoc,
    escalated: a.escalated,
    avgTat: a.tatCount ? Math.round(a.tatSum / a.tatCount) : 0,
    // FIX: exclude NO_DOC from rate denominator so it doesn't unfairly penalise agents
    rate: (a.done + a.pending + a.escalated) > 0
      ? Math.round((a.done / (a.done + a.pending + a.escalated)) * 100)
      : 0,
  // FIX: stable secondary sort by name so equal-rate agents don't randomly swap
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Per-docType aggregation
  const docMap: Record<string, { count: number; tatSum: number; tatCount: number }> = {};
  for (const tx of txs) {
    if (!docMap[tx.docType]) docMap[tx.docType] = { count: 0, tatSum: 0, tatCount: 0 };
    docMap[tx.docType].count++;
    if (tx.tat !== undefined && tx.tat !== null) { docMap[tx.docType].tatSum += tx.tat; docMap[tx.docType].tatCount++; }
  }
  const docTypeStats = Object.entries(docMap).map(([type, d]) => ({
    type,
    count: d.count,
    avgTat: d.tatCount ? Math.round(d.tatSum / d.tatCount) : 0,
  })).sort((a, b) => b.count - a.count);

  // Daily trend
  const dailyMap: Record<string, number> = {};
  for (const tx of txs) {
    dailyMap[tx.date] = (dailyMap[tx.date] ?? 0) + 1;
  }
  const dailyTrend = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    summary: { totalTx, done, pending, noDoc, escalated, avgTat, completionRate },
    agentStats,
    docTypeStats,
    dailyTrend,
  });
}