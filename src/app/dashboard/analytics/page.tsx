"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, CheckCircle2, AlertTriangle, Users, TrendingUp,
  TrendingDown, Award, Zap, Target, Clock, ChevronUp, ChevronDown,
  Activity, FileText, FileSpreadsheet, RefreshCw, Calendar,
} from "lucide-react";

/* ─── Types ─── */
interface Summary {
  totalTx: number; done: number; pending: number; noDoc: number;
  escalated: number; avgTat: number; completionRate: number;
}
interface AgentStat {
  agentId: string; name: string; total: number; done: number;
  pending: number; noDoc: number; escalated: number; avgTat: number; rate: number;
}
interface DocTypeStat { type: string; count: number; avgTat: number }
interface DailyPoint  { date: string; count: number }

/* ─── Helpers ─── */
function formatTat(sec: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtDateLong(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type SortKey = "total" | "done" | "pending" | "escalated" | "avgTat" | "rate";

/* ─── Accurate Spotlight Logic ─── */
function computeSpotlights(agentStats: AgentStat[]) {
  if (!agentStats.length) return { topAgent: null, lowAgent: null, mostActive: null, fastestAgent: null };

  // Sort by rate desc, then by total desc as tiebreaker
  const byRate = [...agentStats].sort((a, b) => b.rate - a.rate || b.total - a.total);

  // Top performer: highest rate with at least 1 completed TX
  // Fallback to highest rate overall if no one has done > 0
  const topAgent = byRate.find(a => a.done > 0) ?? (agentStats.length ? byRate[0] : null);

  // Needs attention: lowest rate, must be a DIFFERENT agent from top
  // If all tied, pick the one with most pending (most work stuck)
  const lowCandidates = byRate
    .filter(a => a.agentId !== topAgent?.agentId)
    .sort((a, b) => a.rate - b.rate || b.pending - a.pending);
  const lowAgent = lowCandidates[0] ?? null;

  // Most active: highest total TX
  const mostActive = [...agentStats].sort((a, b) => b.total - a.total)[0] ?? null;

  // Fastest TAT: lowest avgTat among agents who have actually completed work
  const fastestAgent = agentStats
    .filter(a => a.avgTat > 0 && a.done > 0)
    .sort((a, b) => a.avgTat - b.avgTat)[0] ?? null;

  return { topAgent, lowAgent, mostActive, fastestAgent };
}

/* ─── Export helpers ─── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const el = document.createElement("script");
    el.src = src; el.onload = () => resolve(); el.onerror = reject;
    document.head.appendChild(el);
  });
}

async function exportToExcel(
  summary: Summary | null, agentStats: AgentStat[], docTypeStats: DocTypeStat[],
  dailyTrend: DailyPoint[], from: string, to: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  if (summary) {
    const summaryData = [
      ["Date Range", `${from} to ${to}`],
      ["Total TX", summary.totalTx],
      ["Done", summary.done],
      ["Pending", summary.pending],
      ["No Doc", summary.noDoc],
      ["Escalated", summary.escalated],
      ["Avg TAT", formatTat(summary.avgTat)],
      ["Completion Rate", `${summary.completionRate}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws["!cols"] = [{ wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
  }

  const byRate = [...agentStats].sort((a, b) => b.rate - a.rate || b.total - a.total);
  const agentRows = byRate.map((a, i) => ({
    "Rank": i + 1, "Agent": a.name, "Total TX": a.total, "Done": a.done,
    "Pending": a.pending, "No Doc": a.noDoc, "Escalated": a.escalated,
    "Avg TAT": formatTat(a.avgTat), "Rate %": +a.rate,
  }));
  const wsAgents = XLSX.utils.json_to_sheet(agentRows);
  wsAgents["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsAgents, "Agent Stats");

  const docTotal = docTypeStats.reduce((s, d) => s + d.count, 0);
  const docRows = [...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => ({
    "#": i + 1, "Doc Type": d.type, "Count": d.count,
    "Avg TAT": formatTat(d.avgTat),
    "Share %": docTotal ? +(((d.count / docTotal) * 100).toFixed(1)) : 0,
  }));
  const wsDocs = XLSX.utils.json_to_sheet(docRows);
  wsDocs["!cols"] = [{ wch: 4 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDocs, "Doc Types");

  const trendRows = dailyTrend.map(d => ({ "Date": d.date, "TX Count": d.count }));
  const wsTrend = XLSX.utils.json_to_sheet(trendRows);
  wsTrend["!cols"] = [{ wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTrend, "Daily Trend");

  XLSX.writeFile(wb, `analytics_${from}_to_${to}.xlsx`);
}

async function exportToPdf(
  summary: Summary | null, agentStats: AgentStat[], docTypeStats: DocTypeStat[],
  dailyTrend: DailyPoint[], from: string, to: string,
  formattedFrom: string, formattedTo: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Performance Analytics", 10, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`${formattedFrom} — ${formattedTo}`, 10, 20);

  if (summary) {
    const kpis = [
      { label: "TOTAL TX",   value: String(summary.totalTx),          rgb: [148,163,184] as [number,number,number] },
      { label: "DONE",       value: String(summary.done),             rgb: [34,197,94]   as [number,number,number] },
      { label: "PENDING",    value: String(summary.pending),          rgb: [234,179,8]   as [number,number,number] },
      { label: "ESCALATED",  value: String(summary.escalated),        rgb: [168,85,247]  as [number,number,number] },
      { label: "AVG TAT",    value: formatTat(summary.avgTat),        rgb: [99,102,241]  as [number,number,number] },
      { label: "COMP RATE",  value: `${summary.completionRate}%`,     rgb: [34,197,94]   as [number,number,number] },
    ];
    const bw = 42, bh = 14, sx = 10, sy = 26;
    kpis.forEach((k, i) => {
      const x = sx + i * (bw + 3);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(x, sy, bw, bh, 2, 2, "F");
      doc.setTextColor(...k.rgb);
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(k.value, x + bw / 2, sy + 7, { align: "center" });
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, x + bw / 2, sy + 12, { align: "center" });
    });
  }

  // Use accurate spotlight logic for PDF too
  const { topAgent, lowAgent, mostActive, fastestAgent } = computeSpotlights(agentStats);

  if (dailyTrend.length > 0) {
    const chartX = 10, chartY = 45, chartW = 277, chartH = 40;
    doc.setFillColor(22, 32, 52);
    doc.roundedRect(chartX, chartY, chartW, chartH + 10, 2, 2, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("DAILY TRANSACTION VOLUME", chartX + 3, chartY + 5);
    const maxD = Math.max(...dailyTrend.map(d => d.count), 1);
    const barW = Math.min(8, (chartW - 10) / dailyTrend.length - 1);
    const barAreaH = chartH - 8;
    dailyTrend.forEach((d, i) => {
      const bh2 = Math.max(1, (d.count / maxD) * barAreaH);
      const bx = chartX + 5 + i * ((chartW - 10) / dailyTrend.length);
      const by = chartY + 8 + barAreaH - bh2;
      const isMax = d.count === maxD;
      doc.setFillColor(isMax ? 99 : 51, isMax ? 102 : 65, isMax ? 241 : 130);
      doc.rect(bx, by, barW, bh2, "F");
      if (dailyTrend.length <= 14) {
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const label = fmtDate(d.date).split(" ")[1];
        doc.text(label, bx + barW / 2, chartY + 8 + barAreaH + 4, { align: "center" });
      }
    });
  }

  let curY = 100;
  const spotlights = [
    topAgent    && { label: "TOP PERFORMER",   name: topAgent.name,    value: `${topAgent.rate}%`,       sub: "completion rate",  rgb: [251,191,36]  as [number,number,number] },
    lowAgent    && { label: "NEEDS ATTENTION", name: lowAgent.name,    value: `${lowAgent.rate}%`,       sub: "completion rate",  rgb: [248,113,113] as [number,number,number] },
    mostActive  && { label: "MOST ACTIVE",     name: mostActive.name,  value: String(mostActive.total),  sub: "transactions",     rgb: [99,102,241]  as [number,number,number] },
    fastestAgent && { label: "FASTEST TAT",   name: fastestAgent.name, value: formatTat(fastestAgent.avgTat), sub: "avg turnaround", rgb: [52,211,153] as [number,number,number] },
  ].filter(Boolean) as { label: string; name: string; value: string; sub: string; rgb: [number,number,number] }[];

  if (spotlights.length > 0 && curY < 180) {
    const sw = (277 - (spotlights.length - 1) * 3) / spotlights.length;
    spotlights.forEach((s, i) => {
      const sx = 10 + i * (sw + 3);
      doc.setFillColor(22, 32, 52);
      doc.roundedRect(sx, curY, sw, 22, 2, 2, "F");
      doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.setTextColor(...s.rgb);
      doc.text(s.label, sx + 3, curY + 5);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.setTextColor(226, 232, 240);
      doc.text(s.name.length > 18 ? s.name.slice(0, 16) + "…" : s.name, sx + 3, curY + 11);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.setTextColor(...s.rgb);
      doc.text(s.value, sx + 3, curY + 18);
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(s.sub, sx + sw - 3, curY + 18, { align: "right" });
    });
    curY += 28;
  }

  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 14, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Agent Statistics", 10, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${formattedFrom} — ${formattedTo}  ·  ${agentStats.length} agents`, 287, 10, { align: "right" });

  const byRateSorted = [...agentStats].sort((a, b) => b.rate - a.rate || b.total - a.total);
  const agentBody = byRateSorted.map((a, i) => [
    i + 1, a.name, a.total, a.done, a.pending, a.noDoc, a.escalated,
    formatTat(a.avgTat), `${a.rate}%`,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 18,
    head: [["Rank", "Agent", "Total", "Done", "Pending", "No Doc", "Escalated", "Avg TAT", "Rate"]],
    body: agentBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [148, 163, 184], fillColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [99, 102, 241], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [22, 32, 52] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center", textColor: [34, 197, 94] },
      4: { cellWidth: 18, halign: "center", textColor: [234, 179, 8] },
      5: { cellWidth: 18, halign: "center", textColor: [239, 68, 68] },
      6: { cellWidth: 22, halign: "center", textColor: [168, 85, 247] },
      7: { cellWidth: 30, halign: "center", textColor: [99, 102, 241], fontStyle: "bold" },
      8: { cellWidth: 22, halign: "center" },
    },
    didDrawCell: (data: any) => {
      if (data.column.index === 8 && data.section === "body") {
        const val = parseFloat(data.cell.raw as string);
        const color: [number,number,number] = val >= 80 ? [34,197,94] : val >= 50 ? [234,179,8] : [239,68,68];
        doc.setTextColor(...color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`${val}%`, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
      }
    },
    margin: { left: 10, right: 10 },
  });

  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 14, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Doc Type Performance", 10, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`${formattedFrom} — ${formattedTo}`, 287, 10, { align: "right" });

  const docTotal = docTypeStats.reduce((s, d) => s + d.count, 0);
  const docBody = [...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => [
    i + 1, d.type, d.count, formatTat(d.avgTat),
    docTotal ? `${((d.count / docTotal) * 100).toFixed(1)}%` : "0%",
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 18,
    head: [["#", "Doc Type", "Count", "Avg TAT", "Share"]],
    body: docBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [148, 163, 184], fillColor: [15, 23, 42], lineColor: [30, 41, 59], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [99, 102, 241], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [22, 32, 52] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 20, halign: "center", textColor: [99, 102, 241], fontStyle: "bold" },
      3: { cellWidth: 30, halign: "center", textColor: [99, 102, 241] },
      4: { cellWidth: 24, halign: "center", textColor: [34, 197, 94] },
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(71, 85, 105);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }

  doc.save(`analytics_${from}_to_${to}.pdf`);
}

/* ─── UI Sub-components ─── */
function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold">
      <Award size={9} /> TOP
    </span>
  );
  if (rank === total && total > 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-500 text-[10px] font-bold">
      <TrendingDown size={9} /> LOW
    </span>
  );
  return <span className="text-slate-400 text-xs font-mono">#{rank}</span>;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%` }} />
    </div>
  );
}

function DonutRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className={color} style={{ transition: "stroke-dashoffset 1s ease" }} />
    </svg>
  );
}

function SortTh({ label, col, sort, onSort }: { label: string; col: SortKey; sort: [SortKey, "asc"|"desc"]; onSort: (c: SortKey) => void }) {
  const active = sort[0] === col;
  return (
    <th className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest cursor-pointer select-none transition-colors whitespace-nowrap ${active ? "text-indigo-500" : "text-slate-400 hover:text-slate-600"}`}
      onClick={() => onSort(col)}>
      <span className="flex items-center gap-1">
        {label}
        {active ? (sort[1] === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <span className="w-2.5" />}
      </span>
    </th>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 flex flex-col gap-1 hover:border-indigo-200 hover:shadow-sm transition-all group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <span className="text-slate-300 group-hover:text-indigo-300 transition-colors">{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
        <Activity size={16} className="text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

/* ─── Main Page ─── */
export default function KpiAnalyticsPage() {
  const [from, setFrom]               = useState(daysAgo(6));
  const [to, setTo]                   = useState(today());
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [agentStats, setAgentStats]   = useState<AgentStat[]>([]);
  const [docTypeStats, setDocTypeStats] = useState<DocTypeStat[]>([]);
  const [dailyTrend, setDailyTrend]   = useState<DailyPoint[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sort, setSort]               = useState<[SortKey, "asc"|"desc"]>(["rate", "desc"]);
  const [tab, setTab]                 = useState<"overview"|"agents"|"docs">("overview");
  const [exporting, setExporting]     = useState<"pdf"|"excel"|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/analytics?from=${from}&to=${to}`);
      const d = await res.json();
      setSummary(d.summary);
      setAgentStats(d.agentStats ?? []);
      setDocTypeStats(d.docTypeStats ?? []);
      setDailyTrend(d.dailyTrend ?? []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  /* ── Accurate sort for agents table ── */
  const sortedAgents = [...agentStats].sort((a, b) => {
    const av = a[sort[0]] as number, bv = b[sort[0]] as number;
    // Secondary sort: when rates are equal, sort by total desc
    if (av === bv) return b.total - a.total;
    return sort[1] === "desc" ? bv - av : av - bv;
  });

  /* ── Accurate rank by rate (used in table rank column) ── */
  const rateRankedIds = [...agentStats]
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
    .map(a => a.agentId);

  const handleSort = (col: SortKey) => {
    setSort(prev => prev[0] === col ? [col, prev[1] === "desc" ? "asc" : "desc"] : [col, "desc"]);
  };

  /* ── Use accurate spotlight logic ── */
  const { topAgent, lowAgent, mostActive, fastestAgent } = computeSpotlights(agentStats);

  const topDoc       = docTypeStats.length ? [...docTypeStats].sort((a, b) => b.count - a.count)[0] : null;
  const maxDaily     = Math.max(...dailyTrend.map(d => d.count), 1);
  const maxAgent     = Math.max(...agentStats.map(a => a.total), 1);
  const maxDoc       = Math.max(...docTypeStats.map(d => d.count), 1);

  const formattedFrom = from ? fmtDate(from) : "";
  const formattedTo   = to   ? fmtDateLong(to) : "";

  const canExport = !!summary;

  const handleExcelExport = async () => {
    setExporting("excel");
    try { await exportToExcel(summary, agentStats, docTypeStats, dailyTrend, from, to); }
    finally { setExporting(null); }
  };

  const handlePdfExport = async () => {
    setExporting("pdf");
    try { await exportToPdf(summary, agentStats, docTypeStats, dailyTrend, from, to, formattedFrom, formattedTo); }
    finally { setExporting(null); }
  };

  const hasData = !!summary;

  return (
    <div className="min-h-dvh bg-slate-50/80">
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">KPI Dashboard</p>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Performance Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">
              {formattedFrom && formattedTo ? `${formattedFrom} — ${formattedTo}` : "Select a date range"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-xs text-slate-400">FROM</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="text-sm text-slate-700 focus:outline-none bg-transparent" />
              <span className="text-xs text-slate-300">—</span>
              <span className="text-xs text-slate-400">TO</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="text-sm text-slate-700 focus:outline-none bg-transparent" />
            </div>

            <button onClick={() => { setFrom(today()); setTo(today()); }}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
              Today
            </button>
            <button onClick={() => { setFrom(daysAgo(6)); setTo(today()); }}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
              7 Days
            </button>

            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>

            <div className="h-6 w-px bg-slate-200" />

            <button onClick={handleExcelExport} disabled={!canExport || exporting === "excel"}
              title={canExport ? "Export to Excel" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}>
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>

            <button onClick={handlePdfExport} disabled={!canExport || exporting === "pdf"}
              title={canExport ? "Export to PDF" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}>
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-3">
            <RefreshCw size={16} className="animate-spin text-indigo-400" />
            <span className="text-sm text-slate-400">Loading analytics…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* ── KPI Summary Cards ── */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <StatCard label="Total TX"  value={summary.totalTx}              sub="all transactions"  color="text-slate-800"   icon={<Activity size={14} />} />
                <StatCard label="Completed" value={summary.done}                 sub="finished"          color="text-green-600"   icon={<CheckCircle2 size={14} />} />
                <StatCard label="Pending"   value={summary.pending}              sub="in queue"          color="text-amber-500"   icon={<Clock size={14} />} />
                <StatCard label="Escalated" value={summary.escalated}            sub="flagged"           color="text-purple-500"  icon={<AlertTriangle size={14} />} />
                <StatCard label="Avg TAT"   value={formatTat(summary.avgTat)}    sub="per transaction"   color="text-indigo-500"  icon={<TrendingUp size={14} />} />
                <StatCard label="Rate"      value={`${summary.completionRate}%`} sub="completion"        color={summary.completionRate >= 80 ? "text-green-600" : summary.completionRate >= 50 ? "text-amber-500" : "text-red-500"} icon={<Target size={14} />} />
              </div>
            )}

            {/* ── Spotlight Cards ── */}
            {agentStats.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

                {/* Top Performer */}
                {topAgent ? (
                  <div className="bg-white border border-amber-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Award size={13} className="text-amber-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Top Performer</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 truncate">{topAgent.name}</p>
                    <p className="text-2xl font-bold text-amber-500 tabular-nums">{topAgent.rate}%</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">completion · {topAgent.total} TX · {topAgent.done} done</p>
                    <div className="mt-3 flex items-center gap-2">
                      <DonutRing pct={topAgent.rate} color="text-amber-400" size={40} />
                      <div className="text-[10px] text-slate-400 leading-4">
                        <div className="text-green-500 font-semibold">{topAgent.done} done</div>
                        <div className="text-amber-400">{topAgent.pending} pending</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center">
                    <p className="text-xs text-slate-400">No top performer yet</p>
                  </div>
                )}

                {/* Needs Attention */}
                {lowAgent ? (
                  <div className="bg-white border border-red-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                        <AlertTriangle size={13} className="text-red-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Needs Attention</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 truncate">{lowAgent.name}</p>
                    <p className="text-2xl font-bold text-red-500 tabular-nums">{lowAgent.rate}%</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">completion · {lowAgent.total} TX · {lowAgent.pending} pending</p>
                    <div className="mt-3 flex items-center gap-2">
                      <DonutRing pct={lowAgent.rate} color="text-red-400" size={40} />
                      <div className="text-[10px] text-slate-400 leading-4">
                        <div className="text-green-500 font-semibold">{lowAgent.done} done</div>
                        <div className="text-amber-400">{lowAgent.pending} pending</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center">
                    <p className="text-xs text-slate-400">Only one agent</p>
                  </div>
                )}

                {/* Most Active */}
                {mostActive && (
                  <div className="bg-white border border-indigo-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Zap size={13} className="text-indigo-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Most Active</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 truncate">{mostActive.name}</p>
                    <p className="text-2xl font-bold text-indigo-500 tabular-nums">{mostActive.total}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">transactions handled</p>
                    <div className="mt-3">
                      <MiniBar value={mostActive.total} max={maxAgent} color="bg-indigo-400" />
                      <p className="text-[10px] text-slate-400 mt-1">{((mostActive.total / Math.max(maxAgent, 1)) * 100).toFixed(0)}% of max load</p>
                    </div>
                  </div>
                )}

                {/* Fastest TAT */}
                {fastestAgent ? (
                  <div className="bg-white border border-green-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                        <Target size={13} className="text-green-600" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-green-600">Fastest TAT</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 truncate">{fastestAgent.name}</p>
                    <p className="text-xl font-bold text-green-600 font-mono tabular-nums">{formatTat(fastestAgent.avgTat)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">avg turnaround time</p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <Clock size={11} className="text-slate-300" />
                      <span className="text-[11px] text-slate-400">{fastestAgent.done} completed TXs</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center">
                    <p className="text-xs text-slate-400">No completed TX yet</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
              {([
                { key: "overview", label: "Overview",  icon: Activity  },
                { key: "agents",   label: "Agents",    icon: Users     },
                { key: "docs",     label: "Doc Types", icon: BarChart2 },
              ] as const).map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}>
                    <Icon size={12} />{t.label}
                  </button>
                );
              })}
            </div>

            {/* ── Overview Tab ── */}
            {tab === "overview" && (
              <div className="space-y-4">
                {/* Daily Volume Chart */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-indigo-500" />
                      <h2 className="text-sm font-semibold text-slate-800">Daily Transaction Volume</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      {dailyTrend.length > 0 && (
                        <span className="text-[11px] text-slate-400">
                          Peak: <span className="text-indigo-500 font-semibold">{maxDaily}</span> on {fmtDate(dailyTrend.find(d => d.count === maxDaily)?.date ?? "")}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-300">{dailyTrend.length} days</span>
                    </div>
                  </div>
                  {dailyTrend.length === 0 ? <EmptyState message="No transaction data in this range" /> : (
                    <>
                      <div className="flex items-end gap-1.5 h-36 mb-2">
                        {dailyTrend.map((d, i) => {
                          const pct = Math.max(4, (d.count / maxDaily) * 100);
                          const isMax = d.count === maxDaily;
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                              <span className={`text-[10px] font-bold tabular-nums transition-all ${isMax ? "text-indigo-500" : "text-slate-300 opacity-0 group-hover:opacity-100"}`}>
                                {d.count}
                              </span>
                              <div title={`${fmtDate(d.date)}: ${d.count} TX`}
                                className={`w-full rounded-t-md transition-all duration-500 ${isMax ? "bg-indigo-500" : "bg-indigo-100 group-hover:bg-indigo-300"}`}
                                style={{ height: `${pct}%`, transitionDelay: `${i * 20}ms` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-2">
                        {dailyTrend.map(d => (
                          <div key={d.date} className="flex-1 text-center">
                            <span className="text-[9px] text-slate-400">{fmtDate(d.date).split(" ")[1]}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Agent Volume */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-500" />
                        <h2 className="text-sm font-semibold text-slate-800">Agent Volume</h2>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        {[["bg-green-400","Done"],["bg-amber-400","Pending"],["bg-purple-400","Escalated"]].map(([c,l]) => (
                          <div key={l} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-sm ${c}`} />
                            <span>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {agentStats.length === 0 ? <EmptyState message="No agent data" /> : (
                      <div className="space-y-4">
                        {[...agentStats].sort((a, b) => b.total - a.total).map((a, i) => (
                          <div key={a.agentId}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <RankBadge rank={i + 1} total={agentStats.length} />
                                <span className="text-xs text-slate-700 font-medium">{a.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs tabular-nums font-mono">
                                <span className="text-green-600">{a.done}✓</span>
                                <span className="text-amber-500">{a.pending}⏳</span>
                                <span className="text-slate-600 font-semibold">{a.total}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full flex">
                                <div className="bg-green-400 transition-all duration-700"
                                  style={{ width: `${(a.done / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                                <div className="bg-amber-400 transition-all duration-700"
                                  style={{ width: `${(a.pending / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                                <div className="bg-purple-400 transition-all duration-700"
                                  style={{ width: `${(a.escalated / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Doc Type Volume */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart2 size={14} className="text-indigo-500" />
                        <h2 className="text-sm font-semibold text-slate-800">Doc Type Volume</h2>
                      </div>
                      {topDoc && (
                        <span className="text-[10px] text-slate-400">
                          Top: <span className="text-slate-600 font-semibold">{topDoc.type}</span>
                        </span>
                      )}
                    </div>
                    {docTypeStats.length === 0 ? <EmptyState message="No doc type data" /> : (
                      <div className="space-y-3.5">
                        {[...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => (
                          <div key={d.type}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300 text-xs font-mono">#{i+1}</span>
                                <span className="text-xs text-slate-700 font-medium">{d.type}</span>
                                {i === 0 && <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-500 text-[9px] font-bold">MOST</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs tabular-nums">
                                <span className="text-slate-400 font-mono text-[11px]">{formatTat(d.avgTat)}</span>
                                <span className="text-slate-700 font-semibold">{d.count}</span>
                              </div>
                            </div>
                            <MiniBar value={d.count} max={maxDoc} color="bg-indigo-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Completion Rate Comparison */}
                {agentStats.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <CheckCircle2 size={14} className="text-indigo-500" />
                      <h2 className="text-sm font-semibold text-slate-800">Completion Rate Comparison</h2>
                      <span className="text-[11px] text-slate-400 ml-auto">By agent (rate-ranked)</span>
                    </div>
                    <div className="flex items-end gap-3 h-32">
                      {[...agentStats].sort((a, b) => b.rate - a.rate || b.total - a.total).map((a, i, arr) => {
                        const isTop = i === 0 && a.done > 0;
                        const isLow = i === arr.length - 1 && arr.length > 1;
                        const barH = Math.max(6, a.rate);
                        return (
                          <div key={a.agentId} className="flex-1 flex flex-col items-center gap-1.5 group cursor-default"
                            title={`${a.name}: ${a.rate}% (${a.done}/${a.total} done)`}>
                            <span className="text-xs font-bold tabular-nums" style={{
                              color: isTop ? "#d97706" : isLow ? "#ef4444" : "#6366f1"
                            }}>{a.rate}%</span>
                            <div className="w-full rounded-t-lg transition-all duration-700 min-h-[4px] group-hover:opacity-80"
                              style={{
                                height: `${barH}px`, maxHeight: "100px",
                                background: isTop ? "#f59e0b" : isLow ? "#fca5a5" : "#a5b4fc",
                              }} />
                            <span className="text-[10px] text-slate-500 text-center truncate w-full leading-tight">{a.name.split(" ")[0]}</span>
                            {isTop && a.done > 0 && <span className="text-[9px] text-amber-500 font-bold">TOP</span>}
                            {isLow && arr.length > 1 && <span className="text-[9px] text-red-500 font-bold">LOW</span>}
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400"/><span className="text-[10px] text-slate-400">Top Performer</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-300"/><span className="text-[10px] text-slate-400">Others</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-300"/><span className="text-[10px] text-slate-400">Needs Attention</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Agents Tab ── */}
            {tab === "agents" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-indigo-500" />
                    <h2 className="text-sm font-semibold text-slate-800">Agent Statistics</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{agentStats.length} agents</span>
                    <span className="text-[11px] text-slate-300">·</span>
                    <span className="text-[11px] text-slate-400">Click headers to sort</span>
                    <span className="text-[11px] text-slate-300">·</span>
                    <span className="text-[11px] text-slate-400">Rank = by completion rate</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {agentStats.length === 0 ? <EmptyState message="No agent data for this period" /> : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap">Rank</th>
                          <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Agent</th>
                          <SortTh label="Total"     col="total"     sort={sort} onSort={handleSort} />
                          <SortTh label="Done"      col="done"      sort={sort} onSort={handleSort} />
                          <SortTh label="Pending"   col="pending"   sort={sort} onSort={handleSort} />
                          <SortTh label="Escalated" col="escalated" sort={sort} onSort={handleSort} />
                          <SortTh label="Avg TAT"   col="avgTat"    sort={sort} onSort={handleSort} />
                          <SortTh label="Rate"      col="rate"      sort={sort} onSort={handleSort} />
                          <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAgents.map((a) => {
                          const rateRank = rateRankedIds.indexOf(a.agentId) + 1;
                          const isTop = rateRank === 1 && a.done > 0;
                          const isLow = rateRank === agentStats.length && agentStats.length > 1;
                          return (
                            <tr key={a.agentId} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isTop ? "bg-amber-50/30" : isLow ? "bg-red-50/20" : ""}`}>
                              <td className="px-4 py-3.5">
                                <RankBadge rank={rateRank} total={agentStats.length} />
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${isTop ? "bg-amber-500" : isLow ? "bg-red-400" : "bg-indigo-500"}`}>
                                    {a.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-slate-700">{a.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-slate-700 font-semibold tabular-nums">{a.total}</td>
                              <td className="px-4 py-3.5 text-green-600 font-semibold tabular-nums">{a.done}</td>
                              <td className="px-4 py-3.5 text-amber-500 tabular-nums">{a.pending}</td>
                              <td className="px-4 py-3.5 text-purple-500 tabular-nums">{a.escalated}</td>
                              <td className="px-4 py-3.5 font-mono text-indigo-500 text-xs tabular-nums">{formatTat(a.avgTat)}</td>
                              <td className="px-4 py-3.5">
                                <span className={`font-bold tabular-nums text-sm ${a.rate >= 80 ? "text-green-600" : a.rate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                                  {a.rate}%
                                </span>
                              </td>
                              <td className="px-4 py-3.5 min-w-[140px]">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-700 ${a.rate >= 80 ? "bg-green-500" : a.rate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                      style={{ width: `${a.rate}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">{a.rate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── Doc Types Tab ── */}
            {tab === "docs" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <BarChart2 size={14} className="text-indigo-500" />
                  <h2 className="text-sm font-semibold text-slate-800">Doc Type Performance</h2>
                  <span className="text-[11px] text-slate-300 ml-auto">{docTypeStats.length} types</span>
                </div>
                {docTypeStats.length === 0 ? <EmptyState message="No doc type data for this period" /> : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        {["#", "Type", "Count", "Avg TAT", "Share"].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => {
                        const total = docTypeStats.reduce((s, x) => s + x.count, 0);
                        const share = total ? Math.round((d.count / total) * 100) : 0;
                        return (
                          <tr key={d.type} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 text-slate-300 text-xs font-mono">#{i+1}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-700 font-medium">{d.type}</span>
                                {i === 0 && <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-500 text-[9px] font-bold">MOST USED</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-700 font-semibold tabular-nums">{d.count}</td>
                            <td className="px-5 py-3.5 font-mono text-indigo-500 text-xs tabular-nums">{formatTat(d.avgTat)}</td>
                            <td className="px-5 py-3.5 min-w-[160px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-700" style={{ width: `${share}%` }} />
                                </div>
                                <span className="text-xs text-slate-500 tabular-nums w-8 text-right font-semibold">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </>
        )}

      </main>
    </div>
  );
}