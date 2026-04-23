"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import {
  ChevronDown, ChevronRight, FileText, FileSpreadsheet,
  Layers, Ungroup, Clock, CheckCircle2, AlertTriangle,
  PauseCircle, ListPlus, Timer,
} from "lucide-react";

/* ─── Types (aligned with TX page model) ─── */
type TxStatus = "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
type TaskCategory = "Production" | "Non-Production";
type CountType = "transaction" | "volume";

interface Subtask {
  _id: string;
  docType: string;
  number?: number;
  notes?: string;
  status: TxStatus;
  taskCategory: TaskCategory;
  countType?: CountType;
  createdAt: number;
}

interface Transaction {
  _id: string;
  txId: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  endTime?: string;
  tat?: number;
  status: TxStatus;
  notes?: string;
  agentName: string;
  agentId: string;
  date: string;
  taskCategory?: TaskCategory;
  countType?: CountType;
  subtasks?: Subtask[];
  productiveSeconds?: number;
}

interface AgentRow {
  agentId: string;
  agentName: string;
  group: string;
  totalTat: number;
  completion: number;
  pending: number;
  escalation: number;
  hold: number;
  total: number;
  aht: number;
  productiveSeconds: number;
  transactions: Transaction[];
  /* Per-category doc type counts (includes subtasks) */
  prodDocTypeCounts: Record<string, { count: number; countType: CountType }>;
  nonProdDocTypeCounts: Record<string, { count: number; countType: CountType }>;
}

interface Agent {
  _id: string;
  name: string;
  group?: string;
}

/* ─── Helpers ─── */
function formatTat(sec?: number) {
  if (sec == null || sec < 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today() { return new Date().toISOString().split("T")[0]; }

const STATUS_CONFIG: Record<TxStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING:    { label: "Pending",    color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   icon: Clock },
  COMPLETION: { label: "Completion", color: "text-green-600",  bg: "bg-green-50 border-green-200",   icon: CheckCircle2 },
  ESCALATION: { label: "Escalation", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: AlertTriangle },
  HOLD:       { label: "Hold",       color: "text-sky-600",    bg: "bg-sky-50 border-sky-200",       icon: PauseCircle },
};

function StatusBadge({ status }: { status: TxStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category?: TaskCategory }) {
  const isProd = !category || category === "Production";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${
      isProd
        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
        : "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-slate-500 dark:text-zinc-400"
    }`}>
      {isProd ? "⚙" : "✉"} {isProd ? "Prod" : "Non-Prod"}
    </span>
  );
}

function CountTypeBadge({ countType }: { countType?: CountType }) {
  const isVol = countType === "volume";
  return (
    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold ${
      isVol
        ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
        : "bg-indigo-50 border border-indigo-200 text-indigo-500"
    }`}>
      {isVol ? "VOL" : "TX"}
    </span>
  );
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
  grouped: Record<string, AgentRow[]>,
  groups: string[],
  totals: ReturnType<typeof calcTotals>,
  date: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  // Summary rows
  const summaryRows: object[] = [];
  for (const group of groups) {
    const rows = grouped[group] ?? [];
    rows.forEach((r, i) => {
      summaryRows.push({
        "#": i + 1, "Group": group, "Agent": r.agentName,
        "Productive Hours": formatTat(r.productiveSeconds),
        "Total Handle Time": formatTat(r.totalTat),
        "Completion": r.completion, "Pending": r.pending,
        "Escalation": r.escalation, "Hold": r.hold,
        "Total TX": r.total, "AHT per TX": formatTat(r.aht),
        "Production TX": Object.values(r.prodDocTypeCounts).reduce((a, v) => a + v.count, 0),
        "Non-Prod TX": Object.values(r.nonProdDocTypeCounts).reduce((a, v) => a + v.count, 0),
      });
    });
  }
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Overall doc type breakdown
  const dtRows: object[] = [];
  for (const [dt, { count, countType }] of Object.entries(totals.globalProdDT)) {
    dtRows.push({ "Task Type": dt, "Category": "Production", "Count Type": countType, "Total": count });
  }
  for (const [dt, { count, countType }] of Object.entries(totals.globalNonProdDT)) {
    dtRows.push({ "Task Type": dt, "Category": "Non-Production", "Count Type": countType, "Total": count });
  }
  const wsDT = XLSX.utils.json_to_sheet(dtRows);
  XLSX.utils.book_append_sheet(wb, wsDT, "Task Type Summary");

  // Per-agent sheets
  for (const group of groups) {
    for (const row of grouped[group] ?? []) {
      const txRows: object[] = [];
      row.transactions.forEach((tx, i) => {
        txRows.push({
          "#": i + 1, "TX ID": tx.txId, "Type of Task": tx.docType,
          "Company": tx.companyName, "Volume": tx.volume,
          "Category": tx.taskCategory ?? "Production",
          "Count Type": tx.countType ?? "transaction",
          "Start": tx.startTime, "End": tx.endTime ?? "—",
          "TAT": formatTat(tx.tat), "Status": tx.status, "Notes": tx.notes ?? "",
          "Subtasks": (tx.subtasks ?? []).length,
        });
        (tx.subtasks ?? []).forEach((st, si) => {
          txRows.push({
            "#": `↳ ${i + 1}.${si + 1}`, "TX ID": "", "Type of Task": st.docType,
            "Company": "", "Volume": st.number ?? "",
            "Category": st.taskCategory ?? "Production",
            "Count Type": st.countType ?? "transaction",
            "Start": "", "End": "", "TAT": "",
            "Status": st.status, "Notes": st.notes ?? "", "Subtasks": "",
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(txRows);
      XLSX.utils.book_append_sheet(wb, ws, row.agentName.slice(0, 31));
    }
  }

  XLSX.writeFile(wb, `eod-report_${date}.xlsx`);
}

async function exportToPdf(
  grouped: Record<string, AgentRow[]>,
  groups: string[],
  totals: ReturnType<typeof calcTotals>,
  date: string,
  formattedDate: string,
  activeAgents: number,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(20, 20, 36);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Agent Daily Production", 10, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 180);
  doc.text(formattedDate, 10, 20);

  const statItems = [
    { label: "TOTAL TX",      value: String(totals.total) },
    { label: "COMPLETION",    value: String(totals.completion) },
    { label: "PENDING",       value: String(totals.pending) },
    { label: "ESCALATION",    value: String(totals.escalation) },
    { label: "HOLD",          value: String(totals.hold) },
    { label: "ACTIVE AGENTS", value: String(activeAgents) },
    { label: "PROD HRS",      value: formatTat(totals.productiveSeconds) },
  ];
  const statColors: [number, number, number][] = [
    [180, 180, 220], [80, 200, 120], [220, 170, 60],
    [160, 120, 220], [100, 180, 255], [120, 160, 255], [80, 200, 160],
  ];
  statItems.forEach((s, i) => {
    const x = 10 + i * (40 + 2);
    doc.setFillColor(35, 35, 58); doc.roundedRect(x, 25, 40, 14, 2, 2, "F");
    doc.setTextColor(...statColors[i]); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 20, 32, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 150);
    doc.text(s.label, x + 20, 37, { align: "center" });
  });

  let cursorY = 44;

  for (const group of groups) {
    const rows = grouped[group] ?? [];
    const gTat = rows.reduce((a, r) => a + r.totalTat, 0);
    const gTotal = rows.reduce((a, r) => a + r.total, 0);

    if (cursorY > 165) { doc.addPage(); cursorY = 10; }

    doc.setFillColor(40, 40, 65);
    doc.rect(10, cursorY, 277, 7, "F");
    doc.setTextColor(160, 160, 210); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(group.toUpperCase(), 13, cursorY + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 160);
    doc.text(`${rows.length} agent${rows.length !== 1 ? "s" : ""}  ·  THT: ${formatTat(gTat)}  ·  Total TX: ${gTotal}`, 287, cursorY + 5, { align: "right" });
    cursorY += 8;

    const body = rows.map((r, i) => [
      i + 1, r.agentName, formatTat(r.productiveSeconds), formatTat(r.totalTat),
      r.completion, r.pending, r.escalation, r.hold, r.total, formatTat(r.aht),
    ]);
    if (rows.length > 1) {
      const gComp = rows.reduce((a, r) => a + r.completion, 0);
      const gPend = rows.reduce((a, r) => a + r.pending, 0);
      const gEsc  = rows.reduce((a, r) => a + r.escalation, 0);
      const gHold = rows.reduce((a, r) => a + r.hold, 0);
      const gProd = rows.reduce((a, r) => a + r.productiveSeconds, 0);
      body.push(["—", "SUBTOTAL", formatTat(gProd), formatTat(gTat), gComp, gPend, gEsc, gHold, gTotal,
        formatTat(gTotal ? Math.round(gTat / gTotal) : 0)]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: cursorY,
      head: [["#", "Agent", "Prod Hrs", "Total Handle Time", "Completion", "Pending", "Escalation", "Hold", "Total TX", "AHT"]],
      body,
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 42 },
        2: { cellWidth: 22, halign: "center", textColor: [80, 200, 160], fontStyle: "bold" },
        3: { cellWidth: 30, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
        4: { cellWidth: 20, halign: "center", textColor: [80, 200, 120] },
        5: { cellWidth: 16, halign: "center", textColor: [220, 170, 60] },
        6: { cellWidth: 20, halign: "center", textColor: [160, 120, 220] },
        7: { cellWidth: 14, halign: "center", textColor: [100, 180, 255] },
        8: { cellWidth: 16, halign: "center" },
        9: { cellWidth: 28, halign: "center", textColor: [120, 160, 255] },
      },
      margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Task Type summary page
  const allProdDT  = Object.entries(totals.globalProdDT);
  const allNonProd = Object.entries(totals.globalNonProdDT);
  if (allProdDT.length + allNonProd.length > 0) {
    doc.addPage();
    doc.setFillColor(20, 20, 36); doc.rect(0, 0, 297, 14, "F");
    doc.setTextColor(160, 160, 210); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Task Type Breakdown", 10, 10);

    const dtBody = [
      ...allProdDT.map(([dt, { count, countType }]) => [dt, "Production", countType.toUpperCase(), count]),
      ...allNonProd.map(([dt, { count, countType }]) => [dt, "Non-Production", countType.toUpperCase(), count]),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 18,
      head: [["Task Type", "Category", "Count Type", "Total"]],
      body: dtBody,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 70 }, 1: { cellWidth: 36, halign: "center" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 20, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      },
      margin: { left: 10, right: 10 },
    });
  }

  // Per-agent detail pages
  for (const group of groups) {
    for (const row of grouped[group] ?? []) {
      if (row.transactions.length === 0) continue;
      doc.addPage();
      doc.setFillColor(30, 30, 52); doc.rect(0, 0, 297, 16, "F");
      doc.setTextColor(180, 180, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(row.agentName, 10, 10);
      doc.setTextColor(110, 110, 180); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      doc.text(group, 10, 15);
      doc.setFontSize(7.5); doc.setTextColor(110, 110, 160);
      doc.text(
        `Prod Hrs: ${formatTat(row.productiveSeconds)}  ·  THT: ${formatTat(row.totalTat)}  ·  Completion: ${row.completion}  ·  Pending: ${row.pending}  ·  Hold: ${row.hold}  ·  Total: ${row.total}`,
        287, 13, { align: "right" }
      );

      const txBody: unknown[] = [];
      row.transactions.forEach((tx, i) => {
        txBody.push([i + 1, tx.txId, tx.docType, tx.companyName, tx.volume,
          tx.taskCategory ?? "Production", tx.startTime, tx.endTime ?? "—", formatTat(tx.tat), tx.status, tx.notes ?? "—"]);
        (tx.subtasks ?? []).forEach((st, si) => {
          txBody.push([`↳${i + 1}.${si + 1}`, "", st.docType, "", st.number ?? "—",
            st.taskCategory ?? "Production", "", "", "", st.status, st.notes ?? "—"]);
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).autoTable({
        startY: 20,
        head: [["#", "TX ID", "Type of Task", "Company", "Vol", "Category", "Start", "End", "TAT", "Status", "Notes"]],
        body: txBody,
        styles: { fontSize: 7, cellPadding: 2, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
        headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [28, 28, 48] },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 22 },
          2: { cellWidth: 30 }, 3: { cellWidth: 40 },
          4: { cellWidth: 10, halign: "center" }, 5: { cellWidth: 26, halign: "center" },
          6: { cellWidth: 16, halign: "center" }, 7: { cellWidth: 16, halign: "center" },
          8: { cellWidth: 20, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
          9: { cellWidth: 22, halign: "center" },
          10: { cellWidth: "auto" },
        },
        margin: { left: 10, right: 10 },
      });
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }

  doc.save(`eod-report_${date}.pdf`);
}

/* ─── Totals helper (centralised so PDF + UI use same logic) ─── */
function calcTotals(allRows: AgentRow[]) {
  const globalProdDT:    Record<string, { count: number; countType: CountType }> = {};
  const globalNonProdDT: Record<string, { count: number; countType: CountType }> = {};

  for (const r of allRows) {
    for (const [dt, v] of Object.entries(r.prodDocTypeCounts)) {
      globalProdDT[dt] = { count: (globalProdDT[dt]?.count ?? 0) + v.count, countType: v.countType };
    }
    for (const [dt, v] of Object.entries(r.nonProdDocTypeCounts)) {
      globalNonProdDT[dt] = { count: (globalNonProdDT[dt]?.count ?? 0) + v.count, countType: v.countType };
    }
  }

  return {
    totalTat: allRows.reduce((a, r) => a + r.totalTat, 0),
    completion: allRows.reduce((a, r) => a + r.completion, 0),
    pending:    allRows.reduce((a, r) => a + r.pending, 0),
    escalation: allRows.reduce((a, r) => a + r.escalation, 0),
    hold:       allRows.reduce((a, r) => a + r.hold, 0),
    total:      allRows.reduce((a, r) => a + r.total, 0),
    productiveSeconds: allRows.reduce((a, r) => a + r.productiveSeconds, 0),
    globalProdDT,
    globalNonProdDT,
  };
}

/* ─── Doc Type Breakdown (expandable per agent) ─── */
function DocTypeBreakdown({ prodCounts, nonProdCounts }: {
  prodCounts:    Record<string, { count: number; countType: CountType }>;
  nonProdCounts: Record<string, { count: number; countType: CountType }>;
}) {
  const prodEntries    = Object.entries(prodCounts).filter(([, v]) => v.count > 0);
  const nonProdEntries = Object.entries(nonProdCounts).filter(([, v]) => v.count > 0);
  if (prodEntries.length === 0 && nonProdEntries.length === 0) return null;

  const maxCount = Math.max(...[...prodEntries, ...nonProdEntries].map(([, v]) => v.count), 1);

  const renderSection = (
    entries: [string, { count: number; countType: CountType }][],
    label: string,
    isProd: boolean,
  ) => {
    if (entries.length === 0) return null;
    return (
      <div className="min-w-[200px]">
        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 ${
          isProd ? "text-indigo-400" : "text-slate-400 dark:text-zinc-500"
        }`}>
          <span>{isProd ? "⚙" : "✉"}</span>{label}
        </p>
        <div className="space-y-1">
          {entries.map(([dt, { count, countType }]) => (
            <div key={dt} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-28 truncate">{dt}</span>
              <CountTypeBadge countType={countType} />
              <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden w-16">
                <div className={`h-full rounded-full ${isProd ? "bg-indigo-400" : "bg-slate-400 dark:bg-zinc-500"}`}
                  style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className={`text-[11px] font-bold tabular-nums w-5 text-right ${
                isProd ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400"
              }`}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
      <td colSpan={10} className="px-6 py-3 pl-16">
        <div className="flex flex-wrap gap-6">
          {renderSection(prodEntries, "Production", true)}
          {renderSection(nonProdEntries, "Non-Production", false)}
        </div>
      </td>
    </tr>
  );
}

/* ─── Subtask detail sub-table ─── */
function SubtaskDetail({ subtasks }: { subtasks: Subtask[] }) {
  if (subtasks.length === 0) return null;
  return (
    <div className="mt-2 border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex items-center gap-1.5">
        <ListPlus size={10} className="text-indigo-400" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          {subtasks.length} Subtask{subtasks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <table className="w-full">
        <tbody>
          {subtasks.map((st, i) => (
            <tr key={st._id} className={`${i < subtasks.length - 1 ? "border-b border-slate-100 dark:border-zinc-800" : ""}`}>
              <td className="px-3 py-1.5 text-slate-300 dark:text-zinc-600 text-[10px] w-6">↳{i + 1}</td>
              <td className="px-2 py-1.5 text-slate-500 dark:text-zinc-400 text-[11px]">{st.docType}</td>
              <td className="px-2 py-1.5"><CategoryBadge category={st.taskCategory} /></td>
              <td className="px-2 py-1.5 text-slate-400 dark:text-zinc-500 text-[10px] font-mono">{st.number ?? "—"}</td>
              <td className="px-2 py-1.5"><StatusBadge status={st.status} /></td>
              <td className="px-2 py-1.5 text-slate-400 dark:text-zinc-500 text-[10px] max-w-[120px] truncate">{st.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Component ─── */
export function EodReportClient() {
  const [date, setDate] = useState(today());
  const [grouped, setGrouped] = useState<Record<string, AgentRow[]>>({});
  const [groups, setGroups] = useState<string[]>([]);

  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());
  const [expandedDt, setExpandedDt] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showDocSummary, setShowDocSummary] = useState(true);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(async () => {
  setLoading(true);

  // Fetch all three data sources in parallel
  const [txRes, agentRes, timerRes] = await Promise.all([
    fetch(`/api/kpi/transactions?date=${date}`),
    fetch("/api/kpi/agents"),
    fetch(`/api/kpi/productivity-timers?date=${date}`), // New endpoint for all timers
  ]);
  
  const txData    = await txRes.json();
  const agentData = await agentRes.json();
  const timerData = await timerRes.json();

  // Filter out any __PROD_TIMER__ transactions (they shouldn't exist anymore, but safe to keep)
  const txs: Transaction[] = (txData.transactions ?? []).filter((t: Transaction) => t.docType !== "__PROD_TIMER__");
  const agents: Agent[]    = agentData.agents ?? [];
  
  // Timer data from ProductivityTimer collection
  const timers: Array<{ agentId: string; productiveSeconds: number; timerStartEpoch?: number | null; timerPaused?: boolean }> = timerData.timers ?? [];

  const groupMap = new Map<string, string>();
  for (const a of agents) groupMap.set(a._id, a.group ?? "Ungrouped");

  // Build per-agent timer productiveSeconds from ProductivityTimer collection
  // Account for live running timers (active timers that haven't been paused/ended)
  const now = Date.now();
  const timerMap = new Map<string, number>();
  for (const t of timers) {
    let secs = t.productiveSeconds ?? 0;
    // If timer is actively running (not paused and has a start epoch), add live elapsed time
    if (t.timerStartEpoch && !t.timerPaused) {
      const liveElapsed = Math.floor((now - t.timerStartEpoch) / 1000);
      secs += liveElapsed;
    }
    timerMap.set(t.agentId, (timerMap.get(t.agentId) ?? 0) + secs);
  }

  const agentRowMap = new Map<string, AgentRow>();

  for (const tx of txs) {
    if (!agentRowMap.has(tx.agentId)) {
      agentRowMap.set(tx.agentId, {
        agentId: tx.agentId,
        agentName: tx.agentName,
        group: groupMap.get(tx.agentId) ?? "Ungrouped",
        totalTat: 0,
        completion: 0, pending: 0, escalation: 0, hold: 0,
        total: 0, aht: 0, productiveSeconds: timerMap.get(tx.agentId) ?? 0,
        transactions: [],
        prodDocTypeCounts: {},
        nonProdDocTypeCounts: {},
      });
    }
    const row = agentRowMap.get(tx.agentId)!;
    row.total++;
    row.transactions.push(tx);
    if (tx.tat) row.totalTat += tx.tat;
    if (tx.status === "COMPLETION") row.completion++;
    if (tx.status === "PENDING")    row.pending++;
    if (tx.status === "ESCALATION") row.escalation++;
    if (tx.status === "HOLD")       row.hold++;

    // Tally main tx
    const cat = tx.taskCategory ?? "Production";
    const ct  = (tx.countType ?? "transaction") as CountType;
    const add = ct === "volume" ? (tx.volume ?? 1) : 1;
    const bucket = cat === "Production" ? row.prodDocTypeCounts : row.nonProdDocTypeCounts;
    bucket[tx.docType] = { count: (bucket[tx.docType]?.count ?? 0) + add, countType: ct };

    // Tally subtasks
    for (const st of tx.subtasks ?? []) {
      const stCat = st.taskCategory ?? cat;
      const stCt  = (st.countType ?? "transaction") as CountType;
      const stAdd = stCt === "volume" ? (st.number ?? 1) : 1;
      const stBucket = stCat === "Production" ? row.prodDocTypeCounts : row.nonProdDocTypeCounts;
      stBucket[st.docType] = { count: (stBucket[st.docType]?.count ?? 0) + stAdd, countType: stCt };
    }
  }

  // Agents with no transactions but with a timer record
  for (const [agentId, prodSec] of timerMap) {
    if (!agentRowMap.has(agentId)) {
      const agent = agents.find(a => a._id === agentId);
      if (agent) {
        agentRowMap.set(agentId, {
          agentId, agentName: agent.name,
          group: groupMap.get(agentId) ?? "Ungrouped",
          totalTat: 0, completion: 0, pending: 0, escalation: 0, hold: 0,
          total: 0, aht: 0, productiveSeconds: prodSec,
          transactions: [], prodDocTypeCounts: {}, nonProdDocTypeCounts: {},
        });
      }
    }
  }

  const rows = Array.from(agentRowMap.values()).map(r => ({
    ...r,
    aht: r.total ? Math.round(r.totalTat / r.total) : 0,
  }));

  const groupedResult: Record<string, AgentRow[]> = {};
  for (const row of rows) {
    const g = row.group;
    if (!groupedResult[g]) groupedResult[g] = [];
    groupedResult[g].push(row);
  }

  const seenGroups = new Set<string>();
  const orderedGroups: string[] = [];
  for (const a of agents) {
    const g = a.group ?? "Ungrouped";
    if (!seenGroups.has(g) && groupedResult[g]) {
      seenGroups.add(g); orderedGroups.push(g);
    }
  }
  for (const g of Object.keys(groupedResult)) {
    if (!seenGroups.has(g)) orderedGroups.push(g);
  }
  orderedGroups.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  setGrouped(groupedResult);
  setGroups(orderedGroups);
  setLoading(false);
}, [date]);

  useEffect(() => { load(); }, [load]);

  const toggleTx    = (id: string) => setExpandedTx(p  => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDt    = (id: string) => setExpandedDt(p  => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroup = (g:  string) => setCollapsedGroups(p => { const n = new Set(p); n.has(g)  ? n.delete(g)  : n.add(g);  return n; });

  const allRows    = Object.values(grouped).flat();
  const flatRows   = [...allRows].sort((a, b) => a.agentName.localeCompare(b.agentName));
  const totals     = calcTotals(allRows);
  const overallAht = totals.total ? Math.round(totals.totalTat / totals.total) : 0;
  const activeAgents = allRows.filter(r => r.total > 0 || r.productiveSeconds > 0).length;
  const canExport    = allRows.length > 0;

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const handleExcelExport = async () => {
    setExporting("excel");
    try { await exportToExcel(grouped, groups, totals, date); } finally { setExporting(null); }
  };
  const handlePdfExport = async () => {
    setExporting("pdf");
    try { await exportToPdf(grouped, groups, totals, date, formattedDate, activeAgents); } finally { setExporting(null); }
  };

  /* ── Agent rows renderer ── */
  const renderAgentRows = (rows: AgentRow[]) =>
    rows.map((row, i) => {
      const txOpen = expandedTx.has(row.agentId);
      const dtOpen = expandedDt.has(row.agentId);
      const hasDt  = Object.keys(row.prodDocTypeCounts).length + Object.keys(row.nonProdDocTypeCounts).length > 0;
      const isLast = i === rows.length - 1;

      return (
        <React.Fragment key={row.agentId}>
          <tr
            className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
              isLast && !txOpen && !dtOpen ? "border-b-0" : ""
            }`}
            onClick={() => toggleTx(row.agentId)}
          >
            {/* Agent */}
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                {txOpen
                  ? <ChevronDown  size={13} className="text-slate-400 dark:text-zinc-500" />
                  : <ChevronRight size={13} className="text-slate-400 dark:text-zinc-500" />}
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {row.agentName.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-slate-700 dark:text-zinc-200 font-medium text-sm">{row.agentName}</span>
              </div>
            </td>
            {/* Productive Hours */}
            <td className="text-center px-4 py-3.5">
              <span className="inline-flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <Timer size={10} />{formatTat(row.productiveSeconds)}
              </span>
            </td>
            {/* THT */}
            <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 font-semibold text-xs">{formatTat(row.totalTat)}</td>
            {/* Statuses */}
            <td className="text-center px-4 py-3.5 text-green-600 dark:text-green-400 font-semibold">{row.completion}</td>
            <td className="text-center px-4 py-3.5 text-amber-500 dark:text-amber-400 font-semibold">{row.pending || 0}</td>
            <td className="text-center px-4 py-3.5 text-purple-500 dark:text-purple-400 font-semibold">{row.escalation || 0}</td>
            <td className="text-center px-4 py-3.5 text-sky-500 dark:text-sky-400 font-semibold">{row.hold || 0}</td>
            <td className="text-center px-4 py-3.5 text-slate-700 dark:text-zinc-200 font-semibold">{row.total}</td>
            <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs font-semibold">{formatTat(row.aht)}</td>
            {/* Doc-type toggle */}
            <td className="pr-3 py-3.5 text-right">
              {hasDt && (
                <button
                  onClick={e => { e.stopPropagation(); toggleDt(row.agentId); }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all ${
                    dtOpen
                      ? "bg-indigo-100 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                      : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-indigo-200 dark:hover:border-indigo-700 hover:text-indigo-500"
                  }`}
                >
                  Tasks {dtOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
            </td>
          </tr>

          {/* Doc type breakdown */}
          {dtOpen && hasDt && (
            <DocTypeBreakdown prodCounts={row.prodDocTypeCounts} nonProdCounts={row.nonProdDocTypeCounts} />
          )}

          {/* TX detail */}
          {txOpen && (
            <tr>
              <td colSpan={10} className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 px-6 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
                  {row.agentName} — {row.transactions.length} Transaction{row.transactions.length !== 1 ? "s" : ""}
                </p>
                {row.transactions.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">No transactions logged — only productivity timer data available.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 dark:text-zinc-500">
                        {["#", "TX ID", "Type of Task", "Company", "Vol", "Category", "Start", "End", "TAT", "Status", "Notes"].map(h => (
                          <th key={h} className="text-left py-1.5 pr-3 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {row.transactions.map((tx, j) => (
                        <React.Fragment key={tx._id}>
                          <tr className="border-t border-slate-100 dark:border-zinc-800">
                            <td className="py-2 pr-3 text-slate-400 dark:text-zinc-500">{j + 1}</td>
                            <td className="py-2 pr-3 font-mono text-slate-600 dark:text-zinc-300 font-semibold">{tx.txId}</td>
                            <td className="py-2 pr-3 text-slate-600 dark:text-zinc-300 font-medium">{tx.docType}</td>
                            <td className="py-2 pr-3 text-slate-500 dark:text-zinc-400 max-w-[120px] truncate">{tx.companyName}</td>
                            <td className="py-2 pr-3 text-slate-500 dark:text-zinc-400 font-mono">{tx.volume}</td>
                            <td className="py-2 pr-3"><CategoryBadge category={tx.taskCategory} /></td>
                            <td className="py-2 pr-3 font-mono text-slate-500 dark:text-zinc-400">{tx.startTime}</td>
                            <td className="py-2 pr-3 font-mono text-slate-500 dark:text-zinc-400">{tx.endTime ?? "—"}</td>
                            <td className="py-2 pr-3 font-mono text-indigo-500 dark:text-indigo-400 font-semibold">{formatTat(tx.tat)}</td>
                            <td className="py-2 pr-3"><StatusBadge status={tx.status} /></td>
                            <td className="py-2 text-slate-400 dark:text-zinc-500 max-w-[140px] truncate">{tx.notes || "—"}</td>
                          </tr>
                          {(tx.subtasks ?? []).length > 0 && (
                            <tr className="border-t border-slate-100/50 dark:border-zinc-800/50">
                              <td colSpan={11} className="pb-2 pl-8 pr-3">
                                <SubtaskDetail subtasks={tx.subtasks ?? []} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });

  /* ── Table shell ── */
  const renderTable = (rows: AgentRow[], showSubtotal: boolean) => {
    const gTat   = rows.reduce((a, r) => a + r.totalTat, 0);
    const gTotal = rows.reduce((a, r) => a + r.total, 0);
    const gComp  = rows.reduce((a, r) => a + r.completion, 0);
    const gPend  = rows.reduce((a, r) => a + r.pending, 0);
    const gEsc   = rows.reduce((a, r) => a + r.escalation, 0);
    const gHold  = rows.reduce((a, r) => a + r.hold, 0);
    const gProd  = rows.reduce((a, r) => a + r.productiveSeconds, 0);
    const gAht   = gTotal ? Math.round(gTat / gTotal) : 0;

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700">
              {[
                { label: "Agent",              cls: "text-left px-5 py-3 text-slate-400 dark:text-zinc-500" },
                { label: "Prod Hours",         cls: "text-center px-4 py-3 text-emerald-500 dark:text-emerald-400" },
                { label: "Total Handle Time",  cls: "text-center px-4 py-3 text-indigo-400" },
                { label: "# Completion",       cls: "text-center px-4 py-3 text-green-600 dark:text-green-500" },
                { label: "# Pending",          cls: "text-center px-4 py-3 text-amber-500" },
                { label: "# Escalation",       cls: "text-center px-4 py-3 text-purple-500" },
                { label: "# Hold",             cls: "text-center px-4 py-3 text-sky-500" },
                { label: "Total TX",           cls: "text-center px-4 py-3 text-slate-400 dark:text-zinc-500" },
                { label: "AHT per TX",         cls: "text-center px-4 py-3 text-indigo-400" },
                { label: "Tasks",              cls: "w-20 px-3 py-3 text-right text-slate-300 dark:text-zinc-600" },
              ].map(h => (
                <th key={h.label} className={`${h.cls} text-[11px] font-semibold uppercase tracking-widest`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderAgentRows(rows)}
            {showSubtotal && rows.length > 1 && (
              <tr className="bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-700">
                <td className="px-5 py-2.5 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider pl-14">Subtotal</td>
                <td className="text-center px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">{formatTat(gProd)}</td>
                <td className="text-center px-4 py-2.5 font-mono text-indigo-500 dark:text-indigo-400 font-bold text-xs">{formatTat(gTat)}</td>
                <td className="text-center px-4 py-2.5 text-green-600 dark:text-green-400 font-bold">{gComp}</td>
                <td className="text-center px-4 py-2.5 text-amber-500 dark:text-amber-400 font-bold">{gPend}</td>
                <td className="text-center px-4 py-2.5 text-purple-500 dark:text-purple-400 font-bold">{gEsc}</td>
                <td className="text-center px-4 py-2.5 text-sky-500 dark:text-sky-400 font-bold">{gHold}</td>
                <td className="text-center px-4 py-2.5 text-slate-700 dark:text-zinc-200 font-bold">{gTotal}</td>
                <td className="text-center px-4 py-2.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs font-bold">{formatTat(gAht)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const allProdDT    = Object.entries(totals.globalProdDT);
  const allNonProdDT = Object.entries(totals.globalNonProdDT);

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KPI</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Agent Daily Production</h1>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">{formattedDate}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
            <button onClick={() => setDate(today())}
              className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition-colors">
              Today
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button onClick={() => setIsGrouped(g => !g)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                isGrouped
                  ? "bg-slate-700 dark:bg-slate-600 border-slate-700 text-white hover:bg-slate-800"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100"
              }`}>
              {isGrouped ? <Layers size={13} /> : <Ungroup size={13} />}
              {isGrouped ? "Grouped" : "Ungrouped"}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button onClick={handleExcelExport} disabled={!canExport || exporting === "excel"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
              }`}>
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button onClick={handlePdfExport} disabled={!canExport || exporting === "pdf"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
              }`}>
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
          {[
            { label: "Total TX",      value: totals.total,                          color: "text-slate-700 dark:text-zinc-200",   bg: "bg-white dark:bg-zinc-900"                       },
            { label: "Completion",    value: totals.completion,                     color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30"                },
            { label: "Pending",       value: totals.pending,                        color: "text-amber-500 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/30"                },
            { label: "Escalation",    value: totals.escalation,                     color: "text-purple-500 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-950/30"              },
            { label: "Hold",          value: totals.hold,                           color: "text-sky-500 dark:text-sky-400",      bg: "bg-sky-50 dark:bg-sky-950/30"                    },
            { label: "Active Agents", value: activeAgents,                          color: "text-indigo-600 dark:text-indigo-400",bg: "bg-indigo-50 dark:bg-indigo-950/30"              },
            { label: "Overall AHT",   value: formatTat(overallAht),                 color: "text-indigo-600 dark:text-indigo-400",bg: "bg-white dark:bg-zinc-900"                       },
            { label: "Prod Hours",    value: formatTat(totals.productiveSeconds),   color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-950/30"          },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-200 dark:border-zinc-700 rounded-2xl px-3 py-3 text-center`}>
              <p className={`text-base font-bold leading-tight ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

      {loading && <PageSkeleton />}

        {!loading && groups.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <p className="text-slate-500 dark:text-zinc-400 text-sm">No data for this date.</p>
          </div>
        )}

        {/* ── Task Summary Panel ── */}
        {!loading && (allProdDT.length + allNonProdDT.length) > 0 && (
          <div className="mb-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <button onClick={() => setShowDocSummary(s => !s)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Tasks Summary</span>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  {allProdDT.length + allNonProdDT.length} type{allProdDT.length + allNonProdDT.length !== 1 ? "s" : ""}
                  {" · "}
                  {[...allProdDT, ...allNonProdDT].reduce((a, [, v]) => a + v.count, 0)} total
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 dark:text-zinc-500 transition-transform ${showDocSummary ? "rotate-180" : ""}`} />
            </button>

            {showDocSummary && (
              <div className="border-t border-slate-200 dark:border-zinc-700 px-5 py-4">
                <div className="flex flex-wrap gap-5">
                  {/* Production */}
                  {allProdDT.length > 0 && (
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-2.5 flex items-center gap-1">⚙ Production</p>
                      <div className="flex flex-wrap gap-2">
                        {allProdDT.map(([dt, { count, countType }]) => {
                          const max = Math.max(...allProdDT.map(([, v]) => v.count), 1);
                          return (
                            <div key={dt} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 min-w-[150px]">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1">
                                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{dt}</p>
                                  <CountTypeBadge countType={countType} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{count}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Non-Production */}
                  {allNonProdDT.length > 0 && (
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1">✉ Non-Production</p>
                      <div className="flex flex-wrap gap-2">
                        {allNonProdDT.map(([dt, { count, countType }]) => {
                          const max = Math.max(...allNonProdDT.map(([, v]) => v.count), 1);
                          return (
                            <div key={dt} className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 min-w-[150px]">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1">
                                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{dt}</p>
                                  <CountTypeBadge countType={countType} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400 dark:bg-zinc-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 tabular-nums">{count}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Grouped view ── */}
        {!loading && isGrouped && groups.map(group => {
          const rows      = grouped[group] ?? [];
          const collapsed = collapsedGroups.has(group);
          const gTat      = rows.reduce((a, r) => a + r.totalTat, 0);
          const gTotal    = rows.reduce((a, r) => a + r.total, 0);
          const gComp     = rows.reduce((a, r) => a + r.completion, 0);
          const gPend     = rows.reduce((a, r) => a + r.pending, 0);
          const gEsc      = rows.reduce((a, r) => a + r.escalation, 0);
          const gHold     = rows.reduce((a, r) => a + r.hold, 0);
          const gProd     = rows.reduce((a, r) => a + r.productiveSeconds, 0);

          return (
            <div key={group} className="mb-5">
              <button onClick={() => toggleGroup(group)} className="flex items-center gap-3 mb-2 w-full text-left">
                <div className="flex items-center gap-2">
                  {collapsed
                    ? <ChevronRight size={13} className="text-slate-400 dark:text-zinc-500" />
                    : <ChevronDown  size={13} className="text-indigo-500 dark:text-indigo-400" />}
                  <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">{group}</h2>
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-zinc-500 flex-wrap">
                  <span>{rows.length} agent{rows.length !== 1 ? "s" : ""}</span>
                  <span>Prod: <span className="text-emerald-500 font-mono font-semibold">{formatTat(gProd)}</span></span>
                  <span>THT: <span className="text-indigo-500 dark:text-indigo-400 font-mono font-semibold">{formatTat(gTat)}</span></span>
                  <span>✓ <span className="text-green-600 font-semibold">{gComp}</span></span>
                  <span>⏳ <span className="text-amber-500 font-semibold">{gPend}</span></span>
                  <span>↑ <span className="text-purple-500 font-semibold">{gEsc}</span></span>
                  <span>⏸ <span className="text-sky-500 font-semibold">{gHold}</span></span>
                  <span>Total TX: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{gTotal}</span></span>
                </div>
              </button>
              {!collapsed && renderTable(rows, true)}
            </div>
          );
        })}

        {/* ── Ungrouped view ── */}
        {!loading && !isGrouped && flatRows.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-500" />
                <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">All Agents</h2>
              </div>
              <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">{flatRows.length} agents</span>
            </div>
            {renderTable(flatRows, false)}
          </div>
        )}

        {/* ── Overall totals row ── */}
        {!loading && allRows.length > 0 && (
          <div className="mt-2 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider text-xs">Overall Total</td>
                  <td className="text-center px-4 py-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">{formatTat(totals.productiveSeconds)}</td>
                  <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 font-bold text-xs">{formatTat(totals.totalTat)}</td>
                  <td className="text-center px-4 py-3.5 text-green-600 dark:text-green-400 font-bold">{totals.completion}</td>
                  <td className="text-center px-4 py-3.5 text-amber-500 dark:text-amber-400 font-bold">{totals.pending}</td>
                  <td className="text-center px-4 py-3.5 text-purple-500 dark:text-purple-400 font-bold">{totals.escalation}</td>
                  <td className="text-center px-4 py-3.5 text-sky-500 dark:text-sky-400 font-bold">{totals.hold}</td>
                  <td className="text-center px-4 py-3.5 text-slate-900 dark:text-zinc-100 font-bold">{totals.total}</td>
                  <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs font-bold">{formatTat(overallAht)}</td>
                  <td className="w-20" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}