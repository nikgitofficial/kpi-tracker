// app/api/kpi/productivity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import Agent from "@/models/Agent";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  await connectDB();

  // Fetch all agents for this owner (to get group info)
  const agents = await Agent.find({ email: session.user.email }).lean();
  
  // Build lookup maps by both _id AND name as fallback
  const agentGroupMap: Record<string, string> = {};
  const agentNameMap: Record<string, string> = {};

  for (const a of agents) {
    agentGroupMap[String(a._id)] = a.group ?? "Ungrouped";
    agentNameMap[a.name] = a.group ?? "Ungrouped";
  }

  // Fetch transactions in date range
  const query: Record<string, unknown> = { ownerEmail: session.user.email };
  if (from && to)  query.date = { $gte: from, $lte: to };
  else if (from)   query.date = from;

  const txs = await Transaction.find(query).lean();

  // Aggregate per agent
  const agentMap: Record<string, {
    agentId: string; agentName: string; group: string;
    totalTat: number; tatCount: number;
    totalVolume: number; txCount: number;
    completion: number; pending: number; escalation: number;
  }> = {};

  for (const tx of txs) {
    if (!agentMap[tx.agentId]) {
      agentMap[tx.agentId] = {
        agentId:    tx.agentId,
        agentName:  tx.agentName,
        // ✅ Fixed: String() ensures ObjectId vs string comparison works,
        //           agentNameMap fallback handles any remaining mismatches
        group:      agentGroupMap[String(tx.agentId)] ?? agentNameMap[tx.agentName] ?? "Ungrouped",
        totalTat:   0,
        tatCount:   0,
        totalVolume: 0,
        txCount:    0,
        completion: 0,
        pending:    0,
        escalation: 0,
      };
    }
    const a = agentMap[tx.agentId];
    a.txCount++;
    a.totalVolume += tx.volume ?? 1;
    if (tx.tat != null) { a.totalTat += tx.tat; a.tatCount++; }
    if (tx.status === "COMPLETION") a.completion++;
    if (tx.status === "PENDING")    a.pending++;
    if (tx.status === "ESCALATION") a.escalation++;
  }

  // Build result rows
  const rows = Object.values(agentMap).map(a => ({
    agentId:        a.agentId,
    agentName:      a.agentName,
    group:          a.group,
    productivity:   a.totalTat,
    avgTat:         a.tatCount ? Math.round(a.totalTat / a.tatCount) : 0,
    totalVolume:    a.totalVolume,
    txCount:        a.txCount,
    completionRate: a.txCount ? Math.round((a.completion / a.txCount) * 100 * 100) / 100 : 0,
    pendingRate:    a.txCount ? Math.round((a.pending    / a.txCount) * 100 * 100) / 100 : 0,
    escalationRate: a.txCount ? Math.round((a.escalation / a.txCount) * 100 * 100) / 100 : 0,
  }));

  // Group them
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.group]) grouped[row.group] = [];
    grouped[row.group].push(row);
  }

  // Sort agents within each group by name
  for (const g of Object.keys(grouped)) {
    grouped[g].sort((a, b) => a.agentName.localeCompare(b.agentName));
  }

  return NextResponse.json({ 
    grouped, 
    groups: Object.keys(grouped).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    ) 
  });
}