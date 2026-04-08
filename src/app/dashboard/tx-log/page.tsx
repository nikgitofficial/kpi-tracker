"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Square, Plus, Trash2, CheckCircle2, Clock, AlertTriangle, Users, Tag, FileText, FileSpreadsheet } from "lucide-react";

/* ─── Types ─── */
interface Agent { _id: string; name: string; group?: string }
interface DocType { _id: string; name: string }
interface Transaction {
  _id: string;
  agentName: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  endTime?: string;
  tat?: number;
  status: "PENDING" | "COMPLETION" | "ESCALATION";
  notes?: string;
  date: string;
}

/* ─── Helpers ─── */
function formatTat(sec?: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
function now24() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function today() { return new Date().toISOString().split("T")[0]; }

const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   icon: Clock },
  COMPLETION: { label: "Completion", color: "text-green-600",  bg: "bg-green-50 border-green-200",   icon: CheckCircle2 },
  ESCALATION: { label: "Escalation", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: AlertTriangle },
};

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.color} ${cfg.bg}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

interface ActiveTx { _id: string; docType: string; companyName: string; startTime: string; }

/* ─── Export helpers (unchanged) ─── */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportToExcel(transactions: Transaction[], agentName: string, date: string, stats: { total: number; completion: number; pending: number; escalation: number; avgTat: number }) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const rows = transactions.map((tx, i) => ({ "#": i + 1, "Type of Doc": tx.docType, "Company": tx.companyName, "Volume": tx.volume, "Start": tx.startTime, "End": tx.endTime ?? "—", "TAT": formatTat(tx.tat), "Status": tx.status, "Notes": tx.notes ?? "" }));
  const summary = [["Agent", agentName], ["Date", date], ["Total TX", stats.total], ["Completion", stats.completion], ["Pending", stats.pending], ["Escalation", stats.escalation], ["Avg TAT", formatTat(stats.avgTat)]];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  ws2["!cols"] = [{ wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  XLSX.writeFile(wb, `tx-log_${agentName}_${date}.xlsx`);
}

async function exportToPdf(transactions: Transaction[], agentName: string, date: string, formattedDate: string, stats: { total: number; completion: number; pending: number; escalation: number; avgTat: number }) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(30, 30, 46);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Transaction Log", 10, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 190);
  doc.text(`${agentName}  ·  ${formattedDate}`, 10, 20);
  const statItems = [{ label: "Total TX", value: String(stats.total) }, { label: "Completion", value: String(stats.completion) }, { label: "Pending", value: String(stats.pending) }, { label: "Escalation", value: String(stats.escalation) }, { label: "Avg TAT", value: formatTat(stats.avgTat) }];
  statItems.forEach((s, i) => {
    const x = 10 + i * 44;
    doc.setFillColor(40, 40, 60); doc.roundedRect(x, 26, 40, 14, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 20, 33, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 160);
    doc.text(s.label.toUpperCase(), x + 20, 38, { align: "center" });
  });
  const tableBody = transactions.map((tx, i) => [i + 1, tx.docType, tx.companyName, tx.volume, tx.startTime, tx.endTime ?? "—", formatTat(tx.tat), tx.status, tx.notes ?? "—"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 44,
    head: [["#", "Type of Doc", "Company", "Vol", "Start", "End", "TAT", "Status", "Notes"]],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [200, 200, 210], fillColor: [25, 25, 40], lineColor: [50, 50, 70], lineWidth: 0.2 },
    headStyles: { fillColor: [40, 40, 65], textColor: [150, 150, 200], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [30, 30, 50] },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 30 }, 2: { cellWidth: 45 }, 3: { cellWidth: 12, halign: "center" }, 4: { cellWidth: 18, halign: "center" }, 5: { cellWidth: 18, halign: "center" }, 6: { cellWidth: 20, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" }, 7: { cellWidth: 24, halign: "center" }, 8: { cellWidth: "auto" } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell: (data: any) => {
      if (data.column.index === 7 && data.section === "body") {
        const val = data.cell.raw as string;
        const colours: Record<string, [number, number, number]> = { COMPLETION: [52, 211, 153], PENDING: [251, 191, 36], ESCALATION: [167, 139, 250] };
        if (colours[val]) { doc.setTextColor(...colours[val]); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(val, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" }); }
      }
    },
    margin: { left: 10, right: 10 },
  });
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(90, 90, 120);
    doc.text(`Page ${p} of ${pageCount}`, 287, 205, { align: "right" });
    doc.text(`Generated ${new Date().toLocaleString()}`, 10, 205);
  }
  doc.save(`tx-log_${agentName}_${date}.pdf`);
}

/* ─── Input / Select shared classes ─── */
const inputCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const selectCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";

/* ─── Main Page ─── */
export default function TxLogPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [date, setDate] = useState(today());

  const [docType, setDocType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [volume, setVolume] = useState("1");
  const [startTime, setStartTime] = useState(now24());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [startSuccess, setStartSuccess] = useState("");

  const [activeTx, setActiveTx] = useState<ActiveTx | null>(null);
  const [endTime, setEndTime] = useState(now24());
  const [endStatus, setEndStatus] = useState<Transaction["status"]>("PENDING");
  const [endNotes, setEndNotes] = useState("");
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [endSuccess, setEndSuccess] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [newAgent, setNewAgent] = useState("");
  const [newAgentGroup, setNewAgentGroup] = useState("");
  const [newDocType, setNewDocType] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  useEffect(() => {
    fetch("/api/kpi/agents").then(r => r.json()).then(d => {
      setAgents(d.agents ?? []);
      if (d.agents?.length > 0 && !selectedAgent) setSelectedAgent(d.agents[0]);
    });
    fetch("/api/kpi/doc-types").then(r => r.json()).then(d => {
      setDocTypes(d.docTypes ?? []);
      if (d.docTypes?.length > 0) setDocType(d.docTypes[0].name);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTx = useCallback(async () => {
    if (!selectedAgent) return;
    const res = await fetch(`/api/kpi/transactions?date=${date}&agentId=${selectedAgent._id}`);
    const d = await res.json();
    const VALID = new Set(["PENDING", "COMPLETION", "ESCALATION"]);
    const completed = (d.transactions ?? [])
      .filter((t: Transaction) => t.endTime)
      .map((t: Transaction) => ({ ...t, status: VALID.has(t.status) ? t.status : "PENDING" }));
    setTransactions(completed);
  }, [selectedAgent, date]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const stats = {
    total:      transactions.length,
    completion: transactions.filter(t => t.status === "COMPLETION").length,
    pending:    transactions.filter(t => t.status === "PENDING").length,
    escalation: transactions.filter(t => t.status === "ESCALATION").length,
    avgTat: (() => {
      const withTat = transactions.filter(t => t.tat);
      return withTat.length ? Math.round(withTat.reduce((a, t) => a + (t.tat ?? 0), 0) / withTat.length) : 0;
    })(),
  };

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleExcelExport = async () => {
    if (!selectedAgent || transactions.length === 0) return;
    setExporting("excel");
    try { await exportToExcel(transactions, selectedAgent.name, date, stats); } finally { setExporting(null); }
  };

  const handlePdfExport = async () => {
    if (!selectedAgent || transactions.length === 0) return;
    setExporting("pdf");
    try { await exportToPdf(transactions, selectedAgent.name, date, formattedDate, stats); } finally { setExporting(null); }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setFormError("");
    if (!docType) { setFormError("Select a doc type"); return; }
    if (!companyName.trim()) { setFormError("Company name is required"); return; }
    setSubmitting(true);
    const res = await fetch("/api/kpi/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent._id, agentName: selectedAgent.name, docType, companyName: companyName.trim(), volume: Number(volume), startTime, date, status: "PENDING", notes: notes.trim() || undefined }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setActiveTx({ _id: data.transaction._id, docType, companyName: companyName.trim(), startTime });
      setEndTime(now24()); setEndStatus("PENDING"); setEndNotes("");
      setStartSuccess("Transaction started");
      setCompanyName(""); setNotes(""); setVolume("1"); setStartTime(now24());
      setTimeout(() => setStartSuccess(""), 3000);
    } else {
      const err = await res.json();
      setFormError(err.error ?? "Failed to start transaction");
    }
  };

  const handleEnd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTx) return;
    setEndSubmitting(true);
    await fetch("/api/kpi/transactions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeTx._id, endTime, status: endStatus, notes: endNotes.trim() || undefined }),
    });
    setEndSubmitting(false);
    setEndSuccess(`Done — TAT: ${formatTat(calcTat(activeTx.startTime, endTime))}`);
    setActiveTx(null); fetchTx();
    setTimeout(() => setEndSuccess(""), 4000);
  };

  function calcTat(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sec = (eh * 60 + em - (sh * 60 + sm)) * 60;
    return sec >= 0 ? sec : 0;
  }

  const deleteTx = async (id: string) => {
    await fetch("/api/kpi/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchTx();
  };

  const addAgent = async () => {
    if (!newAgent.trim()) return;
    const res = await fetch("/api/kpi/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAgent.trim(), group: newAgentGroup.trim() || undefined }) });
    if (res.ok) { const d = await res.json(); setAgents(prev => [...prev, d.agent]); setNewAgent(""); setNewAgentGroup(""); }
  };

  const updateAgentGroup = async (id: string, group: string) => {
    const res = await fetch("/api/kpi/agents", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, group: group || undefined }) });
    if (res.ok) { const d = await res.json(); setAgents(prev => prev.map(a => a._id === id ? { ...a, group: d.agent.group } : a)); }
  };

  const addDocType = async () => {
    if (!newDocType.trim()) return;
    const res = await fetch("/api/kpi/doc-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDocType.trim() }) });
    if (res.ok) { const d = await res.json(); setDocTypes(prev => [...prev, d.docType]); if (!docType) setDocType(d.docType.name); setNewDocType(""); }
  };

  const deleteAgent = async (id: string) => {
    await fetch("/api/kpi/agents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAgents(prev => prev.filter(a => a._id !== id));
    if (selectedAgent?._id === id) setSelectedAgent(agents.find(a => a._id !== id) ?? null);
  };

  const deleteDocType = async (id: string) => {
    await fetch("/api/kpi/doc-types", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDocTypes(prev => prev.filter(d => d._id !== id));
  };

  const canExport = !!selectedAgent && transactions.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 overflow-hidden">

      {/* ── Left sidebar: agent list ── */}
      <div className="w-[220px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Agents ({agents.length})</span>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="Manage agents & doc types"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {agents.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No agents yet.<br />Click + to add one.</p>
          )}
          {agents.map(agent => (
            <button
              key={agent._id}
              onClick={() => setSelectedAgent(agent)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                selectedAgent?._id === agent._id
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                selectedAgent?._id === agent._id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="truncate font-medium block" style={{ fontFamily: "Calibri, sans-serif" }}>
  {agent.name}
</span>

                {agent.group && <span className="text-[10px] text-slate-400" style={{ fontFamily: "Calibri, sans-serif" }}>{agent.group}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Doc types section */}
        <div className="border-t border-slate-200 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Doc Types ({docTypes.length})</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {docTypes.map(dt => (
              <span key={dt._id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">{dt.name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            {selectedAgent ? (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {selectedAgent.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-semibold text-slate-900">{selectedAgent.name}</h1>
                    {selectedAgent.group && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-500 text-[11px] font-semibold">
                        {selectedAgent.group}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{formattedDate}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Select an agent to start logging</p>
            )}
          </div>

          {/* Date picker + export buttons */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={() => setDate(today())}
              className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-100 transition-colors"
            >
              Today
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <button
              onClick={handleExcelExport}
              disabled={!canExport || exporting === "excel"}
              title={canExport ? "Export to Excel" : "No transactions to export"}
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
              title={canExport ? "Export to PDF" : "No transactions to export"}
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

        {/* Stats row */}
        {selectedAgent && (
          <div className="px-6 py-3 grid grid-cols-5 gap-3 border-b border-slate-200 bg-white flex-shrink-0">
            {[
              { label: "Total TX",   value: stats.total,             color: "text-slate-700"   },
              { label: "Completion", value: stats.completion,        color: "text-green-600"   },
              { label: "Pending",    value: stats.pending,           color: "text-amber-600"   },
              { label: "Escalation", value: stats.escalation,        color: "text-purple-600"  },
              { label: "Avg TAT",    value: formatTat(stats.avgTat), color: "text-indigo-600"  },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left panel: Log form OR End transaction ── */}
          {selectedAgent && (
            <div className="w-[280px] flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
              <div className="p-4">

                {/* END TRANSACTION panel */}
                {activeTx ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">■ End Transaction</p>

                    <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Active</p>
                      <p className="text-sm font-semibold text-indigo-600">{activeTx.companyName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{activeTx.docType} · started {activeTx.startTime}</p>
                    </div>

                    <form onSubmit={handleEnd} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">End Time</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">Status</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setEndStatus(s)}
                                className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                  endStatus === s ? `${cfg.color} ${cfg.bg}` : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                        <textarea value={endNotes} onChange={e => setEndNotes(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
                      </div>

                      <button
                        type="submit"
                        disabled={endSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <Square size={13} />
                        {endSubmitting ? "Saving…" : "End Transaction"}
                      </button>
                    </form>

                    {endSuccess && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-600 text-xs font-medium">
                        <CheckCircle2 size={13} />{endSuccess}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">▶ Log Transaction</p>
                    <form onSubmit={handleStart} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Type of Doc</label>
                        <select value={docType} onChange={e => setDocType(e.target.value)} className={selectCls}>
                          <option value="">Select type…</option>
                          {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Company Name</label>
                        <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Client / company" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">No. of Employees / Volume</label>
                        <input type="number" min="1" value={volume} onChange={e => setVolume(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
                      </div>

                      {formError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-red-100 flex items-center justify-center text-red-500 flex-shrink-0">!</span>
                          {formError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
                      >
                        <Play size={14} />
                        {submitting ? "Starting…" : "Start Transaction"}
                      </button>
                    </form>

                    {startSuccess && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-medium">
                        <Play size={12} />{startSuccess}
                      </div>
                    )}
                    {endSuccess && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-600 text-xs font-medium">
                        <CheckCircle2 size={13} />{endSuccess}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Transactions table ── */}
          <div className="flex-1 overflow-auto bg-white">
            {!selectedAgent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users size={32} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Select an agent from the left panel</p>
                  <p className="text-slate-400 text-xs mt-1">or add a new agent with the + button</p>
                </div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Tag size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No completed transactions for this date</p>
                  <p className="text-slate-400 text-xs mt-1">Start and end a transaction to see it here</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Log — {formattedDate}
                  </p>
                  <span className="text-[11px] text-slate-400">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</span>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["#", "Type of Doc", "Company", "Vol", "Start", "End", "TAT", "Status", "Notes", ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr key={tx._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-600">{tx.docType}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{tx.companyName}</td>
                        <td className="px-4 py-3 text-slate-600">{tx.volume}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{tx.startTime}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{tx.endTime}</td>
                        <td className="px-4 py-3 font-mono text-indigo-500 font-semibold text-xs">{formatTat(tx.tat)}</td>
                        <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[100px] truncate">{tx.notes ?? "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteTx(tx._id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-[520px] max-h-[80vh] overflow-y-auto shadow-xl shadow-slate-200/60" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 mb-5">Manage Setup</h2>

            {/* Agents */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={13} className="text-indigo-500" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Agents</p>
              </div>
              <div className="flex gap-2 mb-3">
                <input value={newAgent} onChange={e => setNewAgent(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Agent name…" className={inputCls} />
                <input value={newAgentGroup} onChange={e => setNewAgentGroup(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Group (e.g. G1)…" className="w-32 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                <button onClick={addAgent} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
              </div>
              <div className="space-y-1.5">
                {agents.map(a => (
                  <div key={a._id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-sm text-slate-700 truncate">{a.name}</span>
                      {a.group && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-500 text-[10px] font-semibold flex-shrink-0">
                          {a.group}
                        </span>
                      )}
                    </div>
                    <input
                      value={a.group ?? ""}
                      onChange={e => setAgents(prev => prev.map(ag => ag._id === a._id ? { ...ag, group: e.target.value } : ag))}
                      onBlur={e => updateAgentGroup(a._id, e.target.value.trim())}
                      onKeyDown={e => { if (e.key === "Enter") { updateAgentGroup(a._id, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).blur(); } }}
                      placeholder="No group"
                      className="w-24 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 flex-shrink-0"
                    />
                    <button onClick={() => deleteAgent(a._id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Type a group name next to each agent and press Enter or click away to save.</p>
            </div>

            {/* Doc Types */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={13} className="text-indigo-500" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Doc Types</p>
              </div>
              <div className="flex gap-2 mb-3">
                <input value={newDocType} onChange={e => setNewDocType(e.target.value)} onKeyDown={e => e.key === "Enter" && addDocType()} placeholder="Doc type name…" className={inputCls} />
                <button onClick={addDocType} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
              </div>
              <div className="space-y-1.5">
                {docTypes.map(dt => (
                  <div key={dt._id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-700">{dt.name}</span>
                    <button onClick={() => deleteDocType(dt._id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setShowSettings(false)} className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}