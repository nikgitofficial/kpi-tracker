// app/api/kpi/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import Agent from "@/models/Agent";
import DocType from "@/models/DocType";
import type { PipelineStage } from "mongoose";

// GET /api/kpi/search?q=...&status=...&docType=...&agentName=...&minVolume=...&maxVolume=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q")?.trim() ?? "";
  const status     = searchParams.get("status") ?? "";
  const docType    = searchParams.get("docType") ?? "";
  const agentName  = searchParams.get("agentName") ?? "";
  const minVolume  = Number(searchParams.get("minVolume") ?? 0);
  const maxVolume  = searchParams.get("maxVolume") ? Number(searchParams.get("maxVolume")) : null;

  await connectDB();

  const email = session.user.email;
  const results: {
    type: "agent" | "company" | "doctype" | "transaction";
    id: string;
    label: string;
    sub?: string;
    badge?: string;
    meta?: string;
    href?: string;
  }[] = [];

  // ── Regex for text search ──
  const regex = q ? new RegExp(q, "i") : null;

  // ── Agents ──
  if (!status && !docType && !agentName && !minVolume && !maxVolume) {
    const agentQuery: Record<string, unknown> = { email };
    if (regex) agentQuery.name = regex;

    const agents = await Agent.find(agentQuery).limit(5).lean();
    for (const a of agents) {
      results.push({
        type:  "agent",
        id:    String(a._id),
        label: a.name,
        sub:   a.group ? `Group: ${a.group}` : "No group",
        href:  `/dashboard/tx-log`,
      });
    }

    // ── Doc Types ──
    const dtQuery: Record<string, unknown> = { email };
    if (regex) dtQuery.name = regex;

    const docTypes = await DocType.find(dtQuery).limit(5).lean();
    for (const d of docTypes) {
      results.push({
        type:  "doctype",
        id:    String(d._id),
        label: d.name,
        sub:   "Task type",
        href:  `/dashboard/analytics`,
      });
    }
  }

  // ── Transactions ──
  const txQuery: Record<string, unknown> = { ownerEmail: email };

  if (status)    txQuery.status    = status;
  if (docType)   txQuery.docType   = docType;
  if (agentName) txQuery.agentName = agentName;
  if (minVolume || maxVolume) {
    const volFilter: Record<string, number> = {};
    if (minVolume)  volFilter.$gte = minVolume;
    if (maxVolume)  volFilter.$lte = maxVolume;
    txQuery.volume = volFilter;
  }

  if (regex && !status && !docType && !agentName && !minVolume && !maxVolume) {
    // Full-text: match company, agent name, doc type, or notes
    txQuery.$or = [
      { companyName: regex },
      { agentName:   regex },
      { docType:     regex },
      { notes:       regex },
    ];
  }

  // Companies (distinct from TX)
  if (regex && !status && !docType && !agentName && !minVolume && !maxVolume) {
   const companyPipeline: PipelineStage[] = [
  { $match: { ownerEmail: email, companyName: regex } },
  { $group: { _id: "$companyName", totalTx: { $sum: 1 }, totalVolume: { $sum: "$volume" } } },
  { $sort:  { totalTx: -1 as const } },
  { $limit: 5 },
];
    const companies = await Transaction.aggregate(companyPipeline);
    for (const c of companies) {
      results.push({
        type:  "company",
        id:    `company-${c._id}`,
        label: c._id,
        sub:   `${c.totalTx} transaction${c.totalTx !== 1 ? "s" : ""}`,
        meta:  `Vol: ${c.totalVolume}`,
        href:  `/dashboard/activity`,
      });
    }
  }

  // Transactions
  const txs = await Transaction.find(txQuery)
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const formatTat = (sec?: number) => {
    if (!sec) return undefined;
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  for (const tx of txs) {
    results.push({
      type:  "transaction",
      id:    String(tx._id),
      label: tx.companyName,
      sub:   `${tx.docType} · ${tx.agentName} · ${tx.date}`,
      badge: tx.status,
      meta:  tx.tat ? formatTat(tx.tat) : tx.endTime ? undefined : "In progress",
      href:  `/dashboard/tx-log`,
    });
  }

  return NextResponse.json({ results });
}