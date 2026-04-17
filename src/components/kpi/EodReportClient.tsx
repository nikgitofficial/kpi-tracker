"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronRight, FileText, FileSpreadsheet,
  Layers, Ungroup,
} from "lucide-react";

type TxStatus = "PENDING" | "COMPLETION" | "ESCALATION";

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
}

interface AgentRow {
  agentId: string;
  agentName: string;
  group: string;
  totalTat: number;
  completion: number;
  pending: number;
  escalation: number;
  total: number;
  aht: number;
  transactions: Transaction[];
  docTypeCounts: Record<string, number>;
}

interface Agent {
  _id: string;
  name: string;
  group?: string;
}

function formatTat(sec?: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today() { return new Date().toISOString().split("T")[0]; }

const STATUS_STYLES: Record<TxStatus, string> = {
  COMPLETION: "bg-green-100 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400",
  PENDING:    "bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
  ESCALATION: "bg-purple-100 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400",
};

function statusLabel(s: TxStatus) {
  if (s === "COMPLETION") return "Completion";
  if (s === "ESCALATION") return "Escalation";
  return "Pending";
}

/* ─── Doc Type Breakdown (expandable per agent) ─── */
function DocTypeBreakdown({
  counts,
  allDocTypes,
}: {
  counts: Record<string, number>;
  allDocTypes: string[];
}) {
  const maxCount = Math.max(...Object.values(counts), 1);
  const active = allDocTypes.filter(dt => (counts[dt] ?? 0) > 0);
  if (active.length === 0) return null;
  return (
    <tr className="bg-indigo-50/40 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900">
      <td colSpan={8} className="px-6 py-2.5 pl-16">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {active.map(dt => {
            const count = counts[dt] ?? 0;
            return (
              <div key={dt} className="flex items-center gap-2 min-w-[140px]">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-28 truncate">{dt}</span>
                <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden w-16">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums w-5 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

/* ─── Export helpers ─── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

async function exportToExcel(
  grouped: Record<string, AgentRow[]>,
  groups: string[],
  totals: { totalTat: number; completion: number; pending: number; escalation: number; total: number },
  overallAht: number,
  globalDocTypeCounts: Record<string, number>,
  date: string,
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  const allDocTypes = Object.keys(globalDocTypeCounts).sort();

  // Summary sheet with group subtotals + doc type columns
  const summaryRows: object[] = [];
  for (const group of groups) {
    const rows = grouped[group] ?? [];
    rows.forEach((r, i) => {
      const base: Record<string, unknown> = {
        "#":                 i + 1,
        "Group":             group,
        "Agent":             r.agentName,
        "Total Handle Time": formatTat(r.totalTat),
        "Completion":        r.completion,
        "Pending":           r.pending,
        "Escalation":        r.escalation,
        "Total TX":          r.total,
        "AHT per TX":        formatTat(r.aht),
      };
      for (const dt of allDocTypes) base[dt] = r.docTypeCounts[dt] ?? 0;
      summaryRows.push(base);
    });
    if (rows.length > 1) {
      const gTat   = rows.reduce((a, r) => a + r.totalTat, 0);
      const gTotal = rows.reduce((a, r) => a + r.total, 0);
      const sub: Record<string, unknown> = {
        "#":                 "—",
        "Group":             group,
        "Agent":             "SUBTOTAL",
        "Total Handle Time": formatTat(gTat),
        "Completion":        rows.reduce((a, r) => a + r.completion, 0),
        "Pending":           rows.reduce((a, r) => a + r.pending, 0),
        "Escalation":        rows.reduce((a, r) => a + r.escalation, 0),
        "Total TX":          gTotal,
        "AHT per TX":        formatTat(gTotal ? Math.round(gTat / gTotal) : 0),
      };
      for (const dt of allDocTypes)
        sub[dt] = rows.reduce((a, r) => a + (r.docTypeCounts[dt] ?? 0), 0);
      summaryRows.push(sub);
    }
  }
  const overall: Record<string, unknown> = {
    "#":                 "—",
    "Group":             "ALL",
    "Agent":             "TOTAL",
    "Total Handle Time": formatTat(totals.totalTat),
    "Completion":        totals.completion,
    "Pending":           totals.pending,
    "Escalation":        totals.escalation,
    "Total TX":          totals.total,
    "AHT per TX":        formatTat(overallAht),
    "Productivity Hours":  formatTat(totals.totalTat),
  };
  for (const dt of allDocTypes) overall[dt] = globalDocTypeCounts[dt] ?? 0;
  summaryRows.push(overall);

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 4 }, { wch: 16 }, { wch: 24 }, { wch: 20 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    ...allDocTypes.map(() => ({ wch: 16 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Doc Type totals sheet
  const docRows = allDocTypes.map(dt => ({ "Task Type": dt, "Total": globalDocTypeCounts[dt] ?? 0 }));
  const wsDT = XLSX.utils.json_to_sheet(docRows);
  wsDT["!cols"] = [{ wch: 28 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDT, "Task Type Summary");

  // Per-agent sheets
  for (const group of groups) {
    for (const row of grouped[group] ?? []) {
      const txRows = row.transactions.map((tx, i) => ({
        "#":           i + 1,
        "TX ID":       tx.txId,
        "Type of Taks": tx.docType,
        "Company":     tx.companyName,
        "Volume":      tx.volume,
        "Start":       tx.startTime,
        "End":         tx.endTime ?? "—",
        "TAT":         formatTat(tx.tat),
        "Status":      statusLabel(tx.status),
        "Notes":       tx.notes ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(txRows);
      ws["!cols"] = [
        { wch: 4 }, { wch: 14 }, { wch: 18 }, { wch: 26 }, { wch: 8 },
        { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 28 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, row.agentName.slice(0, 31));
    }
  }

  XLSX.writeFile(wb, `eod-report_${date}.xlsx`);
}

async function exportToPdf(
  grouped: Record<string, AgentRow[]>,
  groups: string[],
  totals: { totalTat: number; completion: number; pending: number; escalation: number; total: number },
  overallAht: number,
  globalDocTypeCounts: Record<string, number>,
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
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Agent Daily Production", 10, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 180);
  doc.text(formattedDate, 10, 20);

  const statItems = [
    { label: "TOTAL TX",      value: String(totals.total)      },
    { label: "COMPLETION",    value: String(totals.completion)  },
    { label: "PENDING",       value: String(totals.pending)     },
    { label: "ESCALATION",    value: String(totals.escalation)  },
    { label: "ACTIVE AGENTS", value: String(activeAgents)       },
    { label: "OVERALL AHT",   value: formatTat(overallAht)      },
    { label: "PRODUCTIVE HRS", value: formatTat(totals.totalTat)  },
    
  ];
  const bw = 40, bh = 14, startX = 10, statY = 25;
  const statColors: [number, number, number][] = [
    [180, 180, 220], [80, 200, 120], [220, 170, 60],
    [160, 120, 220], [120, 160, 255], [120, 160, 255],
    [80, 200, 160], 
  ];
  statItems.forEach((s, i) => {
    const x = startX + i * (bw + 4);
    doc.setFillColor(35, 35, 58);
    doc.roundedRect(x, statY, bw, bh, 2, 2, "F");
    doc.setTextColor(...statColors[i]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + bw / 2, statY + 7, { align: "center" });
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 150);
    doc.text(s.label, x + bw / 2, statY + 12, { align: "center" });
  });

  let cursorY = 44;

  for (const group of groups) {
    const rows   = grouped[group] ?? [];
    const gTat   = rows.reduce((a, r) => a + r.totalTat, 0);
    const gTotal = rows.reduce((a, r) => a + r.total, 0);

    if (cursorY > 170) { doc.addPage(); cursorY = 10; }

    doc.setFillColor(40, 40, 65);
    doc.rect(10, cursorY, 277, 7, "F");
    doc.setTextColor(160, 160, 210); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(group.toUpperCase(), 13, cursorY + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 160);
    doc.text(
      `${rows.length} agent${rows.length !== 1 ? "s" : ""}  ·  THT: ${formatTat(gTat)}  ·  Total TX: ${gTotal}`,
      287, cursorY + 5, { align: "right" }
    );
    cursorY += 8;

    const summaryBody = rows.map((r, i) => [
      i + 1, r.agentName, formatTat(r.totalTat),
      r.completion, r.pending, r.escalation, r.total, formatTat(r.aht),
    ]);
    if (rows.length > 1) {
      summaryBody.push([
        "—", "SUBTOTAL", formatTat(gTat),
        rows.reduce((a, r) => a + r.completion, 0),
        rows.reduce((a, r) => a + r.pending, 0),
        rows.reduce((a, r) => a + r.escalation, 0),
        gTotal,
        formatTat(gTotal ? Math.round(gTat / gTotal) : 0),
      ]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: cursorY,
      head: [["#", "Agent", "Total Handle Time", "Completion", "Pending", "Escalation", "Total TX", "AHT per TX"]],
      body: summaryBody,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center" },
        1: { cellWidth: 46 },
        2: { cellWidth: 34, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
        3: { cellWidth: 22, halign: "center", textColor: [80, 200, 120] },
        4: { cellWidth: 18, halign: "center", textColor: [220, 170, 60] },
        5: { cellWidth: 22, halign: "center", textColor: [160, 120, 220] },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 34, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      },
      margin: { left: 10, right: 10 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Doc Type summary page
  const allDocTypes = Object.keys(globalDocTypeCounts).sort();
  if (allDocTypes.length > 0) {
    doc.addPage();
    doc.setFillColor(20, 20, 36);
    doc.rect(0, 0, 297, 14, "F");
    doc.setTextColor(160, 160, 210);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Tasks Summary — Task Type Breakdown", 10, 10);

    const docBody = allDocTypes.map(dt => [dt, globalDocTypeCounts[dt] ?? 0]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 18,
      head: [["Task Type", "Total Count"]],
      body: docBody,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
      headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [28, 28, 48] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      },
      margin: { left: 10, right: 10 },
    });
  }

  // Per-agent detail pages
  for (const group of groups) {
    for (const row of grouped[group] ?? []) {
      if (row.transactions.length === 0) continue;
      doc.addPage();
      doc.setFillColor(30, 30, 52);
      doc.rect(0, 0, 297, 16, "F");
      doc.setTextColor(180, 180, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`${row.agentName}`, 10, 10);
      doc.setTextColor(110, 110, 180); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      doc.text(group, 10, 15);
      doc.setFontSize(8); doc.setTextColor(110, 110, 160);
      doc.text(
        `THT: ${formatTat(row.totalTat)}  ·  Completion: ${row.completion}  ·  Pending: ${row.pending}  ·  Escalation: ${row.escalation}  ·  Total: ${row.total}  ·  AHT: ${formatTat(row.aht)}`,
        287, 13, { align: "right" }
      );

      const txBody = row.transactions.map((tx, i) => [
        i + 1, tx.txId, tx.docType, tx.companyName, tx.volume,
        tx.startTime, tx.endTime ?? "—", formatTat(tx.tat), statusLabel(tx.status), tx.notes ?? "—",
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).autoTable({
        startY: 20,
        head: [["#", "TX ID", "Type of Task", "Company", "Vol", "Start", "End", "TAT", "Status", "Notes"]],
        body: txBody,
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [190, 190, 210], fillColor: [22, 22, 38], lineColor: [45, 45, 70], lineWidth: 0.2 },
        headStyles: { fillColor: [35, 35, 60], textColor: [130, 130, 190], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [28, 28, 48] },
        columnStyles: {
          0: { cellWidth: 8,  halign: "center" },
          1: { cellWidth: 22, textColor: [160, 160, 220] },
          2: { cellWidth: 28 },
          3: { cellWidth: 48 },
          4: { cellWidth: 10, halign: "center" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 22, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
          8: { cellWidth: 22, halign: "center" },
          9: { cellWidth: "auto" },
        },
        didDrawCell: (data: any) => {
          if (data.column.index === 8 && data.section === "body") {
            const val = data.cell.raw as string;
            const colours: Record<string, [number, number, number]> = {
              "Completion": [80, 200, 120],
              "Pending":    [220, 170, 60],
              "Escalation": [160, 120, 220],
            };
            if (colours[val]) {
              doc.setTextColor(...colours[val]);
              doc.setFontSize(7.5);
              doc.setFont("helvetica", "bold");
              doc.text(val, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
            }
          }
        },
        margin: { left: 10, right: 10 },
      });
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(80, 80, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }

  doc.save(`eod-report_${date}.pdf`);
}

/* ─── Main Component ─── */
export function EodReportClient() {
  const [date, setDate] = useState(today());
  const [grouped, setGrouped] = useState<Record<string, AgentRow[]>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [globalDocTypeCounts, setGlobalDocTypeCounts] = useState<Record<string, number>>({});

  // View toggles
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set());       // tx detail rows
  const [expandedDt, setExpandedDt] = useState<Set<string>>(new Set());       // doc-type breakdown rows
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showDocSummary, setShowDocSummary] = useState(true);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [txRes, agentRes] = await Promise.all([
      fetch(`/api/kpi/transactions?date=${date}`),
      fetch("/api/kpi/agents"),
    ]);
    const txData    = await txRes.json();
    const agentData = await agentRes.json();

    const txs: Transaction[] = txData.transactions ?? [];
    const agents: Agent[]    = agentData.agents ?? [];

    const groupMap = new Map<string, string>();
    for (const a of agents) groupMap.set(a._id, a.group ?? "Ungrouped");

    const agentRowMap = new Map<string, AgentRow>();
    for (const tx of txs) {
      if (!agentRowMap.has(tx.agentId)) {
        agentRowMap.set(tx.agentId, {
          agentId:       tx.agentId,
          agentName:     tx.agentName,
          group:         groupMap.get(tx.agentId) ?? "Ungrouped",
          totalTat:      0,
          completion:    0,
          pending:       0,
          escalation:    0,
          total:         0,
          aht:           0,
          transactions:  [],
          docTypeCounts: {},
        });
      }
      const row = agentRowMap.get(tx.agentId)!;
      row.total++;
      row.transactions.push(tx);
      if (tx.tat) row.totalTat += tx.tat;
      if (tx.status === "COMPLETION") row.completion++;
      if (tx.status === "PENDING")    row.pending++;
      if (tx.status === "ESCALATION") row.escalation++;
      // tally doc type
      row.docTypeCounts[tx.docType] = (row.docTypeCounts[tx.docType] ?? 0) + 1;
    }

    const rows = Array.from(agentRowMap.values()).map(r => ({
      ...r,
      aht: r.total ? Math.round(r.totalTat / r.total) : 0,
    }));

    // Build global doc type counts
    const globalDT: Record<string, number> = {};
    for (const r of rows) {
      for (const [dt, cnt] of Object.entries(r.docTypeCounts)) {
        globalDT[dt] = (globalDT[dt] ?? 0) + cnt;
      }
    }

    // Group agents
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
        seenGroups.add(g);
        orderedGroups.push(g);
      }
    }
    for (const g of Object.keys(groupedResult)) {
      if (!seenGroups.has(g)) orderedGroups.push(g);
    }
    orderedGroups.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    setGrouped(groupedResult);
    setGroups(orderedGroups);
    setGlobalDocTypeCounts(globalDT);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const toggleTx = (id: string) =>
    setExpandedTx(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleDt = (id: string) =>
    setExpandedDt(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleGroup = (g: string) =>
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  const allRows      = Object.values(grouped).flat();
  const flatRows     = [...allRows].sort((a, b) => a.agentName.localeCompare(b.agentName));
  const allDocTypes  = Object.keys(globalDocTypeCounts).sort();

  const totals = allRows.reduce(
    (acc, r) => ({
      totalTat:   acc.totalTat   + r.totalTat,
      completion: acc.completion + r.completion,
      pending:    acc.pending    + r.pending,
      escalation: acc.escalation + r.escalation,
      total:      acc.total      + r.total,
    }),
    { totalTat: 0, completion: 0, pending: 0, escalation: 0, total: 0 }
  );

  const overallAht   = totals.total ? Math.round(totals.totalTat / totals.total) : 0;
  const activeAgents = allRows.filter(r => r.total > 0).length;
  const canExport    = allRows.length > 0;

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const handleExcelExport = async () => {
    setExporting("excel");
    try { await exportToExcel(grouped, groups, totals, overallAht, globalDocTypeCounts, date); }
    finally { setExporting(null); }
  };

  const handlePdfExport = async () => {
    setExporting("pdf");
    try { await exportToPdf(grouped, groups, totals, overallAht, globalDocTypeCounts, date, formattedDate, activeAgents); }
    finally { setExporting(null); }
  };

  /* ── Renders agent table rows (shared between grouped & ungrouped) ── */
  const renderAgentRows = (rows: AgentRow[]) =>
    rows.map((row, i) => {
      const txOpen = expandedTx.has(row.agentId);
      const dtOpen = expandedDt.has(row.agentId);
      const hasDt  = Object.keys(row.docTypeCounts).length > 0;
      const isLast = i === rows.length - 1;

      return (
        <React.Fragment key={row.agentId}>
          {/* Agent summary row */}
          <tr
            className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
              isLast && !txOpen && !dtOpen ? "border-b-0" : ""
            }`}
            onClick={() => toggleTx(row.agentId)}
          >
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                {txOpen
                  ? <ChevronDown  size={13} className="text-slate-400 dark:text-zinc-500" />
                  : <ChevronRight size={13} className="text-slate-400 dark:text-zinc-500" />}
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {row.agentName.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-slate-700 dark:text-zinc-200 font-medium">{row.agentName}</span>
              </div>
            </td>
            <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 font-semibold text-xs">
              {formatTat(row.totalTat)}
            </td>
            <td className="text-center px-4 py-3.5 text-green-600 dark:text-green-400 font-semibold">{row.completion}</td>
            <td className="text-center px-4 py-3.5 text-amber-500 dark:text-amber-400 font-semibold">{row.pending || 0}</td>
            <td className="text-center px-4 py-3.5 text-purple-500 dark:text-purple-400 font-semibold">{row.escalation || 0}</td>
            <td className="text-center px-4 py-3.5 text-slate-700 dark:text-zinc-200 font-semibold">{row.total}</td>
            <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs font-semibold">
              {formatTat(row.aht)}
            </td>
            {/* Doc-type toggle button */}
            <td className="pr-3 py-3.5 text-right">
              {hasDt && (
                <button
                  onClick={e => { e.stopPropagation(); toggleDt(row.agentId); }}
                  title="Toggle Task type breakdown"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all ${
                    dtOpen
                      ? "bg-indigo-100 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                      : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-indigo-200 dark:hover:border-indigo-700 hover:text-indigo-500 dark:hover:text-indigo-400"
                  }`}
                >
                  Tasks
                  {dtOpen
                    ? <ChevronDown  size={10} />
                    : <ChevronRight size={10} />}
                </button>
              )}
            </td>
          </tr>

          {/* Doc type breakdown */}
          {dtOpen && hasDt && (
            <DocTypeBreakdown counts={row.docTypeCounts} allDocTypes={allDocTypes} />
          )}

          {/* Transaction detail */}
          {txOpen && (
            <tr>
              <td colSpan={8} className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 px-6 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
                  {row.agentName} — {row.transactions.length} Transaction{row.transactions.length !== 1 ? "s" : ""}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 dark:text-zinc-500">
                      <th className="text-left py-1.5 pr-4 font-semibold">#</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">ID</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">Type of Tasks</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">Company</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">Start</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">End</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">TAT</th>
                      <th className="text-left py-1.5 pr-4 font-semibold">Status</th>
                      <th className="text-left py-1.5 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.transactions.map((tx, j) => (
                      <tr key={tx._id} className="border-t border-slate-100 dark:border-zinc-800">
                        <td className="py-2 pr-4 text-slate-400 dark:text-zinc-500">{j + 1}</td>
                        <td className="py-2 pr-4 font-mono text-slate-600 dark:text-zinc-300 font-semibold">{tx.txId}</td>
                        <td className="py-2 pr-4 text-slate-500 dark:text-zinc-400">{tx.docType}</td>
                        <td className="py-2 pr-4 text-slate-500 dark:text-zinc-400 max-w-[120px] truncate">{tx.companyName}</td>
                        <td className="py-2 pr-4 font-mono text-slate-500 dark:text-zinc-400">{tx.startTime}</td>
                        <td className="py-2 pr-4 font-mono text-slate-500 dark:text-zinc-400">{tx.endTime ?? "—"}</td>
                        <td className="py-2 pr-4 font-mono text-indigo-500 dark:text-indigo-400 font-semibold">{formatTat(tx.tat)}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${STATUS_STYLES[tx.status]}`}>
                            {statusLabel(tx.status)}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400 dark:text-zinc-500">{tx.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });

  /* ── Agent table shell ── */
  const renderTable = (rows: AgentRow[], gTat: number, gTotal: number, gComp: number, gPend: number, gEsc: number, gAht: number, showSubtotal: boolean) => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Agent</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-indigo-400 dark:text-indigo-400">Total Handle Time</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-500"># Completion</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-amber-500 dark:text-amber-400"># Pending</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-purple-500 dark:text-purple-400"># Escalation</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Total TX</th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-indigo-400 dark:text-indigo-400">AHT per TX</th>
            <th className="w-20 px-3 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-300 dark:text-zinc-600 text-right">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {renderAgentRows(rows)}
          {showSubtotal && rows.length > 1 && (
            <tr className="bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-700">
              <td className="px-5 py-2.5 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider pl-14">Subtotal</td>
              <td className="text-center px-4 py-2.5 font-mono text-indigo-500 dark:text-indigo-400 font-bold text-xs">{formatTat(gTat)}</td>
              <td className="text-center px-4 py-2.5 text-green-600 dark:text-green-400 font-bold">{gComp}</td>
              <td className="text-center px-4 py-2.5 text-amber-500 dark:text-amber-400 font-bold">{gPend}</td>
              <td className="text-center px-4 py-2.5 text-purple-500 dark:text-purple-400 font-bold">{gEsc}</td>
              <td className="text-center px-4 py-2.5 text-slate-700 dark:text-zinc-200 font-bold">{gTotal}</td>
              <td className="text-center px-4 py-2.5 font-mono text-indigo-500 dark:text-indigo-400 text-xs font-bold">{formatTat(gAht)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KPI</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Agent Daily Production</h1>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">{formattedDate}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={() => setDate(today())}
              className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              Today
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />

            {/* Group / Ungroup toggle */}
            <button
              onClick={() => setIsGrouped(g => !g)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                isGrouped
                  ? "bg-slate-700 dark:bg-slate-600 border-slate-700 dark:border-slate-600 text-white hover:bg-slate-800 dark:hover:bg-slate-700"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
              }`}
              title={isGrouped ? "Switch to ungrouped view" : "Switch to grouped view"}
            >
              {isGrouped ? <Layers size={13} /> : <Ungroup size={13} />}
              {isGrouped ? "Grouped" : "Ungrouped"}
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />

            <button
              onClick={handleExcelExport}
              disabled={!canExport || exporting === "excel"}
              title={canExport ? "Export to Excel" : "No data to export"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
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
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-300 dark:text-zinc-600 cursor-not-allowed"
              }`}
            >
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Total TX",      value: totals.total,          color: "text-slate-700 dark:text-zinc-200"  },
            { label: "Completion",    value: totals.completion,     color: "text-green-600 dark:text-green-400"  },
            { label: "Pending",       value: totals.pending,        color: "text-amber-500 dark:text-amber-400"  },
            { label: "Escalation",    value: totals.escalation,     color: "text-purple-500 dark:text-purple-400" },
            { label: "Active Agents", value: activeAgents,          color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Overall AHT",   value: formatTat(overallAht), color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Productivity Hours",   value: formatTat(totals.totalTat),       color: "text-emerald-600 dark:text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 text-center">
              <p className={`text-lg font-bold leading-tight ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">Loading…</div>
        )}

        {!loading && groups.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <p className="text-slate-500 dark:text-zinc-400 text-sm">No data for this date.</p>
          </div>
        )}

        {/* ── Tasks Summary Panel ── */}
        {!loading && allDocTypes.length > 0 && (
          <div className="mb-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowDocSummary(s => !s)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Tasks Summary</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  {allDocTypes.length} type{allDocTypes.length !== 1 ? "s" : ""} · {Object.values(globalDocTypeCounts).reduce((a, b) => a + b, 0)} total transactions
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${showDocSummary ? "rotate-180" : ""}`}
              />
            </button>

            {showDocSummary && (
              <div className="border-t border-slate-200 dark:border-zinc-700 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3">Overall Totals</p>
                <div className="flex flex-wrap gap-3">
                  {allDocTypes.map(dt => {
                    const count    = globalDocTypeCounts[dt] ?? 0;
                    const maxCount = Math.max(...Object.values(globalDocTypeCounts), 1);
                    return (
                      <div key={dt} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 min-w-[150px]">
                        <div className="flex-1">
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{dt}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                                style={{ width: `${(count / maxCount) * 100}%` }}
                              />
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
          </div>
        )}

        {/* ── GROUPED view ── */}
        {!loading && isGrouped && groups.map(group => {
          const rows    = grouped[group] ?? [];
          const gTat    = rows.reduce((a, r) => a + r.totalTat, 0);
          const gTotal  = rows.reduce((a, r) => a + r.total, 0);
          const gComp   = rows.reduce((a, r) => a + r.completion, 0);
          const gPend   = rows.reduce((a, r) => a + r.pending, 0);
          const gEsc    = rows.reduce((a, r) => a + r.escalation, 0);
          const gAht    = gTotal ? Math.round(gTat / gTotal) : 0;
          const collapsed = collapsedGroups.has(group);

          return (
            <div key={group} className="mb-5">
              {/* Group header — clickable to collapse */}
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center gap-3 mb-2 w-full text-left"
              >
                <div className="flex items-center gap-2">
                  {collapsed
                    ? <ChevronRight size={13} className="text-slate-400 dark:text-zinc-500" />
                    : <ChevronDown  size={13} className="text-indigo-500 dark:text-indigo-400" />}
                  <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">{group}</h2>
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-zinc-500">
                  <span>{rows.length} agent{rows.length !== 1 ? "s" : ""}</span>
                  <span>THT: <span className="text-indigo-500 dark:text-indigo-400 font-mono font-semibold">{formatTat(gTat)}</span></span>
                  <span>Completion: <span className="text-green-600 dark:text-green-400 font-semibold">{gComp}</span></span>
                  <span>Pending: <span className="text-amber-500 dark:text-amber-400 font-semibold">{gPend}</span></span>
                  <span>Escalation: <span className="text-purple-500 dark:text-purple-400 font-semibold">{gEsc}</span></span>
                  <span>Total TX: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{gTotal}</span></span>
                </div>
              </button>

              {!collapsed && renderTable(rows, gTat, gTotal, gComp, gPend, gEsc, gAht, true)}
            </div>
          );
        })}

        {/* ── UNGROUPED view ── */}
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
            {renderTable(
              flatRows,
              totals.totalTat, totals.total,
              totals.completion, totals.pending, totals.escalation,
              overallAht,
              false,
            )}
          </div>
        )}

        {/* ── Overall totals ── */}
        {!loading && allRows.length > 0 && (
          <div className="mt-2 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider text-xs">Overall Total</td>
                  <td className="text-center px-4 py-3.5 font-mono text-indigo-500 dark:text-indigo-400 font-bold text-xs">{formatTat(totals.totalTat)}</td>
                  <td className="text-center px-4 py-3.5 text-green-600 dark:text-green-400 font-bold">{totals.completion}</td>
                  <td className="text-center px-4 py-3.5 text-amber-500 dark:text-amber-400 font-bold">{totals.pending}</td>
                  <td className="text-center px-4 py-3.5 text-purple-500 dark:text-purple-400 font-bold">{totals.escalation}</td>
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