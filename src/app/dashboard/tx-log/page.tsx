"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Square, Plus, Trash2, Pencil, CheckCircle2,
  Clock, AlertTriangle, Users, Tag, FileText, FileSpreadsheet,
  Pause, RotateCcw,
} from "lucide-react";

/* ─── Types ─── */
interface Agent { _id: string; name: string; group?: string }
interface DocType { _id: string; name: string; taskCategory: TaskCategory }

type TaskCategory = "Production" | "Non-Production";

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
  elapsedSeconds?: number;
  pausedAt?: number | null;
  taskCategory?: TaskCategory;
}

/* ─── Break / Session Types ─── */
type BreakType = "BIO" | "BREAK";

interface BreakEntry {
  _id: string;
  type: BreakType;
  startEpoch: number;
  endEpoch?: number;
  durationSeconds?: number;
}

interface AgentSessionData {
  _id: string;
  sessionStartEpoch: number;
  sessionEndEpoch?: number;
  breaks: BreakEntry[];
  totalBreakSeconds: number;
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

/* ─── Task Category Badge ─── */
function CategoryBadge({ category }: { category?: TaskCategory }) {
  const isProduction = !category || category === "Production";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
      isProduction
        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
        : "bg-slate-100 border-slate-300 text-slate-500"
    }`}>
      {isProduction ? "⚙" : "✉"} {isProduction ? "Production" : "Non-Prod"}
    </span>
  );
}

function PausedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold text-amber-600 bg-amber-50 border-amber-200 animate-pulse">
      <Pause size={10} />
      Paused
    </span>
  );
}

function RunningBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold text-indigo-600 bg-indigo-50 border-indigo-200">
      <Play size={10} />
      Running
    </span>
  );
}

interface ActiveTx {
  _id: string;
  docType: string;
  companyName: string;
  volume?: number;
  resumedAt: number;
  elapsedSeconds: number;
  paused: boolean;
  taskCategory: TaskCategory;
}

/* ─── Live timer display ─── */
function LiveTimer({ activeTx }: { activeTx: ActiveTx }) {
  const [display, setDisplay] = useState("00:00:00");

  useEffect(() => {
    const tick = () => {
      let total = activeTx.elapsedSeconds;
      if (!activeTx.paused) {
        total += Math.floor((Date.now() - activeTx.resumedAt) / 1000);
      }
      setDisplay(formatTat(total));
    };
    tick();
    if (activeTx.paused) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTx]);

  return (
    <span className={`font-mono text-2xl font-bold tracking-wider ${activeTx.paused ? "text-amber-500" : "text-indigo-600"}`}>
      {display}
    </span>
  );
}

function InlineTimer({ elapsedSeconds, resumedAt }: { elapsedSeconds: number; resumedAt: number }) {
  const [display, setDisplay] = useState("00:00:00");
  useEffect(() => {
    const tick = () => {
      const total = elapsedSeconds + Math.floor((Date.now() - resumedAt) / 1000);
      setDisplay(formatTat(total));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [elapsedSeconds, resumedAt]);
  return <span className="font-mono text-indigo-500 font-semibold text-xs">{display}</span>;
}

function FrozenTimer({ elapsedSeconds }: { elapsedSeconds: number }) {
  return <span className="font-mono text-amber-500 font-semibold text-xs">{formatTat(elapsedSeconds)}</span>;
}

/* ─── Live Session / Break ticker ─── */
function useTick(intervalMs = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
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
  transactions: Transaction[],
  agentName: string,
  date: string,
  stats: { total: number; completion: number; pending: number; escalation: number; avgTat: number; totalProductiveSeconds: number; production: number; nonProduction: number }
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const rows = transactions.map((tx, i) => ({
    "#": i + 1,
    "Type of Task": tx.docType,
    "Company": tx.companyName,
    "Volume": tx.volume,
    "TAT": formatTat(tx.tat),
    "Category": tx.taskCategory ?? "Production",
    "Status": tx.status,
    "Notes": tx.notes ?? "",
  }));
  const summary = [
    ["Agent", agentName], ["Date", date],
    ["Total TX", stats.total], ["Completion", stats.completion],
    ["Pending", stats.pending], ["Escalation", stats.escalation],
    ["Avg TAT", formatTat(stats.avgTat)],
    ["Productivity Hours", formatTat(stats.totalProductiveSeconds)],
    ["Production TX", stats.production],
    ["Non-Production TX", stats.nonProduction],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  ws2["!cols"] = [{ wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  XLSX.writeFile(wb, `tx-log_${agentName}_${date}.xlsx`);
}

async function exportToPdf(
  transactions: Transaction[],
  agentName: string,
  date: string,
  formattedDate: string,
  stats: { total: number; completion: number; pending: number; escalation: number; avgTat: number; totalProductiveSeconds: number; production: number; nonProduction: number }
) {
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
  const statItems = [
    { label: "Total TX",           value: String(stats.total) },
    { label: "Completion",         value: String(stats.completion) },
    { label: "Pending",            value: String(stats.pending) },
    { label: "Escalation",         value: String(stats.escalation) },
    { label: "Avg TAT",            value: formatTat(stats.avgTat) },
    { label: "Productivity Hours", value: formatTat(stats.totalProductiveSeconds) },
    { label: "Production",         value: String(stats.production) },
    { label: "Non-Production",     value: String(stats.nonProduction) },
  ];
  statItems.forEach((s, i) => {
    const x = 10 + i * 34;
    doc.setFillColor(40, 40, 60); doc.roundedRect(x, 26, 30, 14, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 15, 33, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 160);
    doc.text(s.label.toUpperCase(), x + 15, 38, { align: "center" });
  });
  const tableBody = transactions.map((tx, i) => [
    i + 1, tx.docType, tx.companyName, tx.volume,
    formatTat(tx.tat), tx.taskCategory ?? "Production", tx.status, tx.notes ?? "—",
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 44,
    head: [["#", "Type of Task", "Company", "Vol", "TAT", "Category", "Status", "Notes"]],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [200, 200, 210], fillColor: [25, 25, 40], lineColor: [50, 50, 70], lineWidth: 0.2 },
    headStyles: { fillColor: [40, 40, 65], textColor: [150, 150, 200], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 30 },
      2: { cellWidth: 40 }, 3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 20, halign: "center", textColor: [120, 160, 255], fontStyle: "bold" },
      5: { cellWidth: 26, halign: "center" },
      6: { cellWidth: 24, halign: "center" }, 7: { cellWidth: "auto" },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell: (data: any) => {
      if (data.column.index === 6 && data.section === "body") {
        const val = data.cell.raw as string;
        const colours: Record<string, [number, number, number]> = {
          COMPLETION: [52, 211, 153], PENDING: [251, 191, 36], ESCALATION: [167, 139, 250],
        };
        if (colours[val]) {
          doc.setTextColor(...colours[val]);
          doc.setFontSize(8); doc.setFont("helvetica", "bold");
          doc.text(val, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
        }
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
const inputCls  = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const selectCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";

/* ═══════════════════════════════════════════════════════
   ─── Break Tracker Panel (self-contained sub-component)
   ═══════════════════════════════════════════════════════ */
function BreakTrackerPanel({
  selectedAgent,
  date,
}: {
  selectedAgent: Agent;
  date: string;
}) {
  const tick = useTick(1000);

  const [agentSession, setAgentSession]       = useState<AgentSessionData | null>(null);
  const [activeBreak, setActiveBreak]         = useState<BreakEntry | null>(null);
  const [breakSubmitting, setBreakSubmitting] = useState<BreakType | "END" | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/kpi/session?agentId=${selectedAgent._id}&date=${date}`);
    const d   = await res.json();
    setAgentSession(d.session ?? null);
    const ongoing = (d.session?.breaks ?? []).find((b: BreakEntry) => !b.endEpoch);
    setActiveBreak(ongoing ?? null);
  }, [selectedAgent._id, date]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const handleStartSession = async () => {
    if (sessionStarting) return;
    setSessionStarting(true);
    const res = await fetch("/api/kpi/session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ agentId: selectedAgent._id, agentName: selectedAgent.name, date }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    setSessionStarting(false);
  };

  const handleStartBreak = async (type: BreakType) => {
    if (activeBreak || breakSubmitting) return;
    setBreakSubmitting(type);

    let sess = agentSession;
    if (!sess) {
      const r  = await fetch("/api/kpi/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agentId: selectedAgent._id, agentName: selectedAgent.name, date }),
      });
      const rd = await r.json();
      sess     = rd.session;
      setAgentSession(rd.session);
    }

    const res = await fetch("/api/kpi/session", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ agentId: selectedAgent._id, date, action: "START_BREAK", breakType: type }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    const ongoing = (d.session?.breaks ?? []).find((b: BreakEntry) => !b.endEpoch);
    setActiveBreak(ongoing ?? null);
    setBreakSubmitting(null);
  };

  const handleEndBreak = async () => {
    if (!activeBreak || breakSubmitting) return;
    setBreakSubmitting("END");
    const res = await fetch("/api/kpi/session", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ agentId: selectedAgent._id, date, action: "END_BREAK", breakId: activeBreak._id }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    setActiveBreak(null);
    setBreakSubmitting(null);
  };

  const liveSessionSeconds = agentSession
    ? agentSession.sessionEndEpoch
      ? Math.floor((agentSession.sessionEndEpoch - agentSession.sessionStartEpoch) / 1000)
      : Math.floor((Date.now() - agentSession.sessionStartEpoch) / 1000)
    : 0;

  const liveBreakSeconds   = activeBreak ? Math.floor((Date.now() - activeBreak.startEpoch) / 1000) : 0;
  const totalBreakSoFar    = (agentSession?.totalBreakSeconds ?? 0) + liveBreakSeconds;
  const netProductiveSeconds = Math.max(0, liveSessionSeconds - totalBreakSoFar);

  return (
    <div className="border-b border-slate-100 bg-white">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {agentSession && !agentSession.sessionEndEpoch && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Session Tracker</p>
        </div>

        {!agentSession && (
          <button
            onClick={handleStartSession}
            disabled={sessionStarting}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            {sessionStarting ? "Starting…" : "Start Session"}
          </button>
        )}
        {agentSession && (
          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(agentSession.sessionStartEpoch).toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true,
            })}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {agentSession ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Session",  value: formatTat(liveSessionSeconds),   color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-200"  },
                { label: "On Break", value: formatTat(totalBreakSoFar),      color: activeBreak ? "text-amber-600" : "text-slate-500", bg: activeBreak ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200" },
                { label: "Net Work", value: formatTat(netProductiveSeconds), color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border px-2 py-2 text-center ${s.bg}`}>
                  <p className={`text-[13px] font-bold font-mono leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {activeBreak && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">
                    {activeBreak.type === "BIO" ? "🚻" : "☕"}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700">
                      {activeBreak.type === "BIO" ? "Bio Break" : "Break"} in progress
                    </p>
                    <p className="text-[11px] text-amber-500 font-mono font-semibold">{formatTat(liveBreakSeconds)}</p>
                  </div>
                </div>
                <button
                  onClick={handleEndBreak}
                  disabled={breakSubmitting === "END"}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                >
                  <Play size={10} />
                  {breakSubmitting === "END" ? "Saving…" : "Return"}
                </button>
              </div>
            )}

            {!activeBreak && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStartBreak("BIO")}
                  disabled={!!breakSubmitting}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors disabled:opacity-40"
                >
                  <span className="text-sm">🚻</span>
                  {breakSubmitting === "BIO" ? "Starting…" : "Bio Break"}
                </button>
                <button
                  onClick={() => handleStartBreak("BREAK")}
                  disabled={!!breakSubmitting}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors disabled:opacity-40"
                >
                  <span className="text-sm">☕</span>
                  {breakSubmitting === "BREAK" ? "Starting…" : "Break"}
                </button>
              </div>
            )}

            {agentSession.breaks.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-300 font-bold mb-1.5">
                  Break Log ({agentSession.breaks.length})
                </p>
                <div className="space-y-1 max-h-[108px] overflow-y-auto pr-0.5">
                  {agentSession.breaks.map((b, i) => (
                    <div
                      key={b._id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] ${
                        !b.endEpoch ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{b.type === "BIO" ? "🚻" : "☕"}</span>
                        <span className="text-slate-500">{b.type === "BIO" ? "Bio" : "Break"} #{i + 1}</span>
                        {!b.endEpoch && (
                          <span className="px-1 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold animate-pulse">LIVE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {b.endEpoch && (
                          <span className="text-slate-400 font-mono text-[10px]">
                            {new Date(b.startEpoch).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false })}
                            {" → "}
                            {new Date(b.endEpoch).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                        )}
                        <span className={`font-mono font-semibold ${b.endEpoch ? "text-slate-500" : "text-amber-500"}`}>
                          {b.endEpoch ? formatTat(b.durationSeconds) : formatTat(liveBreakSeconds)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Total Break Time</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600">{formatTat(totalBreakSoFar)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-3 py-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 font-medium">No active session for today.</p>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Click <span className="font-semibold">Start Session</span> to begin tracking breaks &amp; time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function TxLogPage() {
  const [agents, setAgents]         = useState<Agent[]>([]);
  const [docTypes, setDocTypes]     = useState<DocType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [inProgressTxs, setInProgressTxs] = useState<Record<string, ActiveTx>>({});
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterStatus, setFilterStatus]   = useState<Transaction["status"] | "ALL">("ALL");
  const [filterDocType, setFilterDocType] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "ALL">("ALL");
  const [date, setDate] = useState(today());

  /* ── Start-form state ── */
  const [docType, setDocType]           = useState("");
  const [companyName, setCompanyName]   = useState("");
  const [volume, setVolume]             = useState("1");
  const [notes, setNotes]               = useState("");
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("Production");
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState("");
  const [startSuccess, setStartSuccess] = useState("");

  /* ── Active / end state ── */
  const [activeTx, setActiveTx]             = useState<ActiveTx | null>(null);
  const [endStatus, setEndStatus]           = useState<Transaction["status"]>("COMPLETION");
  const [endNotes, setEndNotes]             = useState("");
  const [endDocType, setEndDocType]         = useState("");
  const [endCompanyName, setEndCompanyName] = useState("");
  const [endVolume, setEndVolume]           = useState("1");
  const [endTaskCategory, setEndTaskCategory] = useState<TaskCategory>("Production");
  const [endSubmitting, setEndSubmitting]   = useState(false);
  const [endSuccess, setEndSuccess]         = useState("");
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  /* ── Edit state ── */
  const [editingTx, setEditingTx]             = useState<Transaction | null>(null);
  const [editDocType, setEditDocType]         = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editVolume, setEditVolume]           = useState("1");
  const [editStatus, setEditStatus]           = useState<Transaction["status"]>("PENDING");
  const [editNotes, setEditNotes]             = useState("");
  const [editTaskCategory, setEditTaskCategory] = useState<TaskCategory>("Production");
  const [editSubmitting, setEditSubmitting]   = useState(false);
  const [deletingId, setDeletingId]           = useState<string | null>(null);

  /* ── Settings state ── */
  const [showSettings, setShowSettings]       = useState(false);
  const [newAgent, setNewAgent]               = useState("");
  const [newAgentGroup, setNewAgentGroup]     = useState("");
  const [newDocType, setNewDocType]           = useState("");
  const [newDocTypeCategory, setNewDocTypeCategory] = useState<TaskCategory>("Production");
  const [exporting, setExporting]             = useState<"pdf" | "excel" | null>(null);

  /* ── Bootstrap ── */
  useEffect(() => {
    fetch("/api/kpi/agents").then(r => r.json()).then(d => {
      setAgents(d.agents ?? []);
      if (d.agents?.length > 0 && !selectedAgent) setSelectedAgent(d.agents[0]);
    });
    fetch("/api/kpi/doc-types").then(r => r.json()).then(d => {
      const dts: DocType[] = d.docTypes ?? [];
      setDocTypes(dts);
      if (dts.length > 0) {
        setDocType(dts[0].name);
        setTaskCategory(dts[0].taskCategory ?? "Production");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTx = useCallback(async () => {
    if (!selectedAgent) return;
    const res = await fetch(`/api/kpi/transactions?date=${date}&agentId=${selectedAgent._id}`);
    const d   = await res.json();
    const VALID = new Set(["PENDING", "COMPLETION", "ESCALATION"]);

    const completed = (d.transactions ?? [])
      .filter((t: Transaction) => t.endTime)
      .map((t: Transaction) => ({ ...t, status: VALID.has(t.status) ? t.status : "PENDING" }));
    setTransactions(completed);

    const paused  = (d.transactions ?? []).filter((t: Transaction) => !t.endTime && t.pausedAt != null);
    const rebuilt: Record<string, ActiveTx> = {};
    for (const t of paused) {
      rebuilt[t._id] = {
        _id:            t._id,
        docType:        t.docType,
        companyName:    t.companyName,
        volume:         t.volume,
        resumedAt:      Date.now(),
        elapsedSeconds: t.elapsedSeconds ?? 0,
        paused:         true,
        taskCategory:   t.taskCategory ?? "Production",
      };
    }
    setInProgressTxs(rebuilt);
  }, [selectedAgent, date]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  /* ─── Doc type select handlers (auto-inherit category) ─── */
  const handleDocTypeChange = (name: string) => {
    setDocType(name);
    const found = docTypes.find(dt => dt.name === name);
    if (found) setTaskCategory(found.taskCategory ?? "Production");
  };

  const handleEndDocTypeChange = (name: string) => {
    setEndDocType(name);
    const found = docTypes.find(dt => dt.name === name);
    if (found) setEndTaskCategory(found.taskCategory ?? "Production");
  };

  const handleEditDocTypeChange = (name: string) => {
    setEditDocType(name);
    const found = docTypes.find(dt => dt.name === name);
    if (found) setEditTaskCategory(found.taskCategory ?? "Production");
  };

  /* ─── Stats ─── */
  const stats = {
    total:      transactions.length,
    completion: transactions.filter(t => t.status === "COMPLETION").length,
    pending:    transactions.filter(t => t.status === "PENDING").length,
    escalation: transactions.filter(t => t.status === "ESCALATION").length,
    avgTat: (() => {
      const withTat = transactions.filter(t => t.tat);
      return withTat.length ? Math.round(withTat.reduce((a, t) => a + (t.tat ?? 0), 0) / withTat.length) : 0;
    })(),
    totalProductiveSeconds: transactions.filter(t => t.tat).reduce((a, t) => a + (t.tat ?? 0), 0),
    production:    transactions.filter(t => !t.taskCategory || t.taskCategory === "Production").length,
    nonProduction: transactions.filter(t => t.taskCategory === "Non-Production").length,
  };

  const filteredTransactions = transactions.filter(tx => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.companyName.toLowerCase().includes(q) ||
      tx.docType.toLowerCase().includes(q) ||
      String(tx.volume).includes(q) ||
      (tx.notes ?? "").toLowerCase().includes(q);
    const matchesStatus   = filterStatus   === "ALL" || tx.status   === filterStatus;
    const matchesDocType  = filterDocType  === "ALL" || tx.docType  === filterDocType;
    const matchesCategory = filterCategory === "ALL" || (tx.taskCategory ?? "Production") === filterCategory;
    return matchesSearch && matchesStatus && matchesDocType && matchesCategory;
  });

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  /* ─── Export ─── */
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

  /* ── Start ── */
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setFormError("");
    if (!docType)             { setFormError("Select a doc type"); return; }
    if (!companyName.trim())  { setFormError("Company name is required"); return; }
    setSubmitting(true);

    const res = await fetch("/api/kpi/transactions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId:        selectedAgent._id,
        agentName:      selectedAgent.name,
        docType,
        companyName:    companyName.trim(),
        volume:         Number(volume),
        date,
        status:         "PENDING",
        notes:          notes.trim() || undefined,
        startEpoch:     Date.now(),
        elapsedSeconds: 0,
        taskCategory,                     // inherited from selected doc type
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      const data = await res.json();
      setActiveTx({
        _id:            data.transaction._id,
        docType,
        companyName:    companyName.trim(),
        volume:         Number(volume),
        resumedAt:      Date.now(),
        elapsedSeconds: 0,
        paused:         false,
        taskCategory,
      });
      setEndDocType(docType);
      setEndCompanyName(companyName.trim());
      setEndVolume(volume);
      setEndTaskCategory(taskCategory);
      setEndStatus("COMPLETION");
      setEndNotes("");
      setStartSuccess("Transaction started");
      setCompanyName(""); setNotes(""); setVolume("1");
      // reset to first doc type
      if (docTypes.length > 0) {
        setDocType(docTypes[0].name);
        setTaskCategory(docTypes[0].taskCategory ?? "Production");
      }
      setTimeout(() => setStartSuccess(""), 3000);
    } else {
      const err = await res.json();
      setFormError(err.error ?? "Failed to start transaction");
    }
  };

  /* ── Pause ── */
  const handlePause = async () => {
    if (!activeTx || pauseSubmitting) return;
    setPauseSubmitting(true);

    const newElapsed = activeTx.elapsedSeconds + Math.floor((Date.now() - activeTx.resumedAt) / 1000);
    await fetch("/api/kpi/transactions", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: activeTx._id, elapsedSeconds: newElapsed, pausedAt: Date.now() }),
    });

    const pausedTx: ActiveTx = { ...activeTx, elapsedSeconds: newElapsed, paused: true, volume: Number(endVolume) };
    setInProgressTxs(prev => ({ ...prev, [activeTx._id]: pausedTx }));
    setActiveTx(null);
    setPauseSubmitting(false);
  };

  /* ── Resume from table ── */
  const handleResumeFromTable = async (txId: string) => {
    const paused = inProgressTxs[txId];
    if (!paused) return;

    if (activeTx && !activeTx.paused) {
      const newElapsed = activeTx.elapsedSeconds + Math.floor((Date.now() - activeTx.resumedAt) / 1000);
      await fetch("/api/kpi/transactions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: activeTx._id, elapsedSeconds: newElapsed, pausedAt: Date.now() }),
      });
      const nowPaused: ActiveTx = { ...activeTx, elapsedSeconds: newElapsed, paused: true };
      setInProgressTxs(prev => ({ ...prev, [activeTx._id]: nowPaused }));
    }

    await fetch("/api/kpi/transactions", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: txId, pausedAt: null }),
    });

    const resumed: ActiveTx = { ...paused, resumedAt: Date.now(), paused: false };
    setActiveTx(resumed);
    setEndDocType(paused.docType);
    setEndCompanyName(paused.companyName);
    setEndVolume(String(paused.volume || "1"));
    setEndTaskCategory(paused.taskCategory ?? "Production");

    setInProgressTxs(prev => {
      const next = { ...prev };
      delete next[txId];
      return next;
    });
  };

  /* ── End ── */
  const handleEnd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTx) return;
    setEndSubmitting(true);

    const finalElapsed = activeTx.paused
      ? activeTx.elapsedSeconds
      : activeTx.elapsedSeconds + Math.floor((Date.now() - activeTx.resumedAt) / 1000);

    await fetch("/api/kpi/transactions", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:             activeTx._id,
        elapsedSeconds: finalElapsed,
        tat:            finalElapsed,
        endEpoch:       Date.now(),
        status:         endStatus,
        notes:          endNotes.trim() || undefined,
        docType:        endDocType || undefined,
        companyName:    endCompanyName.trim() || undefined,
        volume:         Number(endVolume),
        taskCategory:   endTaskCategory,
        endTime:        new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }),
      }),
    });

    setEndSubmitting(false);
    setEndSuccess(`Done — TAT: ${formatTat(finalElapsed)}`);
    setActiveTx(null);
    fetchTx();
    setTimeout(() => setEndSuccess(""), 4000);
  };

  /* ── Edit ── */
  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDocType(tx.docType);
    setEditCompanyName(tx.companyName);
    setEditVolume(String(tx.volume));
    setEditStatus(tx.status);
    setEditNotes(tx.notes ?? "");
    setEditTaskCategory(tx.taskCategory ?? "Production");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setEditSubmitting(true);
    await fetch("/api/kpi/transactions", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:           editingTx._id,
        docType:      editDocType,
        companyName:  editCompanyName.trim(),
        volume:       Number(editVolume),
        status:       editStatus,
        notes:        editNotes.trim() || undefined,
        taskCategory: editTaskCategory,
      }),
    });
    setEditSubmitting(false);
    setEditingTx(null);
    fetchTx();
  };

  const deleteTx = async () => {
    if (!deletingId) return;
    setInProgressTxs(prev => { const next = { ...prev }; delete next[deletingId]; return next; });
    if (activeTx?._id === deletingId) setActiveTx(null);
    await fetch("/api/kpi/transactions", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: deletingId }),
    });
    setDeletingId(null);
    fetchTx();
  };

  /* ── Settings helpers ── */
  const addAgent = async () => {
    if (!newAgent.trim()) return;
    const res = await fetch("/api/kpi/agents", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: newAgent.trim(), group: newAgentGroup.trim() || undefined }),
    });
    if (res.ok) {
      const d = await res.json();
      setAgents(prev => [...prev, d.agent]);
      setNewAgent(""); setNewAgentGroup("");
    }
  };

  const updateAgentGroup = async (id: string, group: string) => {
    const res = await fetch("/api/kpi/agents", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, group: group || undefined }),
    });
    if (res.ok) {
      const d = await res.json();
      setAgents(prev => prev.map(a => a._id === id ? { ...a, group: d.agent.group } : a));
    }
  };

  const addDocType = async () => {
    if (!newDocType.trim()) return;
    const res = await fetch("/api/kpi/doc-types", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: newDocType.trim(), taskCategory: newDocTypeCategory }),
    });
    if (res.ok) {
      const d = await res.json();
      setDocTypes(prev => [...prev, d.docType]);
      if (!docType) {
        setDocType(d.docType.name);
        setTaskCategory(d.docType.taskCategory ?? "Production");
      }
      setNewDocType("");
      setNewDocTypeCategory("Production");
    }
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

  const canExport       = !!selectedAgent && transactions.length > 0;
  const inProgressList  = Object.values(inProgressTxs);
  const inProgressCount = inProgressList.length + (activeTx ? 1 : 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 overflow-hidden">

      {/* ── Left sidebar: agent list ── */}
      <div className="w-[220px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Agents ({agents.length})</span>
          <button onClick={() => setShowSettings(s => !s)} className="text-slate-400 hover:text-slate-700 transition-colors" title="Manage agents & task types">
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
                <span className="truncate font-medium block" style={{ fontFamily: "Calibri, sans-serif" }}>{agent.name}</span>
                {agent.group && <span className="text-[10px] text-slate-400" style={{ fontFamily: "Calibri, sans-serif" }}>{agent.group}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Task types list — now shows category badge */}
        <div className="border-t border-slate-200 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Task Types ({docTypes.length})</span>
          <div className="mt-1.5 space-y-1">
            {docTypes.map(dt => (
              <div key={dt._id} className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">{dt.name}</span>
                <CategoryBadge category={dt.taskCategory ?? "Production"} />
              </div>
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

          <div className="flex items-center gap-2">
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button onClick={() => setDate(today())} className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-100 transition-colors">
              Today
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <button
              onClick={handleExcelExport} disabled={!canExport || exporting === "excel"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}
            >
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button
              onClick={handlePdfExport} disabled={!canExport || exporting === "pdf"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                canExport ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
              }`}
            >
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        {selectedAgent && (
          <div className="px-6 py-3 grid grid-cols-8 gap-2 border-b border-slate-200 bg-white flex-shrink-0">
            {[
              { label: "Total TX",         value: stats.total,                             color: "text-indigo-600",  bg: "bg-indigo-50  border-indigo-200"  },
              { label: "Completion",       value: stats.completion,                        color: "text-green-600",   bg: "bg-green-50   border-green-200"   },
              { label: "Pending",          value: stats.pending,                           color: "text-amber-600",   bg: "bg-amber-50   border-amber-200"   },
              { label: "Escalation",       value: stats.escalation,                        color: "text-purple-600",  bg: "bg-purple-50  border-purple-200"  },
              { label: "Avg TAT",          value: formatTat(stats.avgTat),                 color: "text-indigo-600",  bg: "bg-indigo-50  border-indigo-200"  },
              { label: "Productivity Hrs", value: formatTat(stats.totalProductiveSeconds), color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Production",       value: stats.production,                        color: "text-indigo-600",  bg: "bg-indigo-50  border-indigo-200"  },
              { label: "Non-Production",   value: stats.nonProduction,                     color: "text-slate-600",   bg: "bg-slate-100  border-slate-300"   },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border rounded-xl px-2 py-2.5 text-center`}>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left panel: Break Tracker + Log / End form ── */}
          {selectedAgent && (
            <div className="w-[300px] flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">

              {/* ════ BREAK TRACKER ════ */}
              <BreakTrackerPanel selectedAgent={selectedAgent} date={date} />

              {/* ════ TX LOG / END FORM ════ */}
              <div className="p-4">
                {activeTx ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">■ End Transaction</p>

                    <div className={`mb-4 rounded-xl border px-4 py-3 ${activeTx.paused ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {activeTx.paused ? "⏸ Paused" : "⏱ Running"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <CategoryBadge category={activeTx.taskCategory} />
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeTx.paused ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-500"}`}>
                            {activeTx.paused ? "PAUSED" : "LIVE"}
                          </span>
                        </div>
                      </div>
                      <LiveTimer activeTx={activeTx} />
                      <p className="text-xs text-slate-500 mt-1.5 font-medium truncate">{activeTx.companyName}</p>
                      <p className="text-[11px] text-slate-400">{activeTx.docType}</p>
                    </div>

                    <button
                      onClick={handlePause}
                      disabled={pauseSubmitting}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold mb-3 transition-all bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    >
                      <Pause size={13} /> Pause &amp; Log Another
                    </button>

                    {/* ── End form ── */}
                    <form onSubmit={handleEnd} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Type of Task</label>
                        <select value={endDocType} onChange={e => handleEndDocTypeChange(e.target.value)} className={selectCls}>
                          <option value="">Select type…</option>
                          {docTypes.map(dt => (
                            <option key={dt._id} value={dt.name}>{dt.name}</option>
                          ))}
                        </select>
                        {/* Show inherited category as a read-only hint */}
                        {endDocType && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Category:</span>
                            <CategoryBadge category={endTaskCategory} />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Company Name</label>
                        <input value={endCompanyName} onChange={e => setEndCompanyName(e.target.value)} placeholder="Client / company" className={inputCls} />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">No. of Employees / Volume</label>
                        <input type="number" min="1" value={endVolume} onChange={e => setEndVolume(e.target.value)} className={inputCls} />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">Status</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            return (
                              <button
                                key={s} type="button" onClick={() => setEndStatus(s)}
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
                        type="submit" disabled={endSubmitting}
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

                    {inProgressList.length > 0 && (
                      <div className="mb-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
                        <Pause size={12} className="flex-shrink-0" />
                        <span>
                          {inProgressList.length} paused transaction{inProgressList.length !== 1 ? "s" : ""} in the table — click a row to resume.
                        </span>
                      </div>
                    )}

                    {/* ── Start form ── */}
                    <form onSubmit={handleStart} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Type of Tasks</label>
                        <select value={docType} onChange={e => handleDocTypeChange(e.target.value)} className={selectCls}>
                          <option value="">Select type…</option>
                          {docTypes.map(dt => (
                            <option key={dt._id} value={dt.name}>{dt.name}</option>
                          ))}
                        </select>
                        {/* Show inherited category as a read-only hint */}
                        {docType && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Category:</span>
                            <CategoryBadge category={taskCategory} />
                          </div>
                        )}
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
                        <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
                      </div>

                      {formError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">!</span>
                          {formError}
                        </p>
                      )}

                      <button
                        type="submit" disabled={submitting}
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
            ) : (transactions.length === 0 && inProgressList.length === 0 && !activeTx) ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Tag size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No completed transactions for this date</p>
                  <p className="text-slate-400 text-xs mt-1">Start and end a transaction to see it here</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="px-6 pt-4 pb-3 border-b border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Log — {formattedDate}
                    </p>
                    <div className="flex items-center gap-3">
                      {inProgressCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[11px] font-semibold">
                          <Pause size={9} />
                          {inProgressCount} in progress
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {filteredTransactions.length === transactions.length
                          ? `${transactions.length} completed`
                          : `${filteredTransactions.length} of ${transactions.length} completed`}
                      </span>
                    </div>
                  </div>

                  {/* Filter bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search company, task, notes, volume…"
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                      <option value="ALL">All statuses</option>
                      <option value="COMPLETION">Completion</option>
                      <option value="PENDING">Pending</option>
                      <option value="ESCALATION">Escalation</option>
                    </select>

                    <select value={filterDocType} onChange={e => setFilterDocType(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                      <option value="ALL">All task types</option>
                      {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                    </select>

                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as typeof filterCategory)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                      <option value="ALL">All categories</option>
                      <option value="Production">Production</option>
                      <option value="Non-Production">Non-Production</option>
                    </select>

                    {(searchQuery || filterStatus !== "ALL" || filterDocType !== "ALL" || filterCategory !== "ALL") && (
                      <button
                        onClick={() => { setSearchQuery(""); setFilterStatus("ALL"); setFilterDocType("ALL"); setFilterCategory("ALL"); }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium hover:bg-slate-200 transition-colors whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["#", "Type of Tasks", "Company", "Vol", "Elapsed / TAT", "Category", "Status", "Notes", ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTx && (
                      <tr className="border-b border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 transition-colors" title="Currently running">
                        <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                        <td className="px-4 py-3 text-slate-600">{activeTx.docType}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{activeTx.companyName}</td>
                        <td className="px-4 py-3 text-slate-400">—</td>
                        <td className="px-4 py-3">
                          <InlineTimer elapsedSeconds={activeTx.elapsedSeconds} resumedAt={activeTx.resumedAt} />
                        </td>
                        <td className="px-4 py-3"><CategoryBadge category={activeTx.taskCategory} /></td>
                        <td className="px-4 py-3"><RunningBadge /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-indigo-400 font-medium">Active in sidebar</span>
                        </td>
                      </tr>
                    )}

                    {inProgressList.map((ptx) => (
                      <tr
                        key={ptx._id}
                        onClick={() => handleResumeFromTable(ptx._id)}
                        className="border-b border-amber-100 bg-amber-50/40 hover:bg-amber-50 transition-colors cursor-pointer group"
                        title="Click to resume this transaction"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                        <td className="px-4 py-3 text-slate-600">{ptx.docType}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{ptx.companyName}</td>
                        <td className="px-4 py-3 text-slate-400">—</td>
                        <td className="px-4 py-3"><FrozenTimer elapsedSeconds={ptx.elapsedSeconds} /></td>
                        <td className="px-4 py-3"><CategoryBadge category={ptx.taskCategory} /></td>
                        <td className="px-4 py-3"><PausedBadge /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); handleResumeFromTable(ptx._id); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-500 text-[11px] font-semibold hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Play size={10} /> Resume
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeletingId(ptx._id); }}
                              className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.map((tx, i) => (
                      <tr key={tx._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-600">{tx.docType}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{tx.companyName}</td>
                        <td className="px-4 py-3 text-slate-600">{tx.volume}</td>
                        <td className="px-4 py-3 font-mono text-indigo-500 font-semibold text-xs">{formatTat(tx.tat)}</td>
                        <td className="px-4 py-3"><CategoryBadge category={tx.taskCategory} /></td>
                        <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[100px] truncate">{tx.notes ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(tx)} className="text-slate-300 hover:text-indigo-500 transition-colors" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeletingId(tx._id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.length === 0 && transactions.length > 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center">
                          <p className="text-sm text-slate-400">No transactions match your filters.</p>
                          <button
                            onClick={() => { setSearchQuery(""); setFilterStatus("ALL"); setFilterDocType("ALL"); setFilterCategory("ALL"); }}
                            className="mt-2 text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
                          >
                            Clear filters
                          </button>
                        </td>
                      </tr>
                    )}
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-[540px] max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 mb-5">Manage Setup</h2>

            {/* Agents section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={13} className="text-indigo-500" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Agents</p>
              </div>
              <div className="flex gap-2 mb-3">
                <input value={newAgent} onChange={e => setNewAgent(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Agent name…" className={inputCls} />
                <input value={newAgentGroup} onChange={e => setNewAgentGroup(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Group…" className="w-32 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400" />
                <button onClick={addAgent} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
              </div>
              <div className="space-y-1.5">
                {agents.map(a => (
                  <div key={a._id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-sm text-slate-700 truncate">{a.name}</span>
                      {a.group && <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-500 text-[10px] font-semibold">{a.group}</span>}
                    </div>
                    <input
                      value={a.group ?? ""}
                      onChange={e => setAgents(prev => prev.map(ag => ag._id === a._id ? { ...ag, group: e.target.value } : ag))}
                      onBlur={e => updateAgentGroup(a._id, e.target.value.trim())}
                      onKeyDown={e => { if (e.key === "Enter") { updateAgentGroup(a._id, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).blur(); } }}
                      placeholder="No group"
                      className="w-24 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-indigo-400"
                    />
                    <button onClick={() => deleteAgent(a._id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Types section — now with category toggle */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={13} className="text-indigo-500" />
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Task Types</p>
              </div>

              {/* Add row */}
              <div className="flex gap-2 mb-3">
                <input
                  value={newDocType}
                  onChange={e => setNewDocType(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addDocType()}
                  placeholder="Task type name…"
                  className={inputCls}
                />
                {/* Compact Production / Non-Production toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setNewDocTypeCategory("Production")}
                    className={`px-2.5 py-2 transition-colors ${
                      newDocTypeCategory === "Production"
                        ? "bg-indigo-50 text-indigo-600 border-r border-indigo-200"
                        : "text-slate-400 hover:bg-slate-50 border-r border-slate-200"
                    }`}
                    title="Production"
                  >
                    ⚙ Prod
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDocTypeCategory("Non-Production")}
                    className={`px-2.5 py-2 transition-colors ${
                      newDocTypeCategory === "Non-Production"
                        ? "bg-slate-100 text-slate-600"
                        : "text-slate-400 hover:bg-slate-50"
                    }`}
                    title="Non-Production"
                  >
                    ✉ Non
                  </button>
                </div>
                <button onClick={addDocType} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
              </div>

              {/* Doc type list — shows category badge */}
              <div className="space-y-1.5">
                {docTypes.map(dt => (
                  <div key={dt._id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{dt.name}</span>
                      <CategoryBadge category={dt.taskCategory ?? "Production"} />
                    </div>
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

      {/* ── Edit Transaction modal ── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setEditingTx(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 mb-4">Edit Transaction</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type of Task</label>
                <select value={editDocType} onChange={e => handleEditDocTypeChange(e.target.value)} className={selectCls}>
                  <option value="">Select type…</option>
                  {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                </select>
                {/* Show inherited category as a read-only hint */}
                {editDocType && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Category:</span>
                    <CategoryBadge category={editTaskCategory} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Company Name</label>
                <input value={editCompanyName} onChange={e => setEditCompanyName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">No. of Employees / Volume</label>
                <input type="number" min="1" value={editVolume} onChange={e => setEditVolume(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button key={s} type="button" onClick={() => setEditStatus(s)}
                        className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          editStatus === s ? `${cfg.color} ${cfg.bg}` : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                        }`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingTx(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {editSubmitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation modal ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-[360px] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                <Trash2 size={15} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Delete Transaction</h2>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={deleteTx} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}