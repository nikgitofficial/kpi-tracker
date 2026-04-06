// app/dashboard/productivity/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, TrendingUp, Clock, CheckCircle2, FileText, FileSpreadsheet } from "lucide-react";

interface AgentProductivity {
  agentId:        string;
  agentName:      string;
  group:          string;
  productivity:   number;
  avgTat:         number;
  totalVolume:    number;
  txCount:        number;
  completionRate: number;
  pendingRate:    number;
  escalationRate: number;
}

function formatHms(sec: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today()            { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function RateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-14 text-right tabular-nums text-slate-600">
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

/* ─── Export helpers ─── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportToExcel(
  grouped: Record<string, AgentProductivity[]>,
  groups: string[],
  allRows: AgentProductivity[],
  from: string,
  to: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  for (const group of groups) {
    const rows = grouped[group] ?? [];
    const data = rows.map((r, i) => ({
      "#":               i + 1,
      "Agent":           r.agentName,
      "Productivity":    formatHms(r.productivity),
      "Avg TAT":         r.avgTat ? formatHms(r.avgTat) : "—",
      "Total Volume":    r.totalVolume,
      "TX Count":        r.txCount,
      "Completion %":    +r.completionRate.toFixed(2),
      "Pending %":       +r.pendingRate.toFixed(2),
      "Escalation %":    +r.escalationRate.toFixed(2),
    }));

    if (rows.length > 1) {
      const groupTat    = rows.reduce((s, r) => s + r.productivity, 0);
      const groupVolume = rows.reduce((s, r) => s + r.totalVolume, 0);
      const groupTx     = rows.reduce((s, r) => s + r.txCount, 0);
      const avgCompl    = rows.reduce((s, r) => s + r.completionRate, 0) / rows.length;
      const avgPend     = rows.reduce((s, r) => s + r.pendingRate, 0) / rows.length;
      const avgEsc      = rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length;
      data.push({
        "#":            "—" as any,
        "Agent":        "SUBTOTAL",
        "Productivity": formatHms(groupTat),
        "Avg TAT":      "—",
        "Total Volume": groupVolume,
        "TX Count":     groupTx,
        "Completion %": +avgCompl.toFixed(2),
        "Pending %":    +avgPend.toFixed(2),
        "Escalation %": +avgEsc.toFixed(2),
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, group.slice(0, 31));
  }

  const totalTat    = allRows.reduce((s, r) => s + r.productivity, 0);
  const totalVolume = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTx     = allRows.reduce((s, r) => s + r.txCount, 0);
  const avgCompl    = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;
  const avgPend     = allRows.length ? allRows.reduce((s, r) => s + r.pendingRate, 0) / allRows.length : 0;
  const avgEsc      = allRows.length ? allRows.reduce((s, r) => s + r.escalationRate, 0) / allRows.length : 0;

  const summaryData = [
    ["Date Range",       `${from} to ${to}`],
    ["Total Agents",     allRows.length],
    ["Total Volume",     totalVolume],
    ["Total TX",         totalTx],
    ["Total THT",        formatHms(totalTat)],
    ["Avg Completion %", +avgCompl.toFixed(2)],
    ["Avg Pending %",    +avgPend.toFixed(2)],
    ["Avg Escalation %", +avgEsc.toFixed(2)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2["!cols"] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");

  XLSX.writeFile(wb, `productivity_${from}_to_${to}.xlsx`);
}

async function exportToPdf(
  grouped: Record<string, AgentProductivity[]>,
  groups: string[],
  allRows: AgentProductivity[],
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
  const avgCompl    = allRows.length ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length : 0;

  doc.setFillColor(30, 30, 46);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Productivity Report", 10, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 190);
  doc.text(`${formattedFrom} — ${formattedTo}`, 10, 20);

  const statItems = [
    { label: "AGENTS",         value: String(allRows.length)      },
    { label: "TOTAL VOLUME",   value: String(totalVolume)         },
    { label: "TOTAL THT",      value: formatHms(totalTat)         },
    { label: "AVG COMPLETION", value: `${avgCompl.toFixed(1)}%`   },
  ];
  const bw = 55, bh = 14, startX = 10, statY = 25;
  statItems.forEach((s, i) => {
    const x = startX + i * (bw + 4);
    doc.setFillColor(40, 40, 60); doc.roundedRect(x, statY, bw, bh, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + bw / 2, statY + 7, { align: "center" });
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 160);
    doc.text(s.label, x + bw / 2, statY + 12, { align: "center" });
  });

  let cursorY = 44;

  for (const group of groups) {
    const rows = grouped[group] ?? [];
    const groupTat    = rows.reduce((s, r) => s + r.productivity, 0);
    const groupVolume = rows.reduce((s, r) => s + r.totalVolume, 0);
    const groupCompl  = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;

    if (cursorY > 175) { doc.addPage(); cursorY = 10; }
    doc.setFillColor(40, 40, 65);
    doc.rect(10, cursorY, 277, 7, "F");
    doc.setTextColor(160, 160, 210); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(group.toUpperCase(), 13, cursorY + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 160);
    doc.text(
      `${rows.length} agent${rows.length !== 1 ? "s" : ""}  ·  Vol: ${groupVolume}  ·  THT: ${formatHms(groupTat)}  ·  Avg Completion: ${groupCompl.toFixed(1)}%`,
      180, cursorY + 5, { align: "right" }
    );
    cursorY += 8;

    const body = rows.map((r, i) => [
      i + 1, r.agentName, formatHms(r.productivity),
      r.avgTat ? formatHms(r.avgTat) : "—",
      r.totalVolume,
      `${r.completionRate.toFixed(1)}%`,
      `${r.pendingRate.toFixed(1)}%`,
      `${r.escalationRate.toFixed(1)}%`,
    ]);

    if (rows.length > 1) {
      const avgP = rows.reduce((s, r) => s + r.pendingRate, 0) / rows.length;
      const avgE = rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length;
      body.push(["—", "SUBTOTAL", formatHms(groupTat), "—", groupVolume,
        `${groupCompl.toFixed(1)}%`, `${avgP.toFixed(1)}%`, `${avgE.toFixed(1)}%`]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: cursorY,
      head: [["#", "Agent", "Productivity (THT)", "Avg TAT", "Volume", "Completion %", "Pending %", "Escalation %"]],
      body,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: 44 },
        2: { cellWidth: 32, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 30, halign: "center", textColor: [80, 200, 120] },
        6: { cellWidth: 28, halign: "center", textColor: [220, 170, 60] },
        7: { cellWidth: 30, halign: "center", textColor: [160, 120, 220] },
      },
      didDrawCell: (data: any) => {
        if (data.section === "body" && data.row.index === body.length - 1 && rows.length > 1) {
          doc.setFont("helvetica", "bold");
        }
      },
      margin: { left: 10, right: 10 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allRows.length > 0) {
    if (cursorY > 180) { doc.addPage(); cursorY = 10; }
    const avgPend = allRows.reduce((s, r) => s + r.pendingRate, 0) / allRows.length;
    const avgEsc  = allRows.reduce((s, r) => s + r.escalationRate, 0) / allRows.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: cursorY,
      head: [["", "Agent", "Productivity (THT)", "Avg TAT", "Volume", "Completion %", "Pending %", "Escalation %"]],
      body: [["—", "OVERALL TOTAL", formatHms(totalTat), "—", totalVolume,
        `${avgCompl.toFixed(1)}%`, `${avgPend.toFixed(1)}%`, `${avgEsc.toFixed(1)}%`]],
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [220, 220, 255], fillColor: [30, 30, 55], fontStyle: "bold", lineColor: [80, 80, 130], lineWidth: 0.3 },
      headStyles: { fillColor: [30, 30, 55], textColor: [80, 80, 130], fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: 44 },
        2: { cellWidth: 32, halign: "center", textColor: [120, 160, 255] },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 30, halign: "center", textColor: [80, 200, 120] },
        6: { cellWidth: 28, halign: "center", textColor: [220, 170, 60] },
        7: { cellWidth: 30, halign: "center", textColor: [160, 120, 220] },
      },
      margin: { left: 10, right: 10 },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }

  doc.save(`productivity_${from}_to_${to}.pdf`);
}

/* ─── Main Page ─── */
export default function ProductivityPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to,   setTo]   = useState(today());
  const [grouped,  setGrouped]  = useState<Record<string, AgentProductivity[]>>({});
  const [groups,   setGroups]   = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/kpi/productivity?from=${from}&to=${to}`);
    const d   = await res.json();
    setGrouped(d.grouped ?? {});
    setGroups(d.groups   ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const allRows       = Object.values(grouped).flat();
  const totalVolume   = allRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalTat      = allRows.reduce((s, r) => s + r.productivity, 0);
  const avgCompletion = allRows.length
    ? allRows.reduce((s, r) => s + r.completionRate, 0) / allRows.length
    : 0;

  const formattedFrom = new Date(from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formattedTo   = new Date(to   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const canExport = allRows.length > 0;

  const handleExcelExport = async () => {
    setExporting("excel");
    try { await exportToExcel(grouped, groups, allRows, from, to); }
    finally { setExporting(null); }
  };

  const handlePdfExport = async () => {
    setExporting("pdf");
    try { await exportToPdf(grouped, groups, allRows, from, to, formattedFrom, formattedTo); }
    finally { setExporting(null); }
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 mb-1">KPI</p>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Productivity Report</h1>
            <p className="text-slate-400 text-sm mt-0.5">{formattedFrom} — {formattedTo}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">FROM</span>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <span className="text-xs text-slate-400">TO</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={() => { setFrom(today()); setTo(today()); }}
              className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-100 transition-colors"
            >
              Today
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <button
              onClick={handleExcelExport}
              disabled={!canExport || exporting === "excel"}
              title={canExport ? "Export to Excel" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}
            >
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>

            <button
              onClick={handlePdfExport}
              disabled={!canExport || exporting === "pdf"}
              title={canExport ? "Export to PDF" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}
            >
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users,        label: "Total Agents",     value: allRows.length,                 color: "text-slate-700"  },
            { icon: TrendingUp,   label: "Total Volume",     value: totalVolume,                    color: "text-indigo-600" },
            { icon: Clock,        label: "Total Handle Time",value: formatHms(totalTat),            color: "text-indigo-600" },
            { icon: CheckCircle2, label: "Avg Completion",   value: `${avgCompletion.toFixed(1)}%`, color: "text-green-600"  },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <s.icon size={15} className="text-indigo-500" />
              </div>
              <div>
                <p className={`text-lg font-bold leading-tight ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm">Loading productivity data…</div>
        )}

        {!loading && groups.length === 0 && (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
            <TrendingUp size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No productivity data for the selected date range.</p>
            <p className="text-slate-400 text-xs mt-1">Make sure agents have completed transactions in this period.</p>
          </div>
        )}

        {/* ── Groups ── */}
        {!loading && groups.map(group => {
          const rows         = grouped[group] ?? [];
          const groupVolume  = rows.reduce((s, r) => s + r.totalVolume, 0);
          const groupTat     = rows.reduce((s, r) => s + r.productivity, 0);
          const groupAvgCompl = rows.length ? rows.reduce((s, r) => s + r.completionRate, 0) / rows.length : 0;

          return (
            <div key={group} className="mb-5">
              {/* Group header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{group}</h2>
                </div>
                <div className="flex-1 h-px bg-slate-200" />
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span>{rows.length} agent{rows.length !== 1 ? "s" : ""}</span>
                  <span>Vol: <span className="text-slate-600 font-semibold">{groupVolume}</span></span>
                  <span>Total THT: <span className="text-indigo-500 font-mono font-semibold">{formatHms(groupTat)}</span></span>
                  <span>Avg Completion: <span className="text-green-600 font-semibold">{groupAvgCompl.toFixed(1)}%</span></span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Agent</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-indigo-400">Productivity</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Avg TAT</th>
                      <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Total Volume</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-green-600 min-w-[140px]">Completion Rate</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-amber-500 min-w-[140px]">Pending Rate</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-purple-500 min-w-[140px]">Escalation Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.agentId}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          i === rows.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {row.agentName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-slate-700 font-medium">{row.agentName}</span>
                          </div>
                        </td>
                        <td className="text-center px-4 py-3.5 font-mono text-indigo-500 font-semibold text-xs">
                          {formatHms(row.productivity)}
                        </td>
                        <td className="text-center px-4 py-3.5 font-mono text-slate-500 text-xs">
                          {row.avgTat ? formatHms(row.avgTat) : "—"}
                        </td>
                        <td className="text-center px-4 py-3.5 text-slate-700 font-semibold">
                          {row.totalVolume}
                        </td>
                        <td className="px-4 py-3.5">
                          <RateBar value={row.completionRate} color="bg-green-500" />
                        </td>
                        <td className="px-4 py-3.5">
                          <RateBar value={row.pendingRate} color="bg-amber-400" />
                        </td>
                        <td className="px-4 py-3.5">
                          <RateBar value={row.escalationRate} color="bg-purple-400" />
                        </td>
                      </tr>
                    ))}

                    {rows.length > 1 && (
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="px-5 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal</td>
                        <td className="text-center px-4 py-2.5 font-mono text-indigo-500 font-bold text-xs">{formatHms(groupTat)}</td>
                        <td className="text-center px-4 py-2.5 text-slate-300 text-xs">—</td>
                        <td className="text-center px-4 py-2.5 text-slate-700 font-bold">{groupVolume}</td>
                        <td className="px-4 py-2.5">
                          <RateBar value={groupAvgCompl} color="bg-green-500" />
                        </td>
                        <td className="px-4 py-2.5">
                          <RateBar value={rows.length ? rows.reduce((s, r) => s + r.pendingRate, 0) / rows.length : 0} color="bg-amber-400" />
                        </td>
                        <td className="px-4 py-2.5">
                          <RateBar value={rows.length ? rows.reduce((s, r) => s + r.escalationRate, 0) / rows.length : 0} color="bg-purple-400" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* ── Overall totals ── */}
        {!loading && allRows.length > 0 && (
          <div className="mt-2 bg-white border border-indigo-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-5 py-3.5 font-bold text-slate-700 uppercase tracking-wider text-xs">Overall Total</td>
                  <td className="text-center px-4 py-3.5 font-mono text-indigo-500 font-bold text-xs">{formatHms(totalTat)}</td>
                  <td className="text-center px-4 py-3.5 text-slate-300 text-xs">—</td>
                  <td className="text-center px-4 py-3.5 text-slate-900 font-bold">{totalVolume}</td>
                  <td className="px-4 py-3.5 min-w-[140px]">
                    <RateBar value={avgCompletion} color="bg-green-500" />
                  </td>
                  <td className="px-4 py-3.5 min-w-[140px]">
                    <RateBar value={allRows.length ? allRows.reduce((s, r) => s + r.pendingRate, 0) / allRows.length : 0} color="bg-amber-400" />
                  </td>
                  <td className="px-4 py-3.5 min-w-[140px]">
                    <RateBar value={allRows.length ? allRows.reduce((s, r) => s + r.escalationRate, 0) / allRows.length : 0} color="bg-purple-400" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}