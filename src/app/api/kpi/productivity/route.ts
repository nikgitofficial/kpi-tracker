// app/api/kpi/productivity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import Agent from "@/models/Agent";
import ProductivityTimer from "@/models/ProductivityTimer";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  await connectDB();

  const agents = await Agent.find({ email: session.user.email }).lean();
  const agentGroupMap: Record<string, string> = {};
  const agentNameMap:  Record<string, string> = {};
  for (const a of agents) {
    agentGroupMap[String(a._id)] = a.group ?? "Ungrouped";
    agentNameMap[a.name]         = a.group ?? "Ungrouped";
  }

  const query: Record<string, unknown> = {
    ownerEmail: session.user.email,
    docType:    { $ne: "__PROD_TIMER__" },
  };
  if (from && to)  query.date = { $gte: from, $lte: to };
  else if (from)   query.date = from;

  const txs = await Transaction.find(query).lean();

  // ── UPDATED: Use ProductivityTimer model instead of querying Transaction ──
  const timerQuery: Record<string, unknown> = {
    ownerEmail: session.user.email,
  };
  if (from && to)  timerQuery.date = { $gte: from, $lte: to };
  else if (from)   timerQuery.date = from;

  const timerRecords = await ProductivityTimer.find(timerQuery).lean();

  // Build productivity seconds per agent
  // The model's productiveSeconds already includes the persisted time.
  // For active timers (timerStartEpoch set, timerPaused false), we add live elapsed time.
  const now = Date.now();
  const agentProductivitySeconds: Record<string, number> = {};
  
  for (const timer of timerRecords) {
    const key = timer.agentId;
    let secs = timer.productiveSeconds ?? 0;
    
    // If timer is actively running (not paused and has a start epoch), add live elapsed time
    if (timer.timerStartEpoch && !timer.timerPaused) {
      const liveElapsed = Math.floor((now - timer.timerStartEpoch) / 1000);
      secs += liveElapsed;
    }
    
    agentProductivitySeconds[key] = (agentProductivitySeconds[key] ?? 0) + secs;
  }

  const agentMap: Record<string, {
    agentId:             string;
    agentName:           string;
    group:               string;
    totalTat:            number;
    tatCount:            number;
    totalVolume:         number;
    txCount:             number;
    completion:          number;
    pending:             number;
    escalation:          number;
    hold:                number;
    productionCount:     number;
    nonProductionCount:  number;
    subtaskCount:        number;
    docTypeCounts:       Record<string, number>;
    volumeByDocType:     Record<string, number>;
    companiesSet:        Set<string>;
  }> = {};

  const globalDocTypeCounts: Record<string, number> = {};
  const dailyDocTypeCounts:  Record<string, Record<string, number>> = {};

  for (const tx of txs) {
    if (!agentMap[tx.agentId]) {
      agentMap[tx.agentId] = {
        agentId:            tx.agentId,
        agentName:          tx.agentName,
        group:              agentGroupMap[String(tx.agentId)] ?? agentNameMap[tx.agentName] ?? "Ungrouped",
        totalTat:           0,
        tatCount:           0,
        totalVolume:        0,
        txCount:            0,
        completion:         0,
        pending:            0,
        escalation:         0,
        hold:               0,
        productionCount:    0,
        nonProductionCount: 0,
        subtaskCount:       0,
        docTypeCounts:      {},
        volumeByDocType:    {},
        companiesSet:       new Set(),
      };
    }
    const a = agentMap[tx.agentId];
    a.txCount++;
    a.totalVolume += tx.volume ?? 1;
    if (tx.tat != null) { a.totalTat += tx.tat; a.tatCount++; }
    if (tx.status === "COMPLETION") a.completion++;
    if (tx.status === "PENDING")    a.pending++;
    if (tx.status === "ESCALATION") a.escalation++;
    if (tx.status === "HOLD")       a.hold++;

    if (!tx.taskCategory || tx.taskCategory === "Production") a.productionCount++;
    else a.nonProductionCount++;

    const subtasks = tx.subtasks ?? [];
    a.subtaskCount += subtasks.length;

    if (tx.companyName && tx.companyName !== "__timer__") {
      a.companiesSet.add(tx.companyName);
    }

    const dt  = tx.docType || "Unknown";
    const add = tx.countType === "volume" ? (tx.volume ?? 1) : 1;
    a.docTypeCounts[dt]   = (a.docTypeCounts[dt]   ?? 0) + add;
    a.volumeByDocType[dt] = (a.volumeByDocType[dt] ?? 0) + (tx.volume ?? 1);

    globalDocTypeCounts[dt] = (globalDocTypeCounts[dt] ?? 0) + add;

    if (tx.date) {
      if (!dailyDocTypeCounts[tx.date]) dailyDocTypeCounts[tx.date] = {};
      dailyDocTypeCounts[tx.date][dt] = (dailyDocTypeCounts[tx.date][dt] ?? 0) + add;
    }

    for (const st of subtasks) {
      const stDt  = st.docType || "Unknown";
      const stAdd = st.countType === "volume" ? (st.number ?? 1) : 1;
      a.docTypeCounts[stDt]   = (a.docTypeCounts[stDt]   ?? 0) + stAdd;
      a.volumeByDocType[stDt] = (a.volumeByDocType[stDt] ?? 0) + (st.number ?? 1);
      globalDocTypeCounts[stDt] = (globalDocTypeCounts[stDt] ?? 0) + stAdd;
      if (tx.date) {
        if (!dailyDocTypeCounts[tx.date]) dailyDocTypeCounts[tx.date] = {};
        dailyDocTypeCounts[tx.date][stDt] = (dailyDocTypeCounts[tx.date][stDt] ?? 0) + stAdd;
      }
    }
  }

  const rows = Object.values(agentMap).map(a => {
    const txCountForRates = a.txCount || 1;
    return {
      agentId:             a.agentId,
      agentName:           a.agentName,
      group:               a.group,
      productivity:        agentProductivitySeconds[a.agentId] ?? a.totalTat,
      avgTat:              a.tatCount ? Math.round(a.totalTat / a.tatCount) : 0,
      totalVolume:         a.totalVolume,
      txCount:             a.txCount,
      subtaskCount:        a.subtaskCount,
      productionCount:     a.productionCount,
      nonProductionCount:  a.nonProductionCount,
      completionRate:      Math.round((a.completion  / txCountForRates) * 10000) / 100,
      pendingRate:         Math.round((a.pending     / txCountForRates) * 10000) / 100,
      escalationRate:      Math.round((a.escalation  / txCountForRates) * 10000) / 100,
      holdRate:            Math.round((a.hold        / txCountForRates) * 10000) / 100,
      docTypeCounts:       a.docTypeCounts,
      volumeByDocType:     a.volumeByDocType,
      companies:           [...a.companiesSet].sort(),
      statusBreakdown: {
        completion: a.completion,
        pending:    a.pending,
        escalation: a.escalation,
        hold:       a.hold,
      },
    };
  });

  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.group]) grouped[row.group] = [];
    grouped[row.group].push(row);
  }
  for (const g of Object.keys(grouped)) {
    grouped[g].sort((a, b) => a.agentName.localeCompare(b.agentName));
  }

  const dailySummary = Object.entries(dailyDocTypeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, counts }));

  return NextResponse.json({
    grouped,
    groups: Object.keys(grouped).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    ),
    globalDocTypeCounts,
    dailySummary,
  });
}