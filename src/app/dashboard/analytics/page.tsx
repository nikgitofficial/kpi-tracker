"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, CheckCircle2, AlertTriangle, Users, TrendingUp,
  TrendingDown, Award, Zap, Target, Clock, ChevronUp, ChevronDown,
  Activity, FileText, FileSpreadsheet, PauseCircle,
} from "lucide-react";

/* ─── Types ─── */
interface Summary {
  totalTx: number;
  done: number;
  pending: number;
  hold: number;
  escalated: number;
  avgTat: number;
  completionRate: number;
  totalProductiveSeconds: number;
}

interface AgentStat {
  agentId: string;
  name: string;
  total: number;
  done: number;
  pending: number;
  hold: number;
  escalated: number;
  avgTat: number;
  rate: number;
}

interface DocTypeStat { type: string; count: number; avgTat: number }
interface DailyPoint  { date: string; count: number }
interface AgentDailyRate { date: string; rate: number | null }

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

type SortKey = "total" | "done" | "pending" | "hold" | "escalated" | "avgTat" | "rate";

/* ─── Streak alert helper ─── */
interface StreakAlert extends AgentStat {
  maxStreak: number;
  days: AgentDailyRate[];
}

function getStreakAlerts(
  agentStats: AgentStat[],
  agentDailyRates: Record<string, AgentDailyRate[]>,
  minStreak = 3,
  rateThreshold = 60,
): StreakAlert[] {
  return agentStats
    .map((agent) => {
      const days = agentDailyRates[agent.agentId] ?? [];
      let maxStreak = 0, streak = 0;
      for (const d of days) {
        if (d.rate !== null && d.rate < rateThreshold) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      return { ...agent, maxStreak, days };
    })
    .filter((a) => a.maxStreak >= minStreak)
    .sort((a, b) => b.maxStreak - a.maxStreak);
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
  summary: Summary | null,
  agentStats: AgentStat[],
  docTypeStats: DocTypeStat[],
  dailyTrend: DailyPoint[],
  from: string,
  to: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  if (summary) {
    const summaryData = [
      ["Date Range",              `${from} to ${to}`],
      ["Total TX",                summary.totalTx],
      ["Completion",              summary.done],
      ["Pending",                 summary.pending],
      ["Hold",                    summary.hold],
      ["Escalation",              summary.escalated],
      ["Avg TAT",                 formatTat(summary.avgTat)],
      ["Completion Rate",         `${summary.completionRate}%`],
      ["Total Productive Time",   formatTat(summary.totalProductiveSeconds)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws["!cols"] = [{ wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
  }

  const byRate = [...agentStats].sort((a, b) => b.rate - a.rate);
  const agentRows = byRate.map((a, i) => ({
    "Rank":        i + 1,
    "Agent":       a.name,
    "Total TX":    a.total,
    "Completion":  a.done,
    "Pending":     a.pending,
    "Hold":        a.hold,
    "Escalation":  a.escalated,
    "Avg TAT":     formatTat(a.avgTat),
    "Rate %":      +a.rate,
  }));
  const wsAgents = XLSX.utils.json_to_sheet(agentRows);
  wsAgents["!cols"] = [
    { wch: 6 }, { wch: 24 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAgents, "Agent Stats");

  const docTotal = docTypeStats.reduce((s, d) => s + d.count, 0);
  const docRows = [...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => ({
    "#":             i + 1,
    "Type of Task":  d.type,
    "Count":         d.count,
    "Avg TAT":       formatTat(d.avgTat),
    "Share %":       docTotal ? +(((d.count / docTotal) * 100).toFixed(1)) : 0,
  }));
  const wsDocs = XLSX.utils.json_to_sheet(docRows);
  wsDocs["!cols"] = [{ wch: 4 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDocs, "Tasks Types");

  const trendRows = dailyTrend.map(d => ({ "Date": d.date, "TX Count": d.count }));
  const wsTrend = XLSX.utils.json_to_sheet(trendRows);
  wsTrend["!cols"] = [{ wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTrend, "Daily Trend");

  XLSX.writeFile(wb, `analytics_${from}_to_${to}.xlsx`);
}

async function exportToPdf(
  summary: Summary | null,
  agentStats: AgentStat[],
  docTypeStats: DocTypeStat[],
  dailyTrend: DailyPoint[],
  from: string,
  to: string,
  formattedFrom: string,
  formattedTo: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(20, 20, 36);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Performance Analytics", 10, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 180);
  doc.text(`${formattedFrom} — ${formattedTo}`, 10, 20);

  if (summary) {
    const kpis = [
      { label: "TOTAL TX",    value: String(summary.totalTx),                    rgb: [180,180,220] as [number,number,number] },
      { label: "COMPLETION",  value: String(summary.done),                        rgb: [80,200,120]  as [number,number,number] },
      { label: "PENDING",     value: String(summary.pending),                     rgb: [220,170,60]  as [number,number,number] },
      { label: "HOLD",        value: String(summary.hold),                        rgb: [100,160,220] as [number,number,number] },
      { label: "ESCALATION",  value: String(summary.escalated),                   rgb: [160,120,220] as [number,number,number] },
      { label: "COMP RATE",   value: `${summary.completionRate}%`,                rgb: [80,200,120]  as [number,number,number] },
      { label: "PROD TIME",   value: formatTat(summary.totalProductiveSeconds),   rgb: [120,160,255] as [number,number,number] },
    ];
    const bw = 36, bh = 14, sx = 10, sy = 26;
    kpis.forEach((k, i) => {
      const x = sx + i * (bw + 2);
      doc.setFillColor(35, 35, 58);
      doc.roundedRect(x, sy, bw, bh, 2, 2, "F");
      doc.setTextColor(...k.rgb);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(k.value, x + bw / 2, sy + 7, { align: "center" });
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 150);
      doc.text(k.label, x + bw / 2, sy + 12, { align: "center" });
    });
  }

  if (dailyTrend.length > 0) {
    const chartX = 10, chartY = 45, chartW = 277, chartH = 40;
    doc.setFillColor(28, 28, 48);
    doc.roundedRect(chartX, chartY, chartW, chartH + 10, 2, 2, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 140, 200);
    doc.text("DAILY TRANSACTION VOLUME", chartX + 3, chartY + 5);
    const maxD = Math.max(...dailyTrend.map(d => d.count), 1);
    const barW = Math.min(8, (chartW - 10) / dailyTrend.length - 1);
    const barAreaH = chartH - 8;
    dailyTrend.forEach((d, i) => {
      const bh2 = Math.max(1, (d.count / maxD) * barAreaH);
      const bx = chartX + 5 + i * ((chartW - 10) / dailyTrend.length);
      const by = chartY + 8 + barAreaH - bh2;
      const isMax = d.count === maxD;
      doc.setFillColor(isMax ? 99 : 60, isMax ? 102 : 70, isMax ? 241 : 160);
      doc.rect(bx, by, barW, bh2, "F");
      if (dailyTrend.length <= 14) {
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(90, 90, 130);
        const label = fmtDate(d.date).split(" ")[1];
        doc.text(label, bx + barW / 2, chartY + 8 + barAreaH + 4, { align: "center" });
      }
    });
  }

  let curY = 100;
  const byRate   = [...agentStats].sort((a, b) => b.rate - a.rate);
  const topAgent = byRate[0] ?? null;
  const lowAgent = byRate.length > 1 ? byRate[byRate.length - 1] : null;
  const mostActive = [...agentStats].sort((a, b) => b.total - a.total)[0] ?? null;
  const fastest  = agentStats.filter(a => a.avgTat > 0).sort((a, b) => a.avgTat - b.avgTat)[0] ?? null;

  const spotlights = [
    topAgent   && { label: "TOP PERFORMER",   name: topAgent.name,    value: `${topAgent.rate}%`,         sub: "completion rate",    rgb: [251,191,36]   as [number,number,number] },
    lowAgent   && { label: "NEEDS ATTENTION", name: lowAgent.name,    value: `${lowAgent.rate}%`,         sub: "completion rate",    rgb: [248,113,113]  as [number,number,number] },
    mostActive && { label: "MOST ACTIVE",     name: mostActive.name,  value: String(mostActive.total),    sub: "transactions",       rgb: [99,102,241]   as [number,number,number] },
    fastest    && { label: "FASTEST TAT",     name: fastest.name,     value: formatTat(fastest.avgTat),   sub: "avg turnaround",     rgb: [52,211,153]   as [number,number,number] },
  ].filter(Boolean) as { label: string; name: string; value: string; sub: string; rgb: [number,number,number] }[];

  if (spotlights.length > 0 && curY < 180) {
    const sw = (277 - (spotlights.length - 1) * 3) / spotlights.length;
    spotlights.forEach((s, i) => {
      const sx = 10 + i * (sw + 3);
      doc.setFillColor(28, 28, 48);
      doc.roundedRect(sx, curY, sw, 22, 2, 2, "F");
      doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.setTextColor(...s.rgb);
      doc.text(s.label, sx + 3, curY + 5);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 220, 240);
      doc.text(s.name.length > 18 ? s.name.slice(0, 16) + "…" : s.name, sx + 3, curY + 11);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.setTextColor(...s.rgb);
      doc.text(s.value, sx + 3, curY + 18);
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 150);
      doc.text(s.sub, sx + sw - 3, curY + 18, { align: "right" });
    });
    curY += 28;
  }

  doc.addPage();
  doc.setFillColor(20, 20, 36);
  doc.rect(0, 0, 297, 14, "F");
  doc.setTextColor(160, 160, 210);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Agent Statistics", 10, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 150);
  doc.text(`${formattedFrom} — ${formattedTo}  ·  ${agentStats.length} agents`, 287, 10, { align: "right" });

  const agentBody = byRate.map((a, i) => [
    i + 1, a.name, a.total, a.done, a.pending, a.hold, a.escalated,
    formatTat(a.avgTat), `${a.rate}%`,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 18,
    head: [["Rank", "Agent", "Total", "Completion", "Pending", "Hold", "Escalation", "Avg TAT", "Rate"]],
    body: agentBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
    headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [28, 28, 48] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 46 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 22, halign: "center", textColor: [80, 200, 120] },
      4: { cellWidth: 18, halign: "center", textColor: [220, 170, 60] },
      5: { cellWidth: 16, halign: "center", textColor: [100, 160, 220] },
      6: { cellWidth: 22, halign: "center", textColor: [160, 120, 220] },
      7: { cellWidth: 28, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      8: { cellWidth: 22, halign: "center" },
    },
    didDrawCell: (data: any) => {
      if (data.column.index === 8 && data.section === "body") {
        const val = parseFloat(data.cell.raw as string);
        const color: [number,number,number] = val >= 80 ? [80,200,120] : val >= 50 ? [220,170,60] : [220,80,80];
        doc.setTextColor(...color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`${val}%`, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
      }
    },
    margin: { left: 10, right: 10 },
  });

  doc.addPage();
  doc.setFillColor(20, 20, 36);
  doc.rect(0, 0, 297, 14, "F");
  doc.setTextColor(160, 160, 210);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Task Type Performance", 10, 10);

  const docTotal = docTypeStats.reduce((s, d) => s + d.count, 0);
  const docBody = [...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => [
    i + 1, d.type, d.count, formatTat(d.avgTat),
    docTotal ? `${((d.count / docTotal) * 100).toFixed(1)}%` : "0%",
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 18,
    head: [["#", "Task Type", "Count", "Avg TAT", "Share"]],
    body: docBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
    headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [28, 28, 48] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 20, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      3: { cellWidth: 30, halign: "center", textColor: [120, 160, 255] },
      4: { cellWidth: 24, halign: "center", textColor: [80, 200, 120] },
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }

  doc.save(`analytics_${from}_to_${to}.pdf`);
}

/* ─── UI sub-components ─── */
function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
      <Award size={9} /> TOP
    </span>
  );
  if (rank === total && total > 1) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 text-[10px] font-bold">
      <TrendingDown size={9} /> LOW
    </span>
  );
  return <span className="text-slate-400 dark:text-zinc-500 text-xs font-mono">#{rank}</span>;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%` }} />
    </div>
  );
}

function DonutRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-zinc-700" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className={color} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

function SortTh({ label, col, sort, onSort }: { label: string; col: SortKey; sort: [SortKey, "asc"|"desc"]; onSort: (c: SortKey) => void }) {
  const active = sort[0] === col;
  return (
    <th className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest cursor-pointer select-none transition-colors ${active ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"}`}
      onClick={() => onSort(col)}>
      <span className="flex items-center gap-1">
        {label}
        {active ? (sort[1] === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : null}
      </span>
    </th>
  );
}

/* ─── Streak Alert Panel ─── */
function StreakAlertPanel({
  alerts, minStreak, rateThreshold, onChangeMinStreak, onChangeRateThreshold,
}: {
  alerts: StreakAlert[];
  minStreak: number;
  rateThreshold: number;
  onChangeMinStreak: (v: number) => void;
  onChangeRateThreshold: (v: number) => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return (
    <div className="mb-6 flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} className="text-red-400" />
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          {alerts.length} agent{alerts.length !== 1 ? "s" : ""} flagged for consecutive low performance
        </span>
      </div>
      <button onClick={() => setDismissed(false)} className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 font-semibold transition-colors">
        Show alerts
      </button>
    </div>
  );

  return (
    <div className="mb-6 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Consecutive low-performance alerts</h2>
          <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 text-[10px] font-bold">{alerts.length}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Flag after</span>
            <select value={minStreak} onChange={(e) => onChangeMinStreak(Number(e.target.value))}
              className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 transition-colors">
              <option value={3}>3 days</option>
              <option value={4}>4 days</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">below</span>
            <select value={rateThreshold} onChange={(e) => onChangeRateThreshold(Number(e.target.value))}
              className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 transition-colors">
              <option value={50}>50%</option>
              <option value={60}>60%</option>
              <option value={70}>70%</option>
              <option value={80}>80%</option>
            </select>
          </div>
          <button onClick={() => setDismissed(true)} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">
            Dismiss
          </button>
        </div>
      </div>

      {alerts.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-zinc-500 py-4 text-center">No agents flagged for consecutive low performance in this date range.</p>
      )}

      <div className="space-y-2.5">
        {alerts.map((a) => {
          const isCritical = a.maxStreak >= 4;
          return (
            <div key={a.agentId} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${isCritical ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isCritical ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"}`}>
                {a.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{a.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  {a.maxStreak}-day low streak · current rate {a.rate}% · {a.total} TX total
                </p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {a.days.map((d) => (
                    <div key={d.date} title={`${fmtDate(d.date)}: ${d.rate !== null ? `${d.rate}%` : "no data"}`}
                      className={`w-3 h-3 rounded-sm transition-colors ${d.rate === null ? "bg-slate-200 dark:bg-zinc-700" : d.rate < rateThreshold ? "bg-red-400" : "bg-green-400"}`} />
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums leading-none ${isCritical ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`}>{a.maxStreak}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">days</p>
                {isCritical && <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[9px] font-bold">CRITICAL</span>}
              </div>
            </div>
          );
        })}
      </div>
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
  const [agentDailyRates, setAgentDailyRates] = useState<Record<string, AgentDailyRate[]>>({});
  const [loading, setLoading]         = useState(false);
  const [sort, setSort]               = useState<[SortKey, "asc"|"desc"]>(["total", "desc"]);
  const [tab, setTab]                 = useState<"overview"|"agents"|"docs">("overview");
  const [exporting, setExporting]     = useState<"pdf"|"excel"|null>(null);
  const [alertMinStreak, setAlertMinStreak]           = useState(3);
  const [alertRateThreshold, setAlertRateThreshold]   = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/kpi/analytics?from=${from}&to=${to}`);
    const d = await res.json();
    setSummary(d.summary);
    setAgentStats(d.agentStats ?? []);
    setDocTypeStats(d.docTypeStats ?? []);
    setDailyTrend(d.dailyTrend ?? []);
    setAgentDailyRates(d.agentDailyRates ?? {});
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const sortedAgents = [...agentStats].sort((a, b) => {
    const av = a[sort[0]] as number, bv = b[sort[0]] as number;
    return sort[1] === "desc" ? bv - av : av - bv;
  });

  const handleSort = (col: SortKey) => {
    setSort(prev => prev[0] === col ? [col, prev[1] === "desc" ? "asc" : "desc"] : [col, "desc"]);
  };

  const topAgent     = agentStats.length ? [...agentStats].sort((a, b) => b.rate - a.rate)[0] : null;
  const lowAgent     = agentStats.length > 1 ? [...agentStats].sort((a, b) => a.rate - b.rate).find(a => a.agentId !== topAgent?.agentId) ?? null : null;
  const mostActive   = agentStats.length ? [...agentStats].sort((a, b) => b.total - a.total)[0] : null;
  const fastestAgent = agentStats.filter(a => a.avgTat > 0).sort((a, b) => a.avgTat - b.avgTat)[0] ?? null;
  const topDoc       = docTypeStats.length ? [...docTypeStats].sort((a, b) => b.count - a.count)[0] : null;

  const maxDaily = Math.max(...dailyTrend.map(d => d.count), 1);
  const maxAgent = Math.max(...agentStats.map(a => a.total), 1);
  const maxDoc   = Math.max(...docTypeStats.map(d => d.count), 1);

  const formattedFrom = new Date(from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formattedTo   = new Date(to   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

  const agentsByRate = [...agentStats].sort((a, b) => b.rate - a.rate);
  const getRateRank  = (agentId: string) => agentsByRate.findIndex(x => x.agentId === agentId) + 1;
  const streakAlerts = getStreakAlerts(agentStats, agentDailyRates, alertMinStreak, alertRateThreshold);

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KPI</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Performance Analytics</h1>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">{formattedFrom} — {formattedTo}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs text-slate-400 dark:text-zinc-500">FROM</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
            <span className="text-xs text-slate-400 dark:text-zinc-500">TO</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
            <button onClick={() => { setFrom(today()); setTo(today()); }}
              className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              Today
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button onClick={handleExcelExport} disabled={!canExport || exporting === "excel"} title={canExport ? "Export to Excel" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"}`}>
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button onClick={handlePdfExport} disabled={!canExport || exporting === "pdf"} title={canExport ? "Export to PDF" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"}`}>
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-sm">Loading analytics…</div>}

        {/* ── Streak Alert Panel ── */}
        {!loading && agentStats.length > 0 && (
          <StreakAlertPanel alerts={streakAlerts} minStreak={alertMinStreak} rateThreshold={alertRateThreshold}
            onChangeMinStreak={setAlertMinStreak} onChangeRateThreshold={setAlertRateThreshold} />
        )}

        {/* ── KPI Summary Cards — now includes Hold + Productive Time ── */}
        {summary && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label: "Total TX",      value: summary.totalTx,                           color: "text-slate-700 dark:text-zinc-200",   sub: "transactions"   },
              { label: "Completion",    value: summary.done,                              color: "text-green-600 dark:text-green-400",   sub: "finished"       },
              { label: "Pending",       value: summary.pending,                           color: "text-amber-500 dark:text-amber-400",   sub: "in queue"       },
              { label: "Hold",          value: summary.hold,                              color: "text-blue-500 dark:text-blue-400",     sub: "on hold"        },
              { label: "Escalation",    value: summary.escalated,                         color: "text-purple-500 dark:text-purple-400", sub: "flagged"        },
              { label: "Avg TAT",       value: formatTat(summary.avgTat),                 color: "text-indigo-500 dark:text-indigo-400", sub: "per tx"         },
              { label: "Rate",          value: `${summary.completionRate}%`,              color: "text-green-600 dark:text-green-400",   sub: "completion"     },
              { label: "Prod. Time",    value: formatTat(summary.totalProductiveSeconds), color: "text-cyan-600 dark:text-cyan-400",     sub: "total active"   },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3 py-4 text-center hover:border-slate-300 dark:hover:border-zinc-600 transition-colors">
                <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Spotlight Cards ── */}
        {agentStats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {topAgent && (
              <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center"><Award size={13} className="text-amber-500 dark:text-amber-400" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400">Top Performer</span>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mb-1 truncate">{topAgent.name}</p>
                <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{topAgent.rate}%</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">completion rate · {topAgent.total} TX</p>
                <div className="mt-3"><DonutRing pct={topAgent.rate} color="text-amber-400" size={40} /></div>
              </div>
            )}
            {lowAgent && (
              <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center"><TrendingDown size={13} className="text-red-500 dark:text-red-400" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400">Needs Attention</span>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mb-1 truncate">{lowAgent.name}</p>
                <p className="text-2xl font-bold text-red-500 dark:text-red-400">{lowAgent.rate}%</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">completion rate · {lowAgent.total} TX</p>
                <div className="mt-3"><DonutRing pct={lowAgent.rate} color="text-red-400" size={40} /></div>
              </div>
            )}
            {mostActive && (
              <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center"><Zap size={13} className="text-indigo-500 dark:text-indigo-400" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Most Active</span>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mb-1 truncate">{mostActive.name}</p>
                <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">{mostActive.total}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">transactions handled</p>
                <div className="mt-3"><MiniBar value={mostActive.total} max={maxAgent} color="bg-indigo-500" /></div>
              </div>
            )}
            {fastestAgent && (
              <div className="bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center"><Target size={13} className="text-green-600 dark:text-green-400" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Fastest TAT</span>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mb-1 truncate">{fastestAgent.name}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400 font-mono">{formatTat(fastestAgent.avgTat)}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">avg turnaround time</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <Clock size={11} className="text-slate-300 dark:text-zinc-600" />
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">{fastestAgent.total} transactions</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-1 w-fit">
          {([
            { key: "overview", label: "Overview",    icon: Activity  },
            { key: "agents",   label: "Agents",      icon: Users     },
            { key: "docs",     label: "Tasks Types", icon: BarChart2 },
          ] as const).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"}`}>
                <Icon size={12} />{t.label}
              </button>
            );
          })}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-500 dark:text-indigo-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Daily Transaction Volume</h2>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">{dailyTrend.length} days</span>
              </div>
              {dailyTrend.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 py-8 text-center">No data in range</p>
              ) : (
                <>
                  <div className="flex items-end gap-1.5 h-40 mb-2">
                    {dailyTrend.map((d, i) => {
                      const pct = Math.max(4, (d.count / maxDaily) * 100);
                      const isMax = d.count === maxDaily;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                          <span className={`text-[10px] font-semibold tabular-nums transition-all ${isMax ? "text-indigo-500 dark:text-indigo-400" : "text-slate-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100"}`}>{d.count}</span>
                          <div className={`w-full rounded-t-md transition-all duration-500 ${isMax ? "bg-indigo-500" : "bg-indigo-200 dark:bg-indigo-900 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-600"}`}
                            style={{ height: `${pct}%`, transitionDelay: `${i * 30}ms` }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between">
                    {dailyTrend.map(d => (
                      <div key={d.date} className="flex-1 text-center">
                        <span className="text-[9px] text-slate-400 dark:text-zinc-500">{fmtDate(d.date).split(" ")[1]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">Transactions</span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto">
                      Peak: <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{maxDaily}</span> on {fmtDate(dailyTrend.find(d => d.count === maxDaily)?.date ?? "")}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-indigo-500 dark:text-indigo-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Agent Volume</h2>
                  </div>
                </div>
                <div className="space-y-3.5">
                  {agentStats.length === 0 && <p className="text-xs text-slate-400 dark:text-zinc-500">No data</p>}
                  {[...agentStats].sort((a, b) => b.total - a.total).map((a) => (
                    <div key={a.agentId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <RankBadge rank={getRateRank(a.agentId)} total={agentStats.length} />
                          <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{a.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          <span className="text-green-600 dark:text-green-400">{a.done}</span>
                          <span className="text-amber-500 dark:text-amber-400">{a.pending}</span>
                          <span className="text-blue-500 dark:text-blue-400">{a.hold}</span>
                          <span className="text-slate-500 dark:text-zinc-400">{a.total}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div className="bg-green-400 rounded-l-full transition-all duration-700" style={{ width: `${(a.done / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                          <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(a.pending / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                          <div className="bg-blue-400 transition-all duration-700" style={{ width: `${(a.hold / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                          <div className="bg-purple-400 transition-all duration-700" style={{ width: `${(a.escalated / Math.max(a.total,1)) * (a.total/maxAgent) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 pt-1 flex-wrap">
                    {[["bg-green-400","Completion"],["bg-amber-400","Pending"],["bg-blue-400","Hold"],["bg-purple-400","Escalation"]].map(([c,l]) => (
                      <div key={l} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-sm ${c}`} />
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={14} className="text-indigo-500 dark:text-indigo-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Tasks Type Volume</h2>
                  </div>
                </div>
                <div className="space-y-3.5">
                  {docTypeStats.length === 0 && <p className="text-xs text-slate-400 dark:text-zinc-500">No data</p>}
                  {[...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => (
                    <div key={d.type}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 dark:text-zinc-600 text-xs font-mono">#{i+1}</span>
                          <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{d.type}</span>
                          {i === 0 && topDoc && <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-[9px] font-bold">MOST</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 dark:text-zinc-500 font-mono">{formatTat(d.avgTat)}</span>
                          <span className="text-slate-600 dark:text-zinc-300">{d.count}</span>
                        </div>
                      </div>
                      <MiniBar value={d.count} max={maxDoc} color="bg-green-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {agentStats.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-5">
                  <CheckCircle2 size={14} className="text-indigo-500 dark:text-indigo-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Completion Rate Comparison</h2>
                </div>
                <div className="flex items-end gap-3">
                  {[...agentStats].sort((a, b) => b.rate - a.rate).map((a, i) => {
                    const isTop = i === 0;
                    const isLow = i === agentStats.length - 1 && agentStats.length > 1;
                    return (
                      <div key={a.agentId} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <span className="text-xs font-bold tabular-nums" style={{ color: isTop ? "#d97706" : isLow ? "#ef4444" : "#6366f1" }}>{a.rate}%</span>
                        <div className="w-full rounded-t-md transition-all duration-700 min-h-[4px]"
                          style={{ height: `${Math.max(4, a.rate)}px`, maxHeight: "120px", background: isTop ? "#f59e0b" : isLow ? "#fca5a5" : "#a5b4fc" }} />
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 text-center truncate w-full">{a.name.split(" ")[0]}</span>
                        {isTop && <span className="text-[9px] text-amber-500 dark:text-amber-400 font-bold">TOP</span>}
                        {isLow && <span className="text-[9px] text-red-500 dark:text-red-400 font-bold">LOW</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Agents Tab — now includes Hold column ── */}
        {tab === "agents" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-indigo-500 dark:text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Agent Statistics</h2>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">{agentStats.length} agents · click headers to sort</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Rank</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Agent</th>
                    <SortTh label="Total"      col="total"     sort={sort} onSort={handleSort} />
                    <SortTh label="Completion" col="done"      sort={sort} onSort={handleSort} />
                    <SortTh label="Pending"    col="pending"   sort={sort} onSort={handleSort} />
                    <SortTh label="Hold"       col="hold"      sort={sort} onSort={handleSort} />
                    <SortTh label="Escalation" col="escalated" sort={sort} onSort={handleSort} />
                    <SortTh label="Avg TAT"    col="avgTat"    sort={sort} onSort={handleSort} />
                    <SortTh label="Rate"       col="rate"      sort={sort} onSort={handleSort} />
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.length === 0 && (
                    <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-400 dark:text-zinc-500 text-sm">No data</td></tr>
                  )}
                  {sortedAgents.map((a) => (
                    <tr key={a.agentId} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3.5"><RankBadge rank={getRateRank(a.agentId)} total={agentStats.length} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {a.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700 dark:text-zinc-200">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-zinc-300 font-semibold tabular-nums">{a.total}</td>
                      <td className="px-4 py-3.5 text-green-600 dark:text-green-400 font-semibold tabular-nums">{a.done}</td>
                      <td className="px-4 py-3.5 text-amber-500 dark:text-amber-400 tabular-nums">{a.pending}</td>
                      <td className="px-4 py-3.5 tabular-nums">
                        <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                          <PauseCircle size={11} />{a.hold}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-purple-500 dark:text-purple-400 tabular-nums">{a.escalated}</td>
                      <td className="px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs tabular-nums">{formatTat(a.avgTat)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`font-bold tabular-nums text-sm ${a.rate >= 80 ? "text-green-600 dark:text-green-400" : a.rate >= 50 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
                          {a.rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 min-w-[120px]">
                        <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${a.rate >= 80 ? "bg-green-500" : a.rate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${a.rate}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Task Types Tab ── */}
        {tab === "docs" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-700 flex items-center gap-2">
                <BarChart2 size={14} className="text-indigo-500 dark:text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Task Type Performance</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-700">
                    {["#", "Type", "Count", "Avg TAT", "Share"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docTypeStats.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-zinc-500 text-sm">No data</td></tr>
                  )}
                  {[...docTypeStats].sort((a, b) => b.count - a.count).map((d, i) => {
                    const total = docTypeStats.reduce((s, x) => s + x.count, 0);
                    const share = total ? Math.round((d.count / total) * 100) : 0;
                    return (
                      <tr key={d.type} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-300 dark:text-zinc-600 text-xs font-mono">#{i+1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 dark:text-zinc-300 font-medium">{d.type}</span>
                            {i === 0 && <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-[9px] font-bold">MOST USED</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300 font-semibold tabular-nums">{d.count}</td>
                        <td className="px-5 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs tabular-nums">{formatTat(d.avgTat)}</td>
                        <td className="px-5 py-3.5 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-green-400 rounded-full transition-all duration-700" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums w-8 text-right">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}