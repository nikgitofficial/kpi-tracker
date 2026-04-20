"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, FileText, FileSpreadsheet, Calendar, Users,
  TrendingUp, ChevronDown, BarChart3, Download,
  Loader2,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */
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

interface DailyReportModalProps {
  /** ISO date string, e.g. "2024-05-21" — defaults to today */
  date?: string;
  /** Optional: pre-loaded data. If not provided the modal fetches it. */
  data?: {
    grouped:              Record<string, AgentProductivity[]>;
    groups:               string[];
    globalDocTypeCounts:  Record<string, number>;
    dailySummary:         DailySummaryEntry[];
  };
  /** Render a custom trigger button. If omitted, a default button is shown. */
  trigger?: React.ReactNode;
}

/* ─── Helpers ────────────────────────────────────────── */
function formatHms(sec: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function fmtDisplay(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const el = document.createElement("script");
    el.src = src;
    el.onload  = () => resolve();
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

/* ─── Export helpers ─────────────────────────────────── */
async function runExcelExport(
  allRows:              AgentProductivity[],
  allDocTypes:          string[],
  globalDocTypeCounts:  Record<string, number>,
  date:                 string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  /* Sheet 1 – Agent rows */
  const agentData = allRows.map((r, i) => {
    const base: Record<string, unknown> = {
      "#":            i + 1,
      "Agent":        r.agentName,
      "Group":        r.group,
      "Productivity": formatHms(r.productivity),
      "Volume":       r.totalVolume,
      "TX Count":     r.txCount,
      "Subtasks":     r.subtaskCount,
      "Prod TX":      r.productionCount,
      "Non-Prod TX":  r.nonProductionCount,
      "Completion %": +r.completionRate.toFixed(2),
      "Pending %":    +r.pendingRate.toFixed(2),
      "Escalation %": +r.escalationRate.toFixed(2),
      "Hold %":       +r.holdRate.toFixed(2),
    };
    for (const dt of allDocTypes) base[dt] = r.docTypeCounts[dt] ?? 0;
    return base;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agentData), "Agents");

  /* Sheet 2 – Task type totals */
  const taskData = allDocTypes.map(dt => ({ "Task Type": dt, "Total": globalDocTypeCounts[dt] ?? 0 }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskData), "Task Summary");

  XLSX.writeFile(wb, `daily-report_${date}.xlsx`);
}

async function runPdfExport(
  allRows:              AgentProductivity[],
  allDocTypes:          string[],
  globalDocTypeCounts:  Record<string, number>,
  date:                 string,
  formattedDate:        string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  /* Header band */
  doc.setFillColor(22, 22, 40);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Daily Report", 10, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 190);
  doc.text(formattedDate, 10, 20);

  /* Summary stats */
  const totalVol   = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTx    = allRows.reduce((s, r) => s + r.txCount, 0);
  const avgCompl   = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;
  const statItems  = [
    { label: "AGENTS",       value: String(allRows.length) },
    { label: "TOTAL VOLUME", value: String(totalVol) },
    { label: "TOTAL TX",     value: String(totalTx) },
    { label: "AVG COMPL.",   value: `${avgCompl.toFixed(1)}%` },
  ];
  statItems.forEach((s, i) => {
    const x = 10 + i * 50;
    doc.setFillColor(35, 35, 58); doc.roundedRect(x, 25, 46, 14, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 23, 32, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 160);
    doc.text(s.label, x + 23, 37, { align: "center" });
  });

  /* Main table — columns: Agent | [one col per task type] | Total TX | Compl% */
  const head = ["#", "Agent", "Group", ...allDocTypes, "Total TX", "Compl %"];
  const body = allRows.map((r, i) => [
    i + 1,
    r.agentName,
    r.group,
    ...allDocTypes.map(dt => r.docTypeCounts[dt] ?? 0),
    r.txCount,
    `${r.completionRate.toFixed(1)}%`,
  ]);

  /* Totals row */
  body.push([
    "", "TOTAL", "",
    ...allDocTypes.map(dt => globalDocTypeCounts[dt] ?? 0),
    totalTx,
    `${avgCompl.toFixed(1)}%`,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 44,
    head: [head],
    body,
    styles:           { fontSize: 7.5, cellPadding: 2, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
    headStyles:       { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [28, 28, 48] },
    didParseCell:     (data: { row: { index: number }; cell: { styles: { fontStyle: string; textColor: number[] } } }) => {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [200, 200, 255];
      }
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }
  doc.save(`daily-report_${date}.pdf`);
}

/* ─── Status pill ────────────────────────────────────── */
function RatePill({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-semibold tabular-nums w-8 ${color.replace("bg-", "text-").replace("-500", "-600").replace("-400", "-400")}`}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

/* ─── The modal itself ───────────────────────────────── */
interface ModalContentProps {
  date:          string;
  onClose:       () => void;
  externalData?: DailyReportModalProps["data"];
}

function DailyReportModalContent({ date, onClose, externalData }: ModalContentProps) {
  const [loading, setLoading]   = useState(!externalData);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [grouped,  setGrouped]  = useState<Record<string, AgentProductivity[]>>(externalData?.grouped  ?? {});
  const [groups,   setGroups]   = useState<string[]>(externalData?.groups    ?? []);
  const [globalDocTypeCounts, setGlobalDocTypeCounts] = useState<Record<string, number>>(externalData?.globalDocTypeCounts ?? {});

  const formattedDate = fmtDisplay(date);
  const allDocTypes   = Object.keys(globalDocTypeCounts).sort();
  const allRows       = Object.values(grouped).flat();
  const totalVolume   = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTx       = allRows.reduce((s, r) => s + r.txCount, 0);
  const avgCompl      = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;
  const canExport     = allRows.length > 0;

  /* Fetch if no external data */
  const fetch_ = useCallback(async () => {
    if (externalData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/productivity?from=${date}&to=${date}`);
      const d   = await res.json();
      setGrouped(d.grouped ?? {});
      setGroups(d.groups   ?? []);
      setGlobalDocTypeCounts(d.globalDocTypeCounts ?? {});
    } finally {
      setLoading(false);
    }
  }, [date, externalData]);

  useEffect(() => { fetch_(); }, [fetch_]);

  /* Block body scroll */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleExcel = async () => {
    setExporting("excel");
    try { await runExcelExport(allRows, allDocTypes, globalDocTypeCounts, date); }
    finally { setExporting(null); }
  };

  const handlePdf = async () => {
    setExporting("pdf");
    try { await runPdfExport(allRows, allDocTypes, globalDocTypeCounts, date, formattedDate); }
    finally { setExporting(null); }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-auto min-w-[640px] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Daily Report</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 mt-0.5">
                <Calendar size={10} /> {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              disabled={!canExport || !!exporting}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport && !exporting
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              {exporting === "excel"
                ? <Loader2 size={12} className="animate-spin" />
                : <FileSpreadsheet size={12} />}
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button
              onClick={handlePdf}
              disabled={!canExport || !!exporting}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport && !exporting
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              {exporting === "pdf"
                ? <Loader2 size={12} className="animate-spin" />
                : <FileText size={12} />}
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {!loading && allRows.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-6 flex-shrink-0 flex-wrap">
            {[
              { icon: Users,       label: "Agents",      value: allRows.length,         cls: "text-slate-700 dark:text-zinc-200" },
              { icon: TrendingUp,  label: "Volume",      value: totalVolume,            cls: "text-slate-700 dark:text-zinc-200" },
              { icon: BarChart3,   label: "TX Count",    value: totalTx,                cls: "text-slate-700 dark:text-zinc-200" },
              { icon: ChevronDown, label: "Avg Compl.",  value: `${avgCompl.toFixed(1)}%`, cls: "text-green-600 dark:text-green-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <s.icon size={11} className="text-indigo-400 dark:text-indigo-500" />
                <span className={`text-sm font-bold ${s.cls}`}>{s.value}</span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto">

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <Loader2 size={24} className="text-indigo-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400 dark:text-zinc-500">Loading report…</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && allRows.length === 0 && (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <BarChart3 size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-zinc-500">No data for this date.</p>
              </div>
            </div>
          )}

          {/* Main table */}
          {!loading && allRows.length > 0 && (
            <div className="overflow-visible">
              <table className="w-full text-xs border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                    {/* Fixed left cols */}
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 sticky left-0 z-20 min-w-[160px]">
                      Agent
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[80px]">
                      Productivity
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[70px]">
                      Volume
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[60px]">
                      TX
                    </th>

                    {/* One column per task type */}
                    {allDocTypes.map(dt => (
                      <th
                        key={dt}
                        className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[80px]"
                      >
                        <span className="block truncate max-w-[90px] mx-auto" title={dt}>{dt}</span>
                      </th>
                    ))}

                    {/* Rates */}
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[90px]">
                      Compl %
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[90px]">
                      Pending %
                    </th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400 whitespace-nowrap bg-slate-50 dark:bg-zinc-800 min-w-[90px]">
                      Escl %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => {
                    const rows        = grouped[group] ?? [];
                    const groupVol    = rows.reduce((s, r) => s + r.totalVolume, 0);
                    const groupTx     = rows.reduce((s, r) => s + r.txCount, 0);
                    const groupTat    = rows.reduce((s, r) => s + r.productivity, 0);
                    const groupCompl  = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;
                    const groupPend   = rows.length ? rows.reduce((s, r) => s + r.pendingRate, 0)    / rows.length : 0;
                    const groupEscl   = rows.length ? rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length : 0;

                    return (
                      <>
                        {/* Group header row */}
                        <tr key={`group-${group}`} className="bg-indigo-50/60 dark:bg-indigo-950/20 border-y border-indigo-100 dark:border-indigo-900/50">
                          <td
                            className="px-4 py-2 sticky left-0 bg-indigo-50/60 dark:bg-indigo-950/20"
                            colSpan={4 + allDocTypes.length + 3}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{group}</span>
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500">{rows.length} agent{rows.length !== 1 ? "s" : ""}</span>
                              <div className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/50" />
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-mono">{formatHms(groupTat)}</span>
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500">Vol {groupVol}</span>
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500">TX {groupTx}</span>
                              <span className="text-[10px] text-green-500 font-semibold">{groupCompl.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>

                        {/* Agent rows */}
                        {rows.map((row, ri) => (
                          <tr
                            key={row.agentId}
                            className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors ${
                              ri % 2 === 0 ? "" : "bg-slate-50/40 dark:bg-zinc-900/30"
                            }`}
                          >
                            {/* Agent name */}
                            <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-slate-50">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {row.agentName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 leading-tight">{row.agentName}</p>
                                  {row.companies.length > 0 && (
                                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 truncate max-w-[110px]">
                                      {row.companies.slice(0, 2).join(", ")}{row.companies.length > 2 ? ` +${row.companies.length - 2}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Productivity */}
                            <td className="px-3 py-2.5 text-center font-mono text-indigo-500 dark:text-indigo-400 font-semibold tabular-nums text-[11px]">
                              {formatHms(row.productivity)}
                            </td>

                            {/* Volume */}
                            <td className="px-3 py-2.5 text-center text-slate-700 dark:text-zinc-200 font-semibold tabular-nums">
                              {row.totalVolume}
                            </td>

                            {/* TX */}
                            <td className="px-3 py-2.5 text-center text-slate-500 dark:text-zinc-400 tabular-nums">
                              {row.txCount}
                            </td>

                            {/* Per-task-type counts */}
                            {allDocTypes.map(dt => {
                              const count = row.docTypeCounts[dt] ?? 0;
                              return (
                                <td key={dt} className="px-3 py-2.5 text-center tabular-nums">
                                  {count > 0
                                    ? <span className="font-semibold text-indigo-600 dark:text-indigo-400">{count}</span>
                                    : <span className="text-slate-200 dark:text-zinc-700">—</span>
                                  }
                                </td>
                              );
                            })}

                            {/* Rates */}
                            <td className="px-3 py-2.5">
                              <RatePill value={row.completionRate}  color="bg-green-500" />
                            </td>
                            <td className="px-3 py-2.5">
                              <RatePill value={row.pendingRate}     color="bg-amber-400" />
                            </td>
                            <td className="px-3 py-2.5">
                              <RatePill value={row.escalationRate}  color="bg-purple-500" />
                            </td>
                          </tr>
                        ))}

                        {/* Group subtotal */}
                        {rows.length > 1 && (
                          <tr key={`subtotal-${group}`} className="bg-slate-100/60 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-700">
                            <td className="px-4 py-2 sticky left-0 bg-slate-100/60 dark:bg-zinc-800/60">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Subtotal</span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-indigo-500 dark:text-indigo-400 font-bold text-[11px] tabular-nums">
                              {formatHms(groupTat)}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-zinc-200 tabular-nums">
                              {groupVol}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-slate-600 dark:text-zinc-300 tabular-nums">
                              {groupTx}
                            </td>
                            {allDocTypes.map(dt => {
                              const subtotal = rows.reduce((s, r) => s + (r.docTypeCounts[dt] ?? 0), 0);
                              return (
                                <td key={dt} className="px-3 py-2 text-center font-bold text-indigo-500 dark:text-indigo-400 tabular-nums">
                                  {subtotal > 0 ? subtotal : <span className="text-slate-200 dark:text-zinc-700">—</span>}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              <RatePill value={groupCompl} color="bg-green-500" />
                            </td>
                            <td className="px-3 py-2">
                              <RatePill value={groupPend}  color="bg-amber-400" />
                            </td>
                            <td className="px-3 py-2">
                              <RatePill value={groupEscl}  color="bg-purple-500" />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}

                  {/* Grand total row */}
                  {allRows.length > 0 && (
                    <tr className="bg-indigo-600 text-white sticky bottom-0">
                      <td className="px-4 py-2.5 sticky left-0 bg-indigo-600">
                        <span className="text-[11px] font-bold uppercase tracking-widest">Grand Total</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-indigo-200 tabular-nums text-[11px]">
                        {formatHms(allRows.reduce((s, r) => s + r.productivity, 0))}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-white tabular-nums">
                        {totalVolume}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-white tabular-nums">
                        {totalTx}
                      </td>
                      {allDocTypes.map(dt => (
                        <td key={dt} className="px-3 py-2.5 text-center font-bold text-indigo-200 tabular-nums">
                          {globalDocTypeCounts[dt] ?? 0}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-bold text-green-300 tabular-nums">
                        {avgCompl.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-300 tabular-nums">
                        {(allRows.reduce((s, r) => s + r.pendingRate, 0) / (allRows.length || 1)).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-purple-300 tabular-nums">
                        {(allRows.reduce((s, r) => s + r.escalationRate, 0) / (allRows.length || 1)).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && canExport && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
              {allRows.length} agent{allRows.length !== 1 ? "s" : ""} · {allDocTypes.length} task type{allDocTypes.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExcel}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <Download size={11} />
                {exporting === "excel" ? "Exporting…" : "Download Excel"}
              </button>
              <button
                onClick={handlePdf}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <Download size={11} />
                {exporting === "pdf" ? "Exporting…" : "Download PDF"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Public component ───────────────────────────────── */
/**
 * DailyReportModal — drop this anywhere in the productivity page (or any page).
 *
 * Usage:
 *   <DailyReportModal />
 *   <DailyReportModal date="2024-05-21" />
 *   <DailyReportModal date={from} data={{ grouped, groups, globalDocTypeCounts, dailySummary }} />
 *   <DailyReportModal trigger={<button>Custom trigger</button>} />
 */
export function DailyReportModal({ date, data, trigger }: DailyReportModalProps) {
  const [open, setOpen] = useState(false);
  const reportDate = date ?? todayStr();

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-sm"
          >
            <BarChart3 size={13} className="text-indigo-500 dark:text-indigo-400" />
            Daily Report
          </button>
        )}
      </div>

      {/* Portal-style modal */}
      {open && (
        <DailyReportModalContent
          date={reportDate}
          onClose={() => setOpen(false)}
          externalData={data}
        />
      )}
    </>
  );
}

export default DailyReportModal;