"use client";

import { useState, useEffect, useCallback } from "react";
import { DailyReportModal } from "@/components/kpi/DailyReportModal";
import {
  Users, TrendingUp, Clock, CheckCircle2, FileText, FileSpreadsheet,
  ChevronDown, ChevronRight, Layers, Ungroup, Building2, Package,
  BarChart3, ListTree, Target, Activity, AlertTriangle, PauseCircle,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─── */
interface AgentProductivity {
  agentId:            string;
  agentName:          string;
  group:              string;
  productivity:       number;
  avgTat:             number;
  totalVolume:        number;
  txCount:            number;
  completionRate:     number;
  pendingRate:        number;
  escalationRate:     number;
  holdRate:           number;
  docTypeCounts:      Record<string, number>;
  companies:          string[];
  productionCount:    number;
  nonProductionCount: number;
  subtaskCount:       number;
  statusBreakdown:    { completion: number; pending: number; escalation: number; hold: number };
  volumeByDocType:    Record<string, number>;
}

interface DailySummaryEntry {
  date:   string;
  counts: Record<string, number>;
}

/* ─── Helpers ─── */
function formatHms(sec: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function today()            { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/* ─── Mini rate bar ─── */
function RateBar({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-zinc-400 w-10 text-right">
        {value.toFixed(1)}%
      </span>
      {label && <span className="text-[10px] text-slate-400 dark:text-zinc-500 w-16">{label}</span>}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─── Status pill ─── */
function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${color}`}>
      {count} {label}
    </span>
  );
}

/* ─── Agent detail drawer ─── */
function AgentDetailDrawer({ row, allDocTypes }: { row: AgentProductivity; allDocTypes: string[] }) {
  const maxDt  = Math.max(...Object.values(row.docTypeCounts), 1);
  const maxVol = Math.max(...Object.values(row.volumeByDocType), 1);
  const totalTx = row.txCount || 1;

  return (
    <tr className="border-b border-slate-100 dark:border-zinc-800">
      <td colSpan={10} className="px-0 pb-4 pt-0">
        <div className="mx-4 grid grid-cols-4 gap-3">

          {/* Status rates */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Activity size={10} /> Status rates
            </p>
            {[
              { label: "Completion",  count: row.statusBreakdown.completion,  rate: row.completionRate,  color: "bg-green-500",  pill: "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800 dark:text-green-400" },
              { label: "Pending",     count: row.statusBreakdown.pending,     rate: row.pendingRate,     color: "bg-amber-400",  pill: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400" },
              { label: "Escalation",  count: row.statusBreakdown.escalation,  rate: row.escalationRate,  color: "bg-purple-500", pill: "text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-400" },
              { label: "Hold",        count: row.statusBreakdown.hold,        rate: row.holdRate,        color: "bg-sky-400",    pill: "text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-400" },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <StatusPill label={s.label} count={s.count} color={s.pill} />
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">{s.count}/{totalTx}</span>
                </div>
                <RateBar value={s.rate} color={s.color} />
              </div>
            ))}
            <div className="pt-1 border-t border-slate-200 dark:border-zinc-700 flex gap-2">
              <div className="flex-1 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-center">
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{row.productionCount}</p>
                <p className="text-[9px] text-indigo-500 uppercase tracking-wide">Prod</p>
              </div>
              <div className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 text-center">
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-200">{row.nonProductionCount}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Non-prod</p>
              </div>
              <div className="flex-1 px-2 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{row.subtaskCount}</p>
                <p className="text-[9px] text-violet-500 uppercase tracking-wide">Subtasks</p>
              </div>
            </div>
          </div>

          {/* Task counts */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <BarChart3 size={10} /> Task counts
            </p>
            <div className="space-y-2">
              {allDocTypes.filter(dt => row.docTypeCounts[dt] > 0).map(dt => (
                <div key={dt}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-600 dark:text-zinc-300 truncate max-w-[110px]">{dt}</span>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums ml-2">{row.docTypeCounts[dt]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={row.docTypeCounts[dt]} max={maxDt} color="bg-indigo-400 dark:bg-indigo-500" />
                  </div>
                </div>
              ))}
              {allDocTypes.every(dt => !row.docTypeCounts[dt]) && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">No tasks</p>
              )}
            </div>
          </div>

          {/* Volume by task */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Package size={10} /> Volume by task
            </p>
            <div className="space-y-2">
              {allDocTypes.filter(dt => (row.volumeByDocType[dt] ?? 0) > 0).map(dt => (
                <div key={dt}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-600 dark:text-zinc-300 truncate max-w-[110px]">{dt}</span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums ml-2">{row.volumeByDocType[dt]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={row.volumeByDocType[dt]} max={maxVol} color="bg-emerald-400 dark:bg-emerald-500" />
                  </div>
                </div>
              ))}
              {allDocTypes.every(dt => !(row.volumeByDocType[dt] ?? 0)) && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">No volume</p>
              )}
            </div>
          </div>

          {/* Companies */}
          <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
              <Building2 size={10} /> Companies ({row.companies.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {row.companies.slice(0, 10).map(c => (
                <span key={c} className="px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] text-slate-600 dark:text-zinc-300 font-medium truncate max-w-[100px]">{c}</span>
              ))}
              {row.companies.length > 10 && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700 text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">+{row.companies.length - 10} more</span>
              )}
              {row.companies.length === 0 && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">No companies</p>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─── Export helpers ─── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportToExcel(
  grouped: Record<string, AgentProductivity[]>,
  groups: string[],
  allRows: AgentProductivity[],
  globalDocTypeCounts: Record<string, number>,
  dailySummary: DailySummaryEntry[],
  from: string,
  to: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();
  const allDocTypes = Object.keys(globalDocTypeCounts).sort();

  for (const group of groups) {
    const rows = grouped[group] ?? [];
    const data = rows.map((r, i) => {
      const base: Record<string, unknown> = {
        "#":              i + 1,
        "Agent":          r.agentName,
        "Productivity":   formatHms(r.productivity),
        "Total Volume":   r.totalVolume,
        "TX Count":       r.txCount,
        "Subtasks":       r.subtaskCount,
        "Production TX":  r.productionCount,
        "Non-Prod TX":    r.nonProductionCount,
        "Completion %":   +r.completionRate.toFixed(2),
        "Pending %":      +r.pendingRate.toFixed(2),
        "Escalation %":   +r.escalationRate.toFixed(2),
        "Hold %":         +r.holdRate.toFixed(2),
        "Companies":      r.companies.join(", "),
      };
      for (const dt of allDocTypes) { base[dt] = r.docTypeCounts[dt] ?? 0; }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, group.slice(0, 31));
  }

  const docSummaryData = allDocTypes.map(dt => ({ "Task Type": dt, "Total": globalDocTypeCounts[dt] ?? 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docSummaryData), "Task Summary");

  const dailyRows = dailySummary.map(d => {
    const row: Record<string, unknown> = { "Date": d.date };
    let total = 0;
    for (const dt of allDocTypes) { const v = d.counts[dt] ?? 0; row[dt] = v; total += v; }
    row["Grand Total"] = total;
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), "Daily Tasks");

  const totalTat    = allRows.reduce((s, r) => s + r.productivity, 0);
  const totalVolume = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTx     = allRows.reduce((s, r) => s + r.txCount, 0);
  const totalSubs   = allRows.reduce((s, r) => s + r.subtaskCount, 0);
  const avgCompl    = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;

  const summaryData = [
    ["Date Range",        `${from} to ${to}`],
    ["Total Agents",      allRows.length],
    ["Total Volume",      totalVolume],
    ["Total TX",          totalTx],
    ["Total Subtasks",    totalSubs],
    ["Total THT",         formatHms(totalTat)],
    ["Avg Completion %",  +avgCompl.toFixed(2)],
    [],
    ["Task Type Totals"],
    ...allDocTypes.map(dt => [dt, globalDocTypeCounts[dt] ?? 0]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
  XLSX.writeFile(wb, `productivity_${from}_to_${to}.xlsx`);
}

async function exportToPdf(
  grouped: Record<string, AgentProductivity[]>,
  groups: string[],
  allRows: AgentProductivity[],
  globalDocTypeCounts: Record<string, number>,
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

  const totalTat    = allRows.reduce((s, r) => s + r.productivity, 0);
  const totalVolume = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTx     = allRows.reduce((s, r) => s + r.txCount, 0);
  const totalSubs   = allRows.reduce((s, r) => s + r.subtaskCount, 0);
  const avgCompl    = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;

  doc.setFillColor(30, 30, 46); doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Productivity Report", 10, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 190);
  doc.text(`${formattedFrom} — ${formattedTo}`, 10, 20);

  const statItems = [
    { label: "AGENTS",       value: String(allRows.length) },
    { label: "TOTAL VOLUME", value: String(totalVolume) },
    { label: "TOTAL TX",     value: String(totalTx) },
    { label: "SUBTASKS",     value: String(totalSubs) },
    { label: "TOTAL THT",    value: formatHms(totalTat) },
    { label: "AVG COMPL.",   value: `${avgCompl.toFixed(1)}%` },
  ];
  statItems.forEach((s, i) => {
    const x = 10 + i * 48;
    doc.setFillColor(40, 40, 60); doc.roundedRect(x, 25, 44, 14, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 22, 32, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 160);
    doc.text(s.label, x + 22, 37, { align: "center" });
  });

  let cursorY = 44;
  for (const group of groups) {
    const rows = grouped[group] ?? [];
    const groupTat     = rows.reduce((s, r) => s + r.productivity, 0);
    const groupVol     = rows.reduce((s, r) => s + r.totalVolume, 0);
    const groupCompl   = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;
    const groupEscl    = rows.length ? rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length : 0;

    if (cursorY > 175) { doc.addPage(); cursorY = 10; }
    doc.setFillColor(40, 40, 65); doc.rect(10, cursorY, 277, 7, "F");
    doc.setTextColor(160, 160, 210); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(group.toUpperCase(), 13, cursorY + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 160);
    doc.text(`${rows.length} agents  ·  Vol: ${groupVol}  ·  THT: ${formatHms(groupTat)}  ·  Compl: ${groupCompl.toFixed(1)}%  ·  Escl: ${groupEscl.toFixed(1)}%`, 287, cursorY + 5, { align: "right" });
    cursorY += 8;

    const body = rows.map((r, i) => [
      i + 1, r.agentName, formatHms(r.productivity), r.totalVolume, r.txCount, r.subtaskCount,
      `${r.productionCount} / ${r.nonProductionCount}`,
      `${r.completionRate.toFixed(1)}%`, `${r.pendingRate.toFixed(1)}%`,
      `${r.escalationRate.toFixed(1)}%`, `${r.holdRate.toFixed(1)}%`,
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: cursorY,
      head: [["#", "Agent", "Productivity", "Vol", "TX", "Subtasks", "Prod/Non", "Compl%", "Pending%", "Escl%", "Hold%"]],
      body,
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: 35 },
        2: { cellWidth: 26, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
        3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 16, halign: "center" }, 6: { cellWidth: 20, halign: "center" },
        7: { cellWidth: 20, halign: "center", textColor: [80, 200, 120] },
        8: { cellWidth: 20, halign: "center", textColor: [220, 170, 60] },
        9: { cellWidth: 20, halign: "center", textColor: [180, 100, 230] },
        10: { cellWidth: 20, halign: "center", textColor: [80, 180, 220] },
      },
      margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }
  doc.save(`productivity_${from}_to_${to}.pdf`);
}

/* ─── Agent table row ─── */
function AgentRow({
  row, allDocTypes, expandedAgents, toggleAgent
}: {
  row: AgentProductivity;
  allDocTypes: string[];
  expandedAgents: Set<string>;
  toggleAgent: (id: string) => void;
}) {
  const expanded = expandedAgents.has(row.agentId);
  return (
    <>
      <tr
        onClick={() => toggleAgent(row.agentId)}
        className={`border-b border-slate-100 dark:border-zinc-800 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 ${expanded ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""}`}
      >
        <td className="px-4 py-3 w-8 text-slate-400 dark:text-zinc-500">
          {expanded
            ? <ChevronDown size={13} className="text-indigo-400" />
            : <ChevronRight size={13} className="text-slate-300 dark:text-zinc-600" />}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {row.agentName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 leading-tight">{row.agentName}</p>
              {row.companies.length > 0 && (
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[130px]">
                  {row.companies.slice(0, 2).join(", ")}{row.companies.length > 2 ? ` +${row.companies.length - 2}` : ""}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center font-mono text-indigo-500 dark:text-indigo-400 font-semibold text-xs tabular-nums">
          {formatHms(row.productivity)}
        </td>
        <td className="px-3 py-3 text-center text-slate-700 dark:text-zinc-200 font-semibold tabular-nums">
          {row.totalVolume}
        </td>
        <td className="px-3 py-3 text-center text-slate-600 dark:text-zinc-300 tabular-nums text-sm">
          {row.txCount}
        </td>
        <td className="px-3 py-3 text-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[10px] font-semibold tabular-nums">
            <ListTree size={8} />{row.subtaskCount}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold tabular-nums">{row.productionCount}</span>
            <span className="text-slate-300 dark:text-zinc-600">/</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 font-semibold tabular-nums">{row.nonProductionCount}</span>
          </div>
        </td>
        {/* Rate columns */}
        <td className="px-3 py-3 min-w-[100px]">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(row.completionRate, 100)}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-green-600 dark:text-green-400 font-semibold w-8 text-right">{row.completionRate.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(row.pendingRate, 100)}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400 font-semibold w-8 text-right">{row.pendingRate.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(row.escalationRate, 100)}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-purple-600 dark:text-purple-400 font-semibold w-8 text-right">{row.escalationRate.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
              <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.min(row.holdRate, 100)}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-sky-600 dark:text-sky-400 font-semibold w-8 text-right">{row.holdRate.toFixed(0)}%</span>
            </div>
          </div>
        </td>
        {/* Per-agent task list */}
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {Object.entries(row.docTypeCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([dt, count]) => (
                <span key={dt} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] text-slate-600 dark:text-zinc-300">
                  <span className="truncate max-w-[60px]">{dt}</span>
                  <span className="font-bold text-indigo-500 dark:text-indigo-400">{count}</span>
                </span>
              ))}
            {Object.keys(row.docTypeCounts).length > 4 && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] text-slate-400 dark:text-zinc-500">
                +{Object.keys(row.docTypeCounts).length - 4}
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && <AgentDetailDrawer row={row} allDocTypes={allDocTypes} />}
    </>
  );
}

/* ─── Main Page ─── */
export default function ProductivityPage() {
  const [from, setFrom]   = useState(daysAgo(6));
  const [to,   setTo]     = useState(today());
  const [grouped,  setGrouped]  = useState<Record<string, AgentProductivity[]>>({});
  const [groups,   setGroups]   = useState<string[]>([]);
  const [globalDocTypeCounts, setGlobalDocTypeCounts] = useState<Record<string, number>>({});
  const [dailySummary, setDailySummary] = useState<DailySummaryEntry[]>([]);
  const [loading,   setLoading]  = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedAgents,   setExpandedAgents]   = useState<Set<string>>(new Set());
  const [collapsedGroups,  setCollapsedGroups]  = useState<Set<string>>(new Set());
  const [showDocSummary,   setShowDocSummary]   = useState(true);
  const [activeTab,        setActiveTab]        = useState<"overview" | "companies" | "daily">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/productivity?from=${from}&to=${to}`);
      const d   = await res.json();
      setGrouped(d.grouped ?? {});
      setGroups(d.groups   ?? []);
      setGlobalDocTypeCounts(d.globalDocTypeCounts ?? {});
      setDailySummary(d.dailySummary ?? []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const allRows       = Object.values(grouped).flat();
  const totalVolume   = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTat      = allRows.reduce((s, r) => s + r.productivity, 0);
  const totalTx       = allRows.reduce((s, r) => s + r.txCount, 0);
  const totalSubs     = allRows.reduce((s, r) => s + r.subtaskCount, 0);
  const totalProd     = allRows.reduce((s, r) => s + r.productionCount, 0);
  const totalNonProd  = allRows.reduce((s, r) => s + r.nonProductionCount, 0);
  const totalCompl    = allRows.reduce((s, r) => s + r.statusBreakdown.completion, 0);
  const totalPending  = allRows.reduce((s, r) => s + r.statusBreakdown.pending, 0);
  const totalEscl     = allRows.reduce((s, r) => s + r.statusBreakdown.escalation, 0);
  const totalHold     = allRows.reduce((s, r) => s + r.statusBreakdown.hold, 0);
  const avgCompletion = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;
  const allDocTypes   = Object.keys(globalDocTypeCounts).sort();
  const allCompanies  = [...new Set(allRows.flatMap(r => r.companies))].sort();

  const formattedFrom = new Date(from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formattedTo   = new Date(to   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const canExport     = allRows.length > 0;

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => { const n = new Set(prev); n.has(agentId) ? n.delete(agentId) : n.add(agentId); return n; });
  };
  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(group) ? n.delete(group) : n.add(group); return n; });
  };

  const flatRows = [...allRows].sort((a, b) => a.agentName.localeCompare(b.agentName));

  const renderAgentTable = (rows: AgentProductivity[]) => {
    const groupTat      = rows.reduce((s, r) => s + r.productivity, 0);
    const groupVolume   = rows.reduce((s, r) => s + r.totalVolume, 0);
    const groupTx       = rows.reduce((s, r) => s + r.txCount, 0);
    const groupSubs     = rows.reduce((s, r) => s + r.subtaskCount, 0);
    const groupProd     = rows.reduce((s, r) => s + r.productionCount, 0);
    const groupNonProd  = rows.reduce((s, r) => s + r.nonProductionCount, 0);
    const groupAvgCompl = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;
    const groupAvgEscl  = rows.length ? rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length : 0;

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
              <th className="text-left px-4 py-3 w-8" />
              <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Agent</th>
              <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Productivity</th>
              <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Volume</th>
              <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">TX</th>
              <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400">Subtasks</th>
              <th className="text-center px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Prod/Non</th>
              <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 min-w-[130px]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>Completion</span></div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span>Pending</span></div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /><span>Escalation</span></div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-sky-400" /><span>Hold</span></div>
                </div>
              </th>
              <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 min-w-[160px]">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <AgentRow
                key={row.agentId}
                row={row}
                allDocTypes={allDocTypes}
                expandedAgents={expandedAgents}
                toggleAgent={toggleAgent}
              />
            ))}

            {rows.length > 1 && (
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-t-2 border-slate-200 dark:border-zinc-700">
                <td className="px-4 py-2.5 w-8" />
                <td className="px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Subtotal</td>
                <td className="text-center px-3 py-2.5 font-mono text-indigo-500 dark:text-indigo-400 font-bold text-xs tabular-nums">{formatHms(groupTat)}</td>
                <td className="text-center px-3 py-2.5 text-slate-700 dark:text-zinc-200 font-bold tabular-nums">{groupVolume}</td>
                <td className="text-center px-3 py-2.5 text-slate-600 dark:text-zinc-300 font-semibold tabular-nums">{groupTx}</td>
                <td className="text-center px-3 py-2.5 text-violet-600 dark:text-violet-400 font-bold tabular-nums">{groupSubs}</td>
                <td className="text-center px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className="text-indigo-500 font-bold">{groupProd}</span>
                    <span className="text-slate-300 dark:text-zinc-600">/</span>
                    <span className="text-slate-500 font-bold">{groupNonProd}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${Math.min(groupAvgCompl, 100)}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-green-600 dark:text-green-400 font-semibold w-8 text-right">{groupAvgCompl.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                      <div className="flex-1 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${Math.min(groupAvgEscl, 100)}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-purple-600 dark:text-purple-400 font-semibold w-8 text-right">{groupAvgEscl.toFixed(0)}%</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">KPI</p>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Productivity Report</h1>
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
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <DailyReportModal
  date={from}
  data={{ grouped, groups, globalDocTypeCounts, dailySummary }}
/>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button onClick={() => setIsGrouped(g => !g)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                isGrouped
                  ? "bg-slate-700 dark:bg-slate-600 border-slate-700 text-white"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
              }`}>
              {isGrouped ? <Layers size={13} /> : <Ungroup size={13} />}
              {isGrouped ? "Grouped" : "Ungrouped"}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button
              onClick={async () => { setExporting("excel"); try { await exportToExcel(grouped, groups, allRows, globalDocTypeCounts, dailySummary, from, to); } finally { setExporting(null); } }}
              disabled={!canExport || exporting === "excel"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"}`}>
              <FileSpreadsheet size={13} />{exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button
              onClick={async () => { setExporting("pdf"); try { await exportToPdf(grouped, groups, allRows, globalDocTypeCounts, from, to, formattedFrom, formattedTo); } finally { setExporting(null); } }}
              disabled={!canExport || exporting === "pdf"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"}`}>
              <FileText size={13} />{exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* Summary cards — two rows: totals + status breakdown */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
          {[
            { icon: Users,        label: "Agents",       value: allRows.length,          cls: "text-slate-900 dark:text-zinc-100" },
            { icon: TrendingUp,   label: "Volume",       value: totalVolume,             cls: "text-slate-900 dark:text-zinc-100" },
            { icon: Target,       label: "Total TX",     value: totalTx,                 cls: "text-slate-900 dark:text-zinc-100" },
            { icon: ListTree,     label: "Subtasks",     value: totalSubs,               cls: "text-violet-600 dark:text-violet-400" },
            { icon: Clock,        label: "Total THT",    value: formatHms(totalTat),     cls: "text-indigo-600 dark:text-indigo-400 font-mono" },
            { icon: Activity,     label: "Production",   value: totalProd,               cls: "text-indigo-500 dark:text-indigo-400" },
            { icon: Building2,    label: "Companies",    value: allCompanies.length,     cls: "text-slate-900 dark:text-zinc-100" },
            { icon: CheckCircle2, label: "Avg compl.",   value: `${avgCompletion.toFixed(1)}%`, cls: "text-green-600 dark:text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3 py-3 flex flex-col gap-1">
              <s.icon size={12} className="text-indigo-400 dark:text-indigo-500" />
              <p className={`text-base font-bold leading-tight tabular-nums ${s.cls}`}>{s.value}</p>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Status breakdown bar */}
        {totalTx > 0 && (
          <div className="mb-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-3">
            <div className="flex items-center gap-4 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Status breakdown — all agents</p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 ml-auto">
                {[
                  { label: "Completion", count: totalCompl, pct: (totalCompl / totalTx * 100), color: "bg-green-500", text: "text-green-600 dark:text-green-400" },
                  { label: "Pending",    count: totalPending, pct: (totalPending / totalTx * 100), color: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
                  { label: "Escalation", count: totalEscl, pct: (totalEscl / totalTx * 100), color: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
                  { label: "Hold",       count: totalHold, pct: (totalHold / totalTx * 100), color: "bg-sky-400", text: "text-sky-600 dark:text-sky-400" },
                ].map(s => (
                  <span key={s.label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span>{s.label}</span>
                    <span className={`font-semibold tabular-nums ${s.text}`}>{s.count} ({s.pct.toFixed(1)}%)</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              {[
                { pct: totalCompl / totalTx * 100,   color: "bg-green-500" },
                { pct: totalPending / totalTx * 100, color: "bg-amber-400" },
                { pct: totalEscl / totalTx * 100,    color: "bg-purple-500" },
                { pct: totalHold / totalTx * 100,    color: "bg-sky-400" },
              ].filter(s => s.pct > 0).map((s, i) => (
                <div key={i} className={`${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        {!loading && allRows.length > 0 && (
          <div className="flex items-center gap-1 mb-5 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1 w-fit">
            {(["overview", "companies", "daily"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                }`}>
                {tab === "companies" ? "Companies" : tab === "daily" ? "Daily Tasks" : "Agent Overview"}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 dark:text-zinc-500 text-sm">Loading productivity data…</p>
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <TrendingUp size={32} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-zinc-400 text-sm">No productivity data for the selected date range.</p>
            <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Make sure agents have completed transactions in this period.</p>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {!loading && activeTab === "overview" && (
          <div className="space-y-5">

            {/* Task type summary */}
            {allDocTypes.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                <button onClick={() => setShowDocSummary(s => !s)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Task type summary</span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {allDocTypes.length} types · {Object.values(globalDocTypeCounts).reduce((a, b) => a + b, 0)} total
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 dark:text-zinc-500 transition-transform ${showDocSummary ? "rotate-180" : ""}`} />
                </button>
                {showDocSummary && (
                  <div className="border-t border-slate-200 dark:border-zinc-700 px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {allDocTypes.map(dt => {
                        const count    = globalDocTypeCounts[dt] ?? 0;
                        const maxCount = Math.max(...Object.values(globalDocTypeCounts), 1);
                        return (
                          <div key={dt} className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mb-1">{dt}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                              </div>
                              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Agent tables */}
            {isGrouped
              ? groups.map(group => {
                  const rows          = grouped[group] ?? [];
                  const groupVolume   = rows.reduce((s, r) => s + r.totalVolume, 0);
                  const groupTat      = rows.reduce((s, r) => s + r.productivity, 0);
                  const groupTx       = rows.reduce((s, r) => s + r.txCount, 0);
                  const groupSubs     = rows.reduce((s, r) => s + r.subtaskCount, 0);
                  const groupAvgCompl = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;
                  const groupAvgEscl  = rows.length ? rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length : 0;
                  const collapsed     = collapsedGroups.has(group);

                  return (
                    <div key={group}>
                      <button onClick={() => toggleGroup(group)} className="flex items-center gap-3 mb-2 w-full text-left">
                        <div className="flex items-center gap-2">
                          {collapsed ? <ChevronRight size={13} className="text-slate-400 dark:text-zinc-500" /> : <ChevronDown size={13} className="text-indigo-500 dark:text-indigo-400" />}
                          <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                          <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">{group}</h2>
                        </div>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                        <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-zinc-500 flex-wrap">
                          <span>{rows.length} agent{rows.length !== 1 ? "s" : ""}</span>
                          <span>Vol: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{groupVolume}</span></span>
                          <span>TX: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{groupTx}</span></span>
                          <span>Subtasks: <span className="text-violet-600 dark:text-violet-400 font-semibold">{groupSubs}</span></span>
                          <span>THT: <span className="text-indigo-500 dark:text-indigo-400 font-mono font-semibold">{formatHms(groupTat)}</span></span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-green-600 dark:text-green-400 font-semibold">{groupAvgCompl.toFixed(1)}%</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">{groupAvgEscl.toFixed(1)}%</span>
                          </span>
                        </div>
                      </button>
                      {!collapsed && renderAgentTable(rows)}
                    </div>
                  );
                })
              : flatRows.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-500" />
                      <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">All Agents</h2>
                    </div>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">{flatRows.length} agents</span>
                  </div>
                  {renderAgentTable(flatRows)}
                </div>
              )
            }

            {/* Overall totals bar */}
            {allRows.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {[
                    { label: "Total THT",      value: formatHms(totalTat),           cls: "text-indigo-600 dark:text-indigo-400 font-mono" },
                    { label: "Total volume",   value: totalVolume,                    cls: "text-slate-900 dark:text-zinc-100" },
                    { label: "Total TX",       value: totalTx,                        cls: "text-slate-900 dark:text-zinc-100" },
                    { label: "Total subtasks", value: totalSubs,                      cls: "text-violet-600 dark:text-violet-400" },
                    { label: "Production",     value: totalProd,                      cls: "text-indigo-500 dark:text-indigo-400" },
                    { label: "Non-prod",       value: totalNonProd,                   cls: "text-slate-500 dark:text-zinc-400" },
                    { label: "Avg completion", value: `${avgCompletion.toFixed(1)}%`, cls: "text-green-600 dark:text-green-400" },
                    { label: "Companies",      value: allCompanies.length,            cls: "text-slate-900 dark:text-zinc-100" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className={`text-sm font-bold tabular-nums ${s.cls}`}>{s.value}</p>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMPANIES TAB ── */}
        {!loading && activeTab === "companies" && allRows.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <Building2 size={13} className="text-indigo-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Companies by agent</span>
              <span className="ml-auto text-[11px] text-slate-400 dark:text-zinc-500">{allCompanies.length} unique</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {allRows.sort((a, b) => b.companies.length - a.companies.length).map(row => (
                <div key={row.agentId} className="px-5 py-3.5 flex items-start gap-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {row.agentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{row.agentName}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">{row.companies.length} companies · {row.txCount} TX · Vol {row.totalVolume}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.companies.map(c => (
                        <span key={c} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] text-slate-600 dark:text-zinc-300 font-medium">{c}</span>
                      ))}
                      {row.companies.length === 0 && <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic">No companies recorded</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-xs text-indigo-500 dark:text-indigo-400 font-semibold">{formatHms(row.productivity)}</p>
                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Productivity</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DAILY TAB ── */}
        {!loading && activeTab === "daily" && dailySummary.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <BarChart3 size={13} className="text-indigo-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Daily task breakdown</span>
              <span className="ml-auto text-[11px] text-slate-400 dark:text-zinc-500">{dailySummary.length} days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500 sticky left-0 bg-slate-50 dark:bg-zinc-800 min-w-[90px]">Date</th>
                    {allDocTypes.map(dt => (
                      <th key={dt} className="text-center px-3 py-2.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 whitespace-nowrap min-w-[80px]">{dt}</th>
                    ))}
                    <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-500 min-w-[60px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((day, i) => {
                    const dayTotal = Object.values(day.counts).reduce((a, b) => a + b, 0);
                    const maxDay   = Math.max(...dailySummary.map(d => Object.values(d.counts).reduce((a, b) => a + b, 0)), 1);
                    const pct      = (dayTotal / maxDay) * 100;
                    return (
                      <tr key={day.date} className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors ${i === dailySummary.length - 1 ? "border-b-0" : ""}`}>
                        <td className="px-5 py-2.5 sticky left-0 bg-white dark:bg-zinc-900">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden flex-shrink-0">
                              <div className="w-full bg-indigo-400 dark:bg-indigo-500 rounded-full" style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                            </div>
                            <span className="font-medium text-slate-600 dark:text-zinc-300">{fmtDate(day.date)}</span>
                          </div>
                        </td>
                        {allDocTypes.map(dt => {
                          const count = day.counts[dt] ?? 0;
                          return (
                            <td key={dt} className="text-center px-3 py-2.5 tabular-nums">
                              {count > 0
                                ? <span className="font-semibold text-slate-700 dark:text-zinc-200">{count}</span>
                                : <span className="text-slate-200 dark:text-zinc-700">—</span>
                              }
                            </td>
                          );
                        })}
                        <td className="text-center px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{dayTotal}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700">
                    <td className="px-5 py-2.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase sticky left-0 bg-slate-50 dark:bg-zinc-800">Total</td>
                    {allDocTypes.map(dt => (
                      <td key={dt} className="text-center px-3 py-2.5 font-bold text-slate-700 dark:text-zinc-200 tabular-nums">
                        {globalDocTypeCounts[dt] ?? 0}
                      </td>
                    ))}
                    <td className="text-center px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {Object.values(globalDocTypeCounts).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeTab === "daily" && dailySummary.length === 0 && allRows.length > 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <p className="text-slate-400 dark:text-zinc-500 text-sm">No daily data available for this range.</p>
          </div>
        )}

      </main>
    </div>
  );
}