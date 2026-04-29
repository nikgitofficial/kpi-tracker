import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import ProductivityTimer from "@/models/ProductivityTimer";

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

  // Fetch regular transactions (filter out __PROD_TIMER__)
  const txs = await Transaction.find({ ...query, docType: { $ne: "__PROD_TIMER__" } }).lean();

  // Fetch timer records for productive time calculation
  const timerQuery: Record<string, unknown> = { ownerEmail: session.user.email };
  if (from && to) {
    timerQuery.date = { $gte: from, $lte: to };
  } else if (from) {
    timerQuery.date = from;
  }

  const timerRecords = await ProductivityTimer.find(timerQuery).lean();

  // Calculate total productive seconds with live running time
  const now = Date.now();
  let totalProductiveSeconds = 0;
  const agentProductiveSeconds: Record<string, number> = {};

  for (const timer of timerRecords) {
    let secs = timer.productiveSeconds ?? 0;
    if (timer.timerStartEpoch && !timer.timerPaused) {
      secs += Math.floor((now - timer.timerStartEpoch) / 1000);
    }
    totalProductiveSeconds += secs;
    agentProductiveSeconds[timer.agentId] = (agentProductiveSeconds[timer.agentId] ?? 0) + secs;
  }

  // ── Summary ──
  const totalTx   = txs.length;
  const done      = txs.filter((t) => t.status === "COMPLETION").length;
  const pending   = txs.filter((t) => t.status === "PENDING").length;
  const hold      = txs.filter((t) => t.status === "HOLD").length;
  const escalated = txs.filter((t) => t.status === "ESCALATION").length;

  const tatsWithValue = txs.filter((t) => t.tat !== undefined && t.tat !== null);
  const avgTat = tatsWithValue.length
    ? Math.round(tatsWithValue.reduce((a, t) => a + (t.tat ?? 0), 0) / tatsWithValue.length)
    : 0;

  // FIX: completion rate uses total TX as denominator (consistent with agent-level rate)
  const completionRate = totalTx ? Math.round((done / totalTx) * 100) : 0;

  // ── Per-agent aggregation ──
  const agentMap: Record<
    string,
    {
      name: string;
      total: number;
      done: number;
      pending: number;
      hold: number;
      escalated: number;
      tatSum: number;
      tatCount: number;
    }
  > = {};

  for (const tx of txs) {
    if (!agentMap[tx.agentId]) {
      agentMap[tx.agentId] = {
        name: tx.agentName,
        total: 0,
        done: 0,
        pending: 0,
        hold: 0,
        escalated: 0,
        tatSum: 0,
        tatCount: 0,
      };
    }
    const a = agentMap[tx.agentId];
    a.total++;
    if (tx.status === "COMPLETION") a.done++;
    if (tx.status === "PENDING")    a.pending++;
    if (tx.status === "HOLD")       a.hold++;
    if (tx.status === "ESCALATION") a.escalated++;
    if (tx.tat !== undefined && tx.tat !== null) {
      a.tatSum += tx.tat;
      a.tatCount++;
    }
  }

  const agentStats = Object.entries(agentMap)
    .map(([id, a]) => ({
      agentId:  id,
      name:     a.name,
      total:    a.total,
      done:     a.done,
      pending:  a.pending,
      hold:     a.hold,
      escalated: a.escalated,
      avgTat:   a.tatCount ? Math.round(a.tatSum / a.tatCount) : 0,
      productiveSeconds: agentProductiveSeconds[id] ?? 0,
      // FIX: rate = done / total (all statuses in denominator → honest completion rate)
      // Agents with 0 total get null so they are excluded from spotlight comparisons
      rate: a.total > 0 ? Math.round((a.done / a.total) * 100) : 0,
    }))
    // Stable sort: by total desc, then name asc
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // ── Per-agent daily rates (for streak alerts) ──
  const agentDailyRates: Record<string, { date: string; rate: number | null }[]> = {};

  if (from && to) {
    const dates: string[] = [];
    const cur = new Date(from + "T00:00:00");
    const end = new Date(to   + "T00:00:00");
    while (cur <= end) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }

    type DayBucket = { done: number; pending: number; hold: number; escalated: number; total: number };
    const agentDayMap: Record<string, Record<string, DayBucket>> = {};

    for (const tx of txs) {
      if (!agentDayMap[tx.agentId]) agentDayMap[tx.agentId] = {};
      if (!agentDayMap[tx.agentId][tx.date])
        agentDayMap[tx.agentId][tx.date] = { done: 0, pending: 0, hold: 0, escalated: 0, total: 0 };
      const b = agentDayMap[tx.agentId][tx.date];
      b.total++;
      if (tx.status === "COMPLETION") b.done++;
      if (tx.status === "PENDING")    b.pending++;
      if (tx.status === "HOLD")       b.hold++;
      if (tx.status === "ESCALATION") b.escalated++;
    }

    for (const agentId of Object.keys(agentMap)) {
      agentDailyRates[agentId] = dates.map((date) => {
        const b = agentDayMap[agentId]?.[date];
        if (!b || b.total === 0) return { date, rate: null };
        // FIX: daily rate also uses total (consistent with summary rate)
        return { date, rate: Math.round((b.done / b.total) * 100) };
      });
    }
  }

  // ── Per-docType aggregation ──
  const docMap: Record<string, { count: number; tatSum: number; tatCount: number }> = {};
  for (const tx of txs) {
    if (!docMap[tx.docType]) docMap[tx.docType] = { count: 0, tatSum: 0, tatCount: 0 };
    docMap[tx.docType].count++;
    if (tx.tat !== undefined && tx.tat !== null) {
      docMap[tx.docType].tatSum  += tx.tat;
      docMap[tx.docType].tatCount++;
    }
  }
  const docTypeStats = Object.entries(docMap)
    .map(([type, d]) => ({
      type,
      count:  d.count,
      avgTat: d.tatCount ? Math.round(d.tatSum / d.tatCount) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Daily trend ──
  const dailyMap: Record<string, number> = {};
  for (const tx of txs) {
    dailyMap[tx.date] = (dailyMap[tx.date] ?? 0) + 1;
  }
  const dailyTrend = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    summary: {
      totalTx,
      done,
      pending,
      hold,
      escalated,
      avgTat,
      completionRate,
      totalProductiveSeconds,
    },
    agentStats,
    docTypeStats,
    dailyTrend,
    agentDailyRates,
  });
}