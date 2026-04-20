"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, Pencil, CheckCircle2,
  Clock, AlertTriangle, Users, Tag, FileText, FileSpreadsheet,
  Pause, ChevronDown, ChevronRight, ListPlus, X, Play, Square,
  Timer, PauseCircle,
} from "lucide-react";

/* ─── Types ─── */
interface Agent { _id: string; name: string; group?: string }

type CountType = "transaction" | "volume";
interface DocType { _id: string; name: string; taskCategory: TaskCategory; countType: CountType }

type TaskCategory = "Production" | "Non-Production";

interface Subtask {
  _id: string;
  docType: string;
  number?: number;
  notes?: string;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  taskCategory: TaskCategory;
  countType?: CountType;
  createdAt: number;
}

interface Transaction {
  _id: string;
  agentName: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  endTime?: string;
  tat?: number;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  notes?: string;
  date: string;
  elapsedSeconds?: number;
  pausedAt?: number | null;
  taskCategory?: TaskCategory;
  subtasks?: Subtask[];
  productiveSeconds?: number;
  timerPaused?: boolean;
  countType?: CountType;
}

/* ─── Break / Session Types ─── */
interface BreakEntry {
  _id: string;
  type: "BIO";
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

/* ─── Standalone Timer State ─── */
interface StandaloneTimer {
  running: boolean;
  paused: boolean;
  startEpoch: number | null;
  accSeconds: number;
}

interface EndTimerConfirmation {
  productiveSeconds: number;
  bioBreakSeconds: number;
  netSeconds: number;
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
  HOLD:       { label: "Hold",       color: "text-sky-600",    bg: "bg-sky-50 border-sky-200",       icon: PauseCircle },
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

function CategoryBadge({ category }: { category?: TaskCategory }) {
  const isProduction = !category || category === "Production";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
      isProduction
        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
        : "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-slate-500 dark:text-zinc-400"
    }`}>
      {isProduction ? "⚙" : "✉"} {isProduction ? "Production" : "Non-Prod"}
    </span>
  );
}

function CountTypeBadge({ countType }: { countType?: CountType }) {
  const isVolume = countType === "volume";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
      isVolume
        ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
        : "bg-indigo-50 border border-indigo-200 text-indigo-500"
    }`}>
      {isVolume ? "VOL" : "TX"}
    </span>
  );
}

/* ─── Live tick hook ─── */
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
  stats: { total: number; completion: number; pending: number; escalation: number; hold: number; totalProductiveSeconds: number; production: number; nonProduction: number }
) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  const rows: object[] = [];

  const grouped: Record<string, number> = {};
  transactions.forEach(tx => { grouped[tx.docType] = (grouped[tx.docType] ?? 0) + 1; });

  const subtaskGrouped: Record<string, number> = {};
  transactions.forEach(tx => {
    (tx.subtasks ?? []).forEach(st => {
      subtaskGrouped[st.docType] = (subtaskGrouped[st.docType] ?? 0) + 1;
    });
  });

  transactions.forEach((tx, i) => {
    rows.push({
      "#": i + 1,
      "Type of Task": tx.docType,
      "Count of this Task": grouped[tx.docType],
      "Volume": tx.volume,
      "Category": tx.taskCategory ?? "Production",
      "Status": tx.status,
      "Notes": tx.notes ?? "",
      "Subtask Count": (tx.subtasks ?? []).length,
      "Subtask #": "",
      "Subtask Task": "",
      "Subtask Number": "",
      "Subtask Status": "",
      "Subtask Notes": "",
    });
    (tx.subtasks ?? []).forEach((st, si) => {
      rows.push({
        "#": "",
        "Type of Task": "",
        "Count of this Task": "",
        "Volume": "",
        "Category": "",
        "Status": "",
        "Notes": "",
        "Subtask Count": "",
        "Subtask #": `${i + 1}.${si + 1}`,
        "Subtask Task": st.docType,
        "Subtask Number": st.number ?? "",
        "Subtask Status": st.status,
        "Subtask Notes": st.notes ?? "",
      });
    });
  });

  const summary = [
    ["Agent", agentName], ["Date", date],
    ["Total TX", stats.total], ["Completion", stats.completion],
    ["Pending", stats.pending], ["Escalation", stats.escalation],
    ["Hold", stats.hold],
    ["Productivity Hours", formatTat(stats.totalProductiveSeconds)],
    ["Production TX", stats.production],
    ["Non-Production TX", stats.nonProduction],
    [],
    ["Task Type Breakdown"],
    ...Object.entries(grouped).map(([k, v]) => [k, v]),
    [],
    ["Subtask Type Breakdown"],
    ...Object.entries(subtaskGrouped).map(([k, v]) => [k, v]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  XLSX.writeFile(wb, `tx-log_${agentName}_${date}.xlsx`);
}

async function exportToPdf(
  transactions: Transaction[],
  agentName: string,
  date: string,
  formattedDate: string,
  stats: { total: number; completion: number; pending: number; escalation: number; hold: number; totalProductiveSeconds: number; production: number; nonProduction: number }
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
    { label: "Hold",               value: String(stats.hold) },
    { label: "Productivity Hours", value: formatTat(stats.totalProductiveSeconds) },
    { label: "Production",         value: String(stats.production) },
  ];
  statItems.forEach((s, i) => {
    const x = 10 + i * 40;
    doc.setFillColor(40, 40, 60); doc.roundedRect(x, 26, 36, 14, 2, 2, "F");
    doc.setTextColor(200, 200, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 18, 33, { align: "center" });
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 160);
    doc.text(s.label.toUpperCase(), x + 18, 38, { align: "center" });
  });
  const tableBody: unknown[] = [];
  transactions.forEach((tx, i) => {
    tableBody.push([i + 1, tx.docType, tx.volume, tx.taskCategory ?? "Production", tx.status, (tx.subtasks ?? []).length, tx.notes ?? "—"]);
    (tx.subtasks ?? []).forEach((st, si) => {
      tableBody.push([`↳ ${i + 1}.${si + 1}`, st.docType, st.number ?? "—", st.taskCategory ?? "Production", st.status, "—", st.notes ?? "—"]);
    });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 44,
    head: [["#", "Type of Task", "Vol", "Category", "Status", "Subtasks", "Notes"]],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [200, 200, 210], fillColor: [25, 25, 40], lineColor: [50, 50, 70], lineWidth: 0.2 },
    headStyles: { fillColor: [40, 40, 65], textColor: [150, 150, 200], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [30, 30, 50] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 40 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: "auto" },
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

/* ─── Shared input classes ─── */
const inputCls   = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const selectCls  = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const inputSmCls  = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all";
const selectSmCls = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all";

/* ═══════════════════════════════════════════════════════
   ─── Productivity Timer (DB-persisted)
   ═══════════════════════════════════════════════════════ */
interface ProductivityTimerProps {
  agentId: string;
  date: string;
  onProductivityChange: (seconds: number) => void;
  bioBreakSeconds: number; 
}

function ProductivityTimer({ agentId, date, onProductivityChange, bioBreakSeconds }: ProductivityTimerProps) {
  const [timer, setTimer] = useState<StandaloneTimer>({
    running: false, paused: false, startEpoch: null, accSeconds: 0,
  });
  const [pendingEnd, setPendingEnd] = useState<EndTimerConfirmation | null>(null);
  const [display, setDisplay] = useState("00:00:00");
  const [timerTxId, setTimerTxId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef(timer);
  const timerTxIdRef = useRef<string | null>(null);

  useEffect(() => { timerRef.current = timer; }, [timer]);
  useEffect(() => { timerTxIdRef.current = timerTxId; }, [timerTxId]);

  const getTotalSeconds = useCallback((t: StandaloneTimer) => {
    if (t.running && !t.paused && t.startEpoch) {
      return t.accSeconds + Math.floor((Date.now() - t.startEpoch) / 1000);
    }
    return t.accSeconds;
  }, []);

  const persistToDB = useCallback((
    seconds: number,
    txId: string | null,
    startEpoch?: number | null,
    paused?: boolean,
  ) => {
    if (!txId) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      fetch("/api/kpi/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: txId,
          productiveSeconds: seconds,
          timerStartEpoch: startEpoch ?? null,
          timerPaused: paused ?? false,
        }),
      }).catch(() => {});
    }, 2000);
  }, []);

  const saveImmediately = useCallback(async (
    txId: string,
    seconds: number,
    startEpoch: number | null,
    paused: boolean,
  ) => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: txId,
        productiveSeconds: seconds,
        timerStartEpoch: startEpoch,
        timerPaused: paused,
      }),
    }).catch(() => {});
  }, []);

  const flushBeacon = useCallback(() => {
    const t = timerRef.current;
    const txId = timerTxIdRef.current;
    if (!txId || !t.running || t.paused) return;
    const total = getTotalSeconds(t);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    navigator.sendBeacon(
      "/api/kpi/timer-beacon",
      new Blob(
        [JSON.stringify({
          id: txId,
          productiveSeconds: total,
          timerStartEpoch: t.startEpoch,
          timerPaused: false,
        })],
        { type: "application/json" }
      )
    );
  }, [getTotalSeconds]);

  useEffect(() => {
    window.addEventListener("beforeunload", flushBeacon);
    return () => window.removeEventListener("beforeunload", flushBeacon);
  }, [flushBeacon]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [flushBeacon]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    fetch(`/api/kpi/transactions?date=${date}&agentId=${agentId}`)
      .then(r => r.json())
      .then(data => {
        const timerRecord = (data.transactions ?? []).find(
          (t: Transaction) => t.docType === "__PROD_TIMER__"
        );
        if (!timerRecord) {
          setTimerTxId(null);
          setTimer({ running: false, paused: false, startEpoch: null, accSeconds: 0 });
          setDisplay("00:00:00");
          onProductivityChange(0);
          return;
        }

        setTimerTxId(timerRecord._id);
        const secs = timerRecord.productiveSeconds ?? 0;
        const savedEpoch = timerRecord.timerStartEpoch ?? null;
        const savedPaused = timerRecord.timerPaused ?? false;

        if (savedEpoch && !savedPaused) {
          const totalSecs = secs + Math.floor((Date.now() - savedEpoch) / 1000);
          setTimer({ running: true, paused: false, startEpoch: savedEpoch, accSeconds: secs });
          setDisplay(formatTat(totalSecs));
          onProductivityChange(totalSecs);
        } else if (savedPaused && secs > 0) {
          setTimer({ running: true, paused: true, startEpoch: null, accSeconds: secs });
          setDisplay(formatTat(secs));
          onProductivityChange(secs);
        } else {
          setTimer({ running: false, paused: false, startEpoch: null, accSeconds: secs });
          setDisplay(formatTat(secs));
          onProductivityChange(secs);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, date]);

  useEffect(() => {
    if (timer.running && !timer.paused) {
      intervalRef.current = setInterval(() => {
        const total = getTotalSeconds(timer);
        setDisplay(formatTat(total));
        onProductivityChange(total);
        persistToDB(total, timerTxId, timer.startEpoch, false);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const total = getTotalSeconds(timer);
      setDisplay(formatTat(total));
      onProductivityChange(total);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, timerTxId]);

  const ensureTimerRecord = useCallback(async (): Promise<string | null> => {
    if (timerTxId) return timerTxId;
    const res = await fetch("/api/kpi/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        agentName: "__timer__",
        docType: "__PROD_TIMER__",
        companyName: "__timer__",
        volume: 1,
        date,
        status: "PENDING",
        startEpoch: Date.now(),
        taskCategory: "Non-Production",
        productiveSeconds: 0,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setTimerTxId(d.transaction._id);
      return d.transaction._id;
    }
    return null;
  }, [timerTxId, agentId, date]);

  const handleStart = async () => {
    const txId = await ensureTimerRecord();
    const epoch = Date.now();
    setTimer({ running: true, paused: false, startEpoch: epoch, accSeconds: 0 });
    if (txId) await saveImmediately(txId, 0, epoch, false);
  };

  const handlePause = async () => {
    if (!timerTxId) return;
    const acc = getTotalSeconds(timer);
    setTimer({ running: true, paused: true, startEpoch: null, accSeconds: acc });
    await saveImmediately(timerTxId, acc, null, true);
  };

  const handleResume = async () => {
    if (!timerTxId) return;
    const epoch = Date.now();
    setTimer(prev => ({ ...prev, paused: false, startEpoch: epoch }));
    await saveImmediately(timerTxId, timer.accSeconds, epoch, false);
  };

  const handleEnd = () => {
    const total = getTotalSeconds(timer);
    const net = Math.max(0, total - bioBreakSeconds);
    setPendingEnd({ productiveSeconds: total, bioBreakSeconds, netSeconds: net });
  };

  const confirmEnd = async () => {
    if (!pendingEnd || !timerTxId) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer({ running: false, paused: false, startEpoch: null, accSeconds: pendingEnd.netSeconds });
    setDisplay(formatTat(pendingEnd.netSeconds));
    onProductivityChange(pendingEnd.netSeconds);
    await saveImmediately(timerTxId, pendingEnd.netSeconds, null, false);
    setPendingEnd(null);
  };

  const cancelEnd = () => setPendingEnd(null);

  const handleReset = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer({ running: false, paused: false, startEpoch: null, accSeconds: 0 });
    onProductivityChange(0);
    setDisplay("00:00:00");
    if (timerTxId) await saveImmediately(timerTxId, 0, null, false);
  };

  const handleContinue = async () => {
    if (!timerTxId) return;
    const epoch = Date.now();
    setTimer(prev => ({ ...prev, running: true, paused: false, startEpoch: epoch }));
    await saveImmediately(timerTxId, timer.accSeconds, epoch, false);
  };

  const isIdle    = !timer.running && !timer.paused && timer.accSeconds === 0;
  const isRunning = timer.running && !timer.paused;
  const isPaused  = timer.paused;
  const isDone    = !timer.running && !timer.paused && timer.accSeconds > 0;

  return (
    <div className="border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Timer size={12} className="text-emerald-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Productivity Timer</p>
        {isRunning && (
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className={`rounded-xl border px-4 py-3 text-center transition-all ${
          isRunning ? "bg-emerald-50 border-emerald-200" :
          isPaused  ? "bg-amber-50 border-amber-200" :
          isDone    ? "bg-indigo-50 border-indigo-200" :
                      "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
        }`}>
          <p className={`font-mono text-2xl font-bold tracking-widest ${
            isRunning ? "text-emerald-600" :
            isPaused  ? "text-amber-500" :
            isDone    ? "text-indigo-600" :
                        "text-slate-400 dark:text-zinc-500"
          }`}>{display}</p>
          <p className="text-[10px] mt-1 uppercase tracking-widest font-semibold text-slate-400 dark:text-zinc-500">
            {isRunning ? "Running" : isPaused ? "Paused" : isDone ? "Total Time" : "Ready"}
          </p>
        </div>
        <div className="flex gap-2">
          {isIdle && (
            <button onClick={handleStart} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
              <Play size={12} /> Start
            </button>
          )}
          {isRunning && (
            <>
              <button onClick={handlePause} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition-colors">
                <Pause size={12} /> Pause
              </button>
              <button onClick={handleEnd} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                <Square size={12} /> End
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={handleResume} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                <Play size={12} /> Resume
              </button>
              <button onClick={handleEnd} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                <Square size={12} /> End
              </button>
            </>
          )}
          {isDone && (
            <>
              <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                <Plus size={12} className="rotate-45" /> Reset
              </button>
              <button onClick={handleContinue} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                <Play size={12} /> Continue
              </button>
            </>
          )}
        </div>
      </div>

      {pendingEnd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[360px] shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <Timer size={15} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">End Productivity Timer?</h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Bio break time will be deducted</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-xs text-emerald-700 font-medium">Total Timer</span>
                <span className="text-xs font-mono font-bold text-emerald-600">{formatTat(pendingEnd.productiveSeconds)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <span>🚻</span> Bio Break Time
                </span>
                <span className="text-xs font-mono font-bold text-amber-600">− {formatTat(pendingEnd.bioBreakSeconds)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-700 mx-1" />
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-xs text-indigo-700 font-semibold">Net Productive Time</span>
                <span className="text-sm font-mono font-bold text-indigo-600">{formatTat(pendingEnd.netSeconds)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelEnd} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                Cancel
              </button>
              <button onClick={confirmEnd} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Subtask Row (table inline edit)

/* ═══════════════════════════════════════════════════════
   ─── Subtask Row (table inline edit)
   ═══════════════════════════════════════════════════════ */
interface SubtaskRowProps {
  subtask: Subtask;
  index: number;
  txId: string;
  docTypes: DocType[];
  parentCategory: TaskCategory;
  onUpdated: (updated: Transaction) => void;
  onDeleted: (updated: Transaction) => void;
}

function SubtaskRow({ subtask, index, txId, docTypes, parentCategory, onUpdated, onDeleted }: SubtaskRowProps) {
  const [editing,   setEditing]   = useState(false);
  const [stDocType, setStDocType] = useState(subtask.docType);
  const [stStatus,  setStStatus]  = useState(subtask.status);
  const [stNotes,   setStNotes]   = useState(subtask.notes ?? "");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const hoveredRef = useRef(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  // Keyboard shortcuts — only when this subtask row is hovered
  // Keyboard shortcuts — only when this subtask row is hovered
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!hoveredRef.current) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "1") {
      e.preventDefault();
      setEditing(true);
    } else if (e.key === "2") {
      e.preventDefault();
      // Call delete inline instead of referencing handleDelete
      fetch("/api/kpi/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: txId, subtaskAction: "DELETE", subtaskId: subtask._id }),
      }).then(res => {
        if (res.ok) res.json().then(d => onDeleted(d.transaction));
      });
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [subtask._id, txId, onDeleted]); // ← correct deps

  const handleSave = async () => {
    setSaving(true);
    const selectedDt = docTypes.find(dt => dt.name === stDocType);
    const subtaskCategory = selectedDt?.taskCategory ?? parentCategory;
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: txId,
        subtaskAction: "UPDATE",
        subtaskId: subtask._id,
        subtask: {
          docType:      stDocType,
          notes:        stNotes.trim() || undefined,
          status:       stStatus,
          taskCategory: subtaskCategory,
        },
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); onUpdated(d.transaction); setEditing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, subtaskAction: "DELETE", subtaskId: subtask._id }),
    });
    setDeleting(false);
    if (res.ok) { const d = await res.json(); onDeleted(d.transaction); }
  };

  if (editing) {
    return (
      <tr className="border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
        <td className="pl-10 pr-2 py-2 text-slate-400 text-xs">↳</td>
        <td className="px-2 py-2">
          <select value={stDocType} onChange={e => setStDocType(e.target.value)} className={selectSmCls}>
            {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
          </select>
        </td>
        <td className="px-2 py-2">
          <CategoryBadge category={docTypes.find(dt => dt.name === stDocType)?.taskCategory ?? subtask.taskCategory} />
        </td>
        <td className="px-2 py-2">
          <select value={stStatus} onChange={e => setStStatus(e.target.value as Subtask["status"])} className={selectSmCls}>
            <option value="COMPLETION">Completion</option>
            <option value="PENDING">Pending</option>
            <option value="ESCALATION">Escalation</option>
            <option value="HOLD">Hold</option>
          </select>
        </td>
        <td className="px-2 py-2">
          <input value={stNotes} onChange={e => setStNotes(e.target.value)} placeholder="Notes…" className={inputSmCls} />
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            <button onClick={handleSave} disabled={saving} className="px-2 py-1 rounded-md bg-indigo-600 text-white text-[10px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"><X size={12} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr
        onMouseEnter={() => { setHovered(true); hoveredRef.current = true; }}
        onMouseLeave={() => { setHovered(false); hoveredRef.current = false; }}
        onMouseMove={handleMouseMove}
        onClick={() => setEditing(true)}
        style={{ cursor: "pointer" }}
        className="border-b border-slate-100/70 dark:border-zinc-800/50 bg-slate-50/30 dark:bg-zinc-900/20 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        {/* # */}
        <td className="pl-10 pr-2 py-2 text-slate-300 dark:text-zinc-600 text-xs">
          ↳ {index + 1}
        </td>

        {/* Type of Task */}
        <td className="px-4 py-2 text-slate-500 dark:text-zinc-400 text-xs">
          {subtask.docType}
        </td>

        {/* Category */}
        <td className="px-4 py-2">
          <CategoryBadge category={subtask.taskCategory} />
        </td>

        {/* Status */}
        <td className="px-4 py-2">
          <StatusBadge status={subtask.status} />
        </td>

        {/* Notes */}
        <td className="px-4 py-2 text-slate-400 dark:text-zinc-500 text-xs max-w-[160px] truncate">
          {subtask.notes ?? "—"}
        </td>

        {/* Actions */}
        <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {/* 1 - Edit */}
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="group relative flex items-center justify-center w-6 h-6 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              title="Edit subtask [1]"
            >
              <Pencil size={12} className="text-slate-300 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center leading-none transition-colors ${
                hovered
                  ? "bg-slate-500 text-white border-slate-500"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500"
              }`}>1</span>
            </button>

            {/* 2 - Delete */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={deleting}
              className="group relative flex items-center justify-center w-6 h-6 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              title="Delete subtask [2]"
            >
              <Trash2 size={12} className="text-slate-300 dark:text-zinc-600 group-hover:text-red-500 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center leading-none transition-colors ${
                hovered
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500"
              }`}>2</span>
            </button>
          </div>
        </td>
      </tr>

      {/* Hover Tooltip */}
      {hovered && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 10,
            zIndex: 9999,
            pointerEvents: "none",
            transform: tooltipPos.x > window.innerWidth - 260 ? "translateX(-110%)" : undefined,
          }}
          className="w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl shadow-slate-200/60 dark:shadow-black/40 p-3 space-y-2"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-semibold">Subtask {index + 1}</span>
              </div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 truncate">{subtask.docType}</p>
            </div>
            <StatusBadge status={subtask.status} />
          </div>

          {/* Category */}
          <div className="rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 px-2 py-1.5">
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-0.5">Category</p>
            <CategoryBadge category={subtask.taskCategory} />
          </div>

          {/* Notes */}
          {subtask.notes && (
            <div className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <p className="text-[9px] text-amber-500 dark:text-amber-400 uppercase tracking-wide font-semibold mb-0.5">Note</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight line-clamp-2">{subtask.notes}</p>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {[
              { key: "1", label: "Edit",   color: "bg-slate-500" },
              { key: "2", label: "Delete", color: "bg-red-500"   },
            ].map(k => (
              <div key={k.key} className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded ${k.color} text-white text-[9px] font-bold flex items-center justify-center`}>{k.key}</span>
                <span className="text-[9px] text-slate-300 dark:text-zinc-600">{k.label}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Add Subtask Inline Row (table)
   ═══════════════════════════════════════════════════════ */
interface AddSubtaskInlineRowProps {
  docTypes: DocType[];
  txId: string;
  parentCategory: TaskCategory;  // ADD THIS
  onAdded: (updated: Transaction) => void;
  onCancel: () => void;
}
function AddSubtaskInlineRow({ docTypes, txId, parentCategory, onAdded, onCancel }: AddSubtaskInlineRowProps) {
  const [stDocType, setStDocType] = useState(docTypes[0]?.name ?? "");
  const [stNumber,  setStNumber]  = useState("");
  const [stStatus,  setStStatus]  = useState<Subtask["status"]>("COMPLETION");
  const [stNotes,   setStNotes]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const handleSubmit = async () => {
  setErr("");
  if (!stDocType) { setErr("Select a task type"); return; }
  setSaving(true);

  // Look up the selected docType's own category
  const selectedDt = docTypes.find(dt => dt.name === stDocType);
  const subtaskCategory = selectedDt?.taskCategory ?? parentCategory;

  const res = await fetch("/api/kpi/transactions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: txId,
      subtaskAction: "ADD",
      subtask: {
        docType:      stDocType,
        number:       stNumber ? Number(stNumber) : undefined,
        notes:        stNotes.trim() || undefined,
        status:       stStatus,
        taskCategory: subtaskCategory,  // ← uses the subtask docType's own category
      },
    }),
  });
  setSaving(false);
  if (res.ok) { const d = await res.json(); onAdded(d.transaction); }
  else setErr("Failed to add");
};

  return (
    <div className="flex flex-wrap items-end gap-2 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-1 text-indigo-400 mb-0.5 w-full">
        <ListPlus size={11} />
        <span className="text-[10px] font-bold uppercase tracking-widest">New Subtask</span>
      </div>
      <div className="w-full flex flex-wrap gap-2">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[9px] text-slate-400 mb-0.5">Task Type</label>
          <select value={stDocType} onChange={e => setStDocType(e.target.value)} className={selectSmCls}>
            <option value="">Select…</option>
            {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
          </select>
        </div>
        <div className="w-20">
          <label className="block text-[9px] text-slate-400 mb-0.5">Number</label>
          <input type="number" min="1" value={stNumber} onChange={e => setStNumber(e.target.value)} placeholder="e.g. 5" className={inputSmCls} />
        </div>
        <div className="w-28">
          <label className="block text-[9px] text-slate-400 mb-0.5">Status</label>
          <select value={stStatus} onChange={e => setStStatus(e.target.value as Subtask["status"])} className={selectSmCls}>
            <option value="COMPLETION">Completion</option>
            <option value="PENDING">Pending</option>
            <option value="ESCALATION">Escalation</option>
            <option value="HOLD">Hold</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[9px] text-slate-400 mb-0.5">Notes</label>
          <input value={stNotes} onChange={e => setStNotes(e.target.value)} placeholder="Optional…" className={inputSmCls} />
        </div>
      </div>
      {err && <p className="w-full text-[10px] text-red-500">{err}</p>}
      <div className="flex gap-2 ml-auto">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50">
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── TX Table Row
   ═══════════════════════════════════════════════════════ */
interface TxTableRowProps {
  tx: Transaction;
  index: number;
  docTypeCount: number;
  subtaskDocTypeTotals: Record<string, number>;
  docTypes: DocType[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onTxUpdated: (updated: Transaction) => void;
  onResume: (tx: Transaction) => void;
}

function TxTableRow({ tx, index, docTypeCount, subtaskDocTypeTotals, docTypes, onEdit, onDelete, onTxUpdated, onResume }: TxTableRowProps) {
  const [expanded,        setExpanded]        = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [hovered,         setHovered]         = useState(false);
  const [tooltipPos,      setTooltipPos]      = useState({ x: 0, y: 0 });
  const hoveredRef = useRef(false); // ref to track hover in keyboard handler
  const subtasks = tx.subtasks ?? [];

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  // Keyboard shortcuts — only fires when this row is hovered
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hoveredRef.current) return;
      // Don't fire if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") {
        e.preventDefault();
        setExpanded(true);
        setShowSubtaskForm(true);
      } else if (e.key === "2") {
        e.preventDefault();
        onEdit(tx);
      } else if (e.key === "3") {
        e.preventDefault();
        onDelete(tx._id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tx, onEdit, onDelete]);

  return (
    <>
      <tr
        onMouseEnter={() => { setHovered(true); hoveredRef.current = true; }}
        onMouseLeave={() => { setHovered(false); hoveredRef.current = false; }}
        onMouseMove={handleMouseMove}
        onClick={() => onEdit(tx)}
        style={{ cursor: "pointer" }}
        className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors ${tx.status === "HOLD" ? "bg-sky-50/30 dark:bg-sky-950/10" : ""}`}
      >
        <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(exp => !exp); if (!expanded) setShowSubtaskForm(false); }}
              className={`transition-colors ${subtasks.length > 0 ? "text-indigo-400 hover:text-indigo-600" : "text-slate-200 dark:text-zinc-700 hover:text-slate-400"}`}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <span>{index + 1}</span>
          </div>
        </td>

        <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{tx.docType}</span>
          </div>
        </td>

        <td className="px-4 py-3"><CategoryBadge category={tx.taskCategory} /></td>

        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <StatusBadge status={tx.status} />
            {tx.status === "HOLD" && (
              <button
                onClick={(e) => { e.stopPropagation(); onResume(tx); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
              >
                <Play size={9} /> Resume
              </button>
            )}
          </div>
        </td>

        <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs max-w-[160px] truncate" title={tx.notes}>{tx.notes ?? "—"}</td>

        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {/* 1 - Add Subtask */}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setShowSubtaskForm(true); }}
              className="group relative flex items-center justify-center w-6 h-6 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              title="Add subtask [1]"
            >
              <ListPlus size={13} className="text-slate-300 dark:text-zinc-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center leading-none transition-colors ${
                hovered
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400"
              }`}>1</span>
            </button>

            {/* 2 - Edit */}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
              className="group relative flex items-center justify-center w-6 h-6 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              title="Edit transaction [2]"
            >
              <Pencil size={13} className="text-slate-300 dark:text-zinc-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center leading-none transition-colors ${
                hovered
                  ? "bg-slate-500 text-white border-slate-500"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500"
              }`}>2</span>
            </button>

            {/* 3 - Delete */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tx._id); }}
              className="group relative flex items-center justify-center w-6 h-6 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete transaction [3]"
            >
              <Trash2 size={13} className="text-slate-300 dark:text-zinc-600 group-hover:text-red-500 transition-colors" />
              <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center leading-none transition-colors ${
                hovered
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500"
              }`}>3</span>
            </button>
          </div>
        </td>
      </tr>

      {/* Hover Tooltip */}
      {hovered && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 10,
            zIndex: 9999,
            pointerEvents: "none",
            transform: tooltipPos.x > window.innerWidth - 280 ? "translateX(-110%)" : undefined,
          }}
          className="w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl shadow-slate-200/60 dark:shadow-black/40 p-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-100 truncate">{tx.docType}</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">{tx.companyName}</p>
            </div>
            <StatusBadge status={tx.status} />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 px-2 py-1.5">
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Volume</p>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 mt-0.5">{tx.volume}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 px-2 py-1.5">
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Category</p>
              <div className="mt-0.5"><CategoryBadge category={tx.taskCategory} /></div>
            </div>
          </div>

          {(tx.subtasks ?? []).length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <ListPlus size={10} className="text-indigo-400" />
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{tx.subtasks!.length} subtask{tx.subtasks!.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {tx.notes && (
            <div className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <p className="text-[9px] text-amber-500 dark:text-amber-400 uppercase tracking-wide font-semibold mb-0.5">Note</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight line-clamp-2">{tx.notes}</p>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {[
              { key: "1", label: "Subtask", color: "bg-indigo-500" },
              { key: "2", label: "Edit",    color: "bg-slate-500"  },
              { key: "3", label: "Delete",  color: "bg-red-500"    },
            ].map(k => (
              <div key={k.key} className="flex items-center gap-1">
                <span className={`w-4 h-4 rounded ${k.color} text-white text-[9px] font-bold flex items-center justify-center`}>{k.key}</span>
                <span className="text-[9px] text-slate-300 dark:text-zinc-600">{k.label}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {expanded && (
        <>
          {subtasks.map((st, si) => (
            <SubtaskRow
              key={st._id}
              subtask={st}
              index={si}
              txId={tx._id}
              docTypes={docTypes}
              parentCategory={tx.taskCategory ?? "Production"}
              onUpdated={onTxUpdated}
              onDeleted={onTxUpdated}
            />
          ))}
          {showSubtaskForm ? (
            <tr className="border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10">
              <td colSpan={6} className="pl-10 pr-4 py-3">
                <div className="max-w-[580px]">
                  <AddSubtaskInlineRow
                    docTypes={docTypes}
                    txId={tx._id}
                    parentCategory={tx.taskCategory ?? "Production"}
                    onAdded={(updated) => { onTxUpdated(updated); setShowSubtaskForm(false); }}
                    onCancel={() => setShowSubtaskForm(false)}
                  />
                </div>
              </td>
            </tr>
          ) : (
            <tr className="border-b border-slate-100 dark:border-zinc-800/50">
              <td colSpan={6} className="pl-10 pr-4 py-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubtaskForm(true); }}
                  className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-600 font-medium transition-colors"
                >
                  <Plus size={11} /> Add subtask
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
/* ═══════════════════════════════════════════════════════
   ─── Bio Break Panel
   ═══════════════════════════════════════════════════════ */
function BioBreakPanel({ selectedAgent, date, onBioBreakChange }: { selectedAgent: Agent; date: string; onBioBreakChange: (seconds: number) => void }) {
  useTick(1000);

  const [agentSession, setAgentSession]       = useState<AgentSessionData | null>(null);
  const [activeBreak,  setActiveBreak]        = useState<BreakEntry | null>(null);
  const [submitting,   setSubmitting]         = useState(false);
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent._id, agentName: selectedAgent.name, date }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    setSessionStarting(false);
  };

  const handleStartBio = async () => {
    if (activeBreak || submitting) return;
    setSubmitting(true);
    if (!agentSession) {
      await fetch("/api/kpi/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent._id, agentName: selectedAgent.name, date }),
      });
    }
    const res = await fetch("/api/kpi/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent._id, date, action: "START_BREAK", breakType: "BIO" }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    const ongoing = (d.session?.breaks ?? []).find((b: BreakEntry) => !b.endEpoch);
    setActiveBreak(ongoing ?? null);
    setSubmitting(false);
  };

  const handleEndBio = async () => {
    if (!activeBreak || submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/kpi/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedAgent._id, date, action: "END_BREAK", breakId: activeBreak._id }),
    });
    const d = await res.json();
    setAgentSession(d.session);
    setActiveBreak(null);
    setSubmitting(false);
  };

  const liveBreakSeconds     = activeBreak ? Math.floor((Date.now() - activeBreak.startEpoch) / 1000) : 0;
  const totalBioBreakSeconds = (agentSession?.totalBreakSeconds ?? 0) + liveBreakSeconds;
  const bioBreaks            = agentSession?.breaks ?? [];
  useEffect(() => { onBioBreakChange(totalBioBreakSeconds); }, [totalBioBreakSeconds]);
  const completedBios        = bioBreaks.filter(b => b.endEpoch);

  return (
    <div className="border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {agentSession && !agentSession.sessionEndEpoch && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Bio Break Tracker</p>
        </div>
        {!agentSession && (
          <button onClick={handleStartSession} disabled={sessionStarting} className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50">
            {sessionStarting ? "Starting…" : "Start Session"}
          </button>
        )}
        {agentSession && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            {new Date(agentSession.sessionStartEpoch).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {agentSession ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-2 text-center">
                <p className="text-[13px] font-bold font-mono text-sky-600">{completedBios.length}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-1">Total Bio Breaks</p>
              </div>
              <div className={`rounded-xl border px-2 py-2 text-center ${activeBreak ? "border-amber-200 bg-amber-50" : "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"}`}>
                <p className={`text-[13px] font-bold font-mono ${activeBreak ? "text-amber-600" : "text-slate-500 dark:text-zinc-400"}`}>{formatTat(totalBioBreakSeconds)}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-1">Total Bio Time</p>
              </div>
            </div>

            {activeBreak ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">🚻</div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Bio break in progress</p>
                    <p className="text-[11px] text-amber-500 font-mono font-semibold">{formatTat(liveBreakSeconds)}</p>
                  </div>
                </div>
                <button onClick={handleEndBio} disabled={submitting} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors disabled:opacity-50">
                  <Play size={10} />
                  {submitting ? "Saving…" : "Return"}
                </button>
              </div>
            ) : (
              <button onClick={handleStartBio} disabled={submitting} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors disabled:opacity-40">
                <span className="text-sm">🚻</span>
                {submitting ? "Starting…" : "Bio Break"}
              </button>
            )}

            {bioBreaks.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-slate-300 dark:text-zinc-600 font-bold mb-1.5">Bio Break Log ({bioBreaks.length})</p>
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-0.5">
                  {bioBreaks.map((b, i) => (
                    <div key={b._id} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] ${!b.endEpoch ? "bg-amber-50 border-amber-200" : "bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700"}`}>
                      <div className="flex items-center gap-1.5">
                        <span>🚻</span>
                        <span className="text-slate-500 dark:text-zinc-400">Bio #{i + 1}</span>
                        {!b.endEpoch && <span className="px-1 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold animate-pulse">LIVE</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {b.endEpoch && (
                          <span className="text-slate-400 dark:text-zinc-500 font-mono text-[10px]">
                            {new Date(b.startEpoch).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false })}
                            {" → "}
                            {new Date(b.endEpoch).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                        )}
                        <span className={`font-mono font-semibold ${b.endEpoch ? "text-slate-500 dark:text-zinc-400" : "text-amber-500"}`}>
                          {b.endEpoch ? formatTat(b.durationSeconds) : formatTat(liveBreakSeconds)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wide">Total Bio Break Time</span>
                  <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-zinc-300">{formatTat(totalBioBreakSeconds)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-3 py-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-dashed border-slate-200 dark:border-zinc-700 text-center">
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">No active session for today.</p>
            <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-0.5">Click <span className="font-semibold">Start Session</span> to begin tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Inline Subtask Builder (log form)
   ═══════════════════════════════════════════════════════ */
interface InlineSubtask {
  id: string;
  docType: string;
  number: string;
  status: Subtask["status"];
  notes: string;
}

interface SubtaskBuilderProps {
  docTypes: DocType[];
  subtasks: InlineSubtask[];
  onChange: (subtasks: InlineSubtask[]) => void;
}

function SubtaskBuilder({ docTypes, subtasks, onChange }: SubtaskBuilderProps) {
  const addRow = () => onChange([
    ...subtasks,
    { id: `st-${Date.now()}`, docType: docTypes[0]?.name ?? "", number: "", status: "COMPLETION", notes: "" },
  ]);

  const update = (id: string, patch: Partial<InlineSubtask>) =>
    onChange(subtasks.map(st => st.id === id ? { ...st, ...patch } : st));

  const remove = (id: string) => onChange(subtasks.filter(st => st.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 flex items-center gap-1">
          <ListPlus size={11} /> Subtasks
        </p>
        <button type="button" onClick={addRow} className="inline-flex items-center gap-0.5 text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
          <Plus size={11} /> Add
        </button>
      </div>
      {subtasks.length === 0 && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">No subtasks yet — click Add to include one.</p>
      )}
      {subtasks.map((st, i) => (
        <div key={st.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">Subtask {i + 1}</span>
            <button type="button" onClick={() => remove(st.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={11} /></button>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1">
              <select value={st.docType} onChange={e => update(st.id, { docType: e.target.value })} className={selectSmCls}>
                <option value="">Select type…</option>
                {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
              </select>
            </div>
            <div className="w-16">
              <input type="number" min="1" value={st.number} onChange={e => update(st.id, { number: e.target.value })} placeholder="#" className={inputSmCls} />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-28">
              <select value={st.status} onChange={e => update(st.id, { status: e.target.value as Subtask["status"] })} className={selectSmCls}>
                <option value="COMPLETION">Completion</option>
                <option value="PENDING">Pending</option>
                <option value="ESCALATION">Escalation</option>
                <option value="HOLD">Hold</option>
              </select>
            </div>
            <div className="flex-1">
              <input value={st.notes} onChange={e => update(st.id, { notes: e.target.value })} placeholder="Notes…" className={inputSmCls} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Log Transaction Modal
   ═══════════════════════════════════════════════════════ */
interface LogTransactionModalProps {
  open: boolean;
  onClose: () => void;
  docTypes: DocType[];
  selectedAgent: Agent;
  date: string;
  resumingTxId: string | null;
  docType: string;
  companyName: string;
  volume: string;
  notes: string;
  taskCategory: TaskCategory;
  txStatus: Transaction["status"];
  formSubtasks: InlineSubtask[];
  submitting: boolean;
  formError: string;
  saveSuccess: string;
  onDocTypeChange: (name: string) => void;
  onCompanyNameChange: (v: string) => void;
  onVolumeChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onTxStatusChange: (s: Transaction["status"]) => void;
  onFormSubtasksChange: (subs: InlineSubtask[]) => void;
  onSave: (e: React.FormEvent, overrideStatus?: Transaction["status"]) => void;
  onCancelResume: () => void;
}

function LogTransactionModal({
  open, onClose, docTypes, resumingTxId,
  docType, companyName, volume, notes, taskCategory, txStatus, formSubtasks,
  submitting, formError, saveSuccess,
  onDocTypeChange, onCompanyNameChange, onVolumeChange, onNotesChange,
  onTxStatusChange, onFormSubtasksChange, onSave, onCancelResume,
}: LogTransactionModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-[480px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Plus size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {resumingTxId ? "Edit Resumed Transaction" : "Log Transaction"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {resumingTxId && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[11px] text-amber-700 font-semibold">Resuming held transaction</span>
              <button
                type="button"
                onClick={onCancelResume}
                className="text-amber-500 hover:text-amber-700 text-[11px] font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Type of Task</label>
            <select value={docType} onChange={e => onDocTypeChange(e.target.value)} className={selectCls}>
              <option value="">Select type…</option>
              {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
            </select>
            {docType && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">Category:</span>
                <CategoryBadge category={taskCategory} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Company Name</label>
            <input value={companyName} onChange={e => onCompanyNameChange(e.target.value)} placeholder="Client / company" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">No. of Employees / Volume</label>
            <input type="number" min="1" value={volume} onChange={e => onVolumeChange(e.target.value)} className={inputCls} />
          </div>

          {/* Status selector */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <button key={s} type="button" onClick={() => onTxStatusChange(s)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${txStatus === s ? `${cfg.color} ${cfg.bg}` : "border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => onNotesChange(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
          </div>

          {/* Subtask builder */}
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
            <SubtaskBuilder
              docTypes={docTypes}
              subtasks={formSubtasks}
              onChange={onFormSubtasksChange}
            />
          </div>

          {formError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-500">!</span>
              {formError}
            </p>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-medium">
              <CheckCircle2 size={12} />{saveSuccess}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => onSave(e as unknown as React.FormEvent, "HOLD")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 text-sm font-semibold hover:bg-sky-100 transition-colors disabled:opacity-50"
          >
            <PauseCircle size={13} />
            {submitting ? "…" : "Hold"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => onSave(e as unknown as React.FormEvent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
          >
            <Plus size={13} />
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Main Page
   ═══════════════════════════════════════════════════════ */
export default function TxLogPage() {
  const [agents, setAgents]               = useState<Agent[]>([]);
  const [docTypes, setDocTypes]           = useState<DocType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterStatus, setFilterStatus]   = useState<Transaction["status"] | "ALL">("ALL");
  const [filterDocType, setFilterDocType] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "ALL">("ALL");
  const [date, setDate]                   = useState(today());

  const [timerProductiveSeconds, setTimerProductiveSeconds] = useState(0);
  const [totalBioBreakSeconds, setTotalBioBreakSeconds]     = useState(0);

  /* ── Log-form state ── */
  const [showLogModal, setShowLogModal]   = useState(false);
  const [docType, setDocType]           = useState("");
  const [companyName, setCompanyName]   = useState("");
  const [volume, setVolume]             = useState("1");
  const [notes, setNotes]               = useState("");
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("Production");
  const [txStatus, setTxStatus]         = useState<Transaction["status"]>("COMPLETION");
  const [formSubtasks, setFormSubtasks] = useState<InlineSubtask[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState("");
  const [saveSuccess, setSaveSuccess]   = useState("");

  /* ── Edit state ── */
  const [editingTx, setEditingTx]               = useState<Transaction | null>(null);
  const [editDocType, setEditDocType]           = useState("");
  const [editCompanyName, setEditCompanyName]   = useState("");
  const [editVolume, setEditVolume]             = useState("1");
  const [editStatus, setEditStatus]             = useState<Transaction["status"]>("PENDING");
  const [editNotes, setEditNotes]               = useState("");
  const [editTaskCategory, setEditTaskCategory] = useState<TaskCategory>("Production");
  const [editSubmitting, setEditSubmitting]     = useState(false);
  const [deletingId, setDeletingId]             = useState<string | null>(null);

  /* ── Settings state ── */
  const [showSettings, setShowSettings]             = useState(false);
  const [newAgent, setNewAgent]                     = useState("");
  const [newAgentGroup, setNewAgentGroup]           = useState("");
  const [newDocType, setNewDocType]                 = useState("");
  const [newDocTypeCategory, setNewDocTypeCategory] = useState<TaskCategory>("Production");
  const [newDocTypeCountType, setNewDocTypeCountType] = useState<CountType>("transaction");
  const [exporting, setExporting]                   = useState<"pdf" | "excel" | null>(null);

  const [resumingTxId, setResumingTxId] = useState<string | null>(null);

  const [editingDocTypeId, setEditingDocTypeId]         = useState<string | null>(null);
  const [editDocTypeName, setEditDocTypeName]           = useState("");
  const [editDocTypeCategory, setEditDocTypeCategory]   = useState<TaskCategory>("Production");
  const [editDocTypeCountType, setEditDocTypeCountType] = useState<CountType>("transaction");

  /* ── Bootstrap ── */
  useEffect(() => {
    fetch("/api/kpi/agents").then(r => r.json()).then(d => {
      setAgents(d.agents ?? []);
      if (d.agents?.length > 0 && !selectedAgent) setSelectedAgent(d.agents[0]);
    });
    fetch("/api/kpi/doc-types").then(r => r.json()).then(d => {
      const dts: DocType[] = d.docTypes ?? [];
      setDocTypes(dts);
      if (dts.length > 0) { setDocType(dts[0].name); setTaskCategory(dts[0].taskCategory ?? "Production"); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTx = useCallback(async () => {
    if (!selectedAgent) return;
    const res = await fetch(`/api/kpi/transactions?date=${date}&agentId=${selectedAgent._id}`);
    const d   = await res.json();
    const VALID = new Set(["PENDING", "COMPLETION", "ESCALATION", "HOLD"]);
    const all = (d.transactions ?? [])
      .filter((t: Transaction) => t.docType !== "__PROD_TIMER__")
      .map((t: Transaction) => ({ ...t, status: VALID.has(t.status) ? t.status : "PENDING" }));
    setTransactions(all);
  }, [selectedAgent, date]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const handleDocTypeChange = (name: string) => {
    setDocType(name);
    const found = docTypes.find(dt => dt.name === name);
    if (found) setTaskCategory(found.taskCategory ?? "Production");
  };
  const handleEditDocTypeChange = (name: string) => {
    setEditDocType(name);
    const found = docTypes.find(dt => dt.name === name);
    if (found) setEditTaskCategory(found.taskCategory ?? "Production");
  };

  const handleTxUpdated = (updated: Transaction) => {
    setTransactions(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t));
  };

  /* ── Build subtask docType totals across ALL transactions ── */
  const subtaskDocTypeTotals: Record<string, number> = {};
  transactions.forEach(tx => {
    (tx.subtasks ?? []).forEach(st => {
      subtaskDocTypeTotals[st.docType] = (subtaskDocTypeTotals[st.docType] ?? 0) + 1;
    });
  });

  /* ── Stats ── */
  const stats = {
    total:      transactions.length + transactions.reduce((acc, tx) => acc + (tx.subtasks?.length ?? 0), 0),
    completion: transactions.filter(t => t.status === "COMPLETION").length,
    pending:    transactions.filter(t => t.status === "PENDING").length,
    escalation: transactions.filter(t => t.status === "ESCALATION").length,
    hold:       transactions.filter(t => t.status === "HOLD").length,
    totalProductiveSeconds: timerProductiveSeconds,
    production:    transactions.filter(t => !t.taskCategory || t.taskCategory === "Production").length,
    nonProduction: transactions.filter(t => t.taskCategory === "Non-Production").length,
  };

  const docTypeCountMap: Record<string, number> = {};
  transactions.forEach(tx => { docTypeCountMap[tx.docType] = (docTypeCountMap[tx.docType] ?? 0) + 1; });

  /* ── countType lookup map ── */
  const countTypeMap: Record<string, CountType> = {};
  docTypes.forEach(dt => { countTypeMap[dt.name] = dt.countType ?? "transaction"; });

  const filteredTransactions = transactions.filter(tx => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.companyName.toLowerCase().includes(q) ||
      tx.docType.toLowerCase().includes(q) ||
      String(tx.volume).includes(q) ||
      (tx.notes ?? "").toLowerCase().includes(q) ||
      (tx.subtasks ?? []).some(st =>
        st.docType.toLowerCase().includes(q) ||
        (st.notes ?? "").toLowerCase().includes(q)
      );
    const matchesStatus   = filterStatus   === "ALL" || tx.status   === filterStatus;
    const matchesDocType  = filterDocType  === "ALL" || tx.docType  === filterDocType;
    const matchesCategory = filterCategory === "ALL" || (tx.taskCategory ?? "Production") === filterCategory;
    return matchesSearch && matchesStatus && matchesDocType && matchesCategory;
  });

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  /* ── Export ── */
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

  /* ── Reset form helper ── */
  const resetForm = () => {
    setResumingTxId(null);
    setCompanyName(""); setNotes(""); setVolume("1");
    setTxStatus("COMPLETION"); setFormSubtasks([]);
    if (docTypes.length > 0) {
      setDocType(docTypes[0].name);
      setTaskCategory(docTypes[0].taskCategory ?? "Production");
    }
    setFormError("");
    setSaveSuccess("");
  };

  /* ── Save transaction (Save or Hold) ── */
  const handleSave = async (e: React.FormEvent, overrideStatus?: Transaction["status"]) => {
    e.preventDefault();
    if (!selectedAgent) return;
    if (!docType)            { setFormError("Select a task type"); return; }
    if (!companyName.trim()) { setFormError("Company name is required"); return; }
    setFormError("");
    setSubmitting(true);

    const finalStatus = overrideStatus ?? txStatus;

    if (resumingTxId) {
      const res = await fetch("/api/kpi/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resumingTxId,
          docType,
          companyName: companyName.trim(),
          volume: Number(volume),
          status: finalStatus,
          notes: notes.trim() || undefined,
          taskCategory,
        }),
      });
      setSubmitting(false);
      if (res.ok) {
        await fetchTx();
        setSaveSuccess(finalStatus === "HOLD" ? "Transaction placed on hold" : "Transaction updated");
        setTimeout(() => { setSaveSuccess(""); setShowLogModal(false); resetForm(); }, 1500);
      } else {
        const errData = await res.json();
        setFormError(errData.error ?? "Failed to update transaction");
      }
      return;
    }

   const subtasksPayload = formSubtasks
  .filter(st => st.docType)
  .map(st => {
    const foundDocType = docTypes.find(dt => dt.name === st.docType);
    return {
      docType: st.docType,
      number:  st.number ? Number(st.number) : undefined,
      status:  st.status,
      notes:   st.notes.trim() || undefined,
      taskCategory: foundDocType?.taskCategory ?? "Production",
      countType: foundDocType?.countType ?? "transaction",
    };
  });

    // Find the countType for this docType
const selectedDocType = docTypes.find(dt => dt.name === docType);
const countType = selectedDocType?.countType ?? "transaction";

const res = await fetch("/api/kpi/transactions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentId:        selectedAgent._id,
    agentName:      selectedAgent.name,
    docType,
    companyName:    companyName.trim(),
    volume:         Number(volume),
    date,
    status:         finalStatus,
    notes:          notes.trim() || undefined,
    startEpoch:     Date.now(),
    elapsedSeconds: 0,
    taskCategory,
    countType,
    subtasks:       subtasksPayload,
  }),
});
    setSubmitting(false);
    if (res.ok) {
      await fetchTx();
      setSaveSuccess(finalStatus === "HOLD" ? "Transaction placed on hold" : "Transaction saved");
      setTimeout(() => { setSaveSuccess(""); setShowLogModal(false); resetForm(); }, 1500);
    } else {
      const errData = await res.json();
      setFormError(errData.error ?? "Failed to save transaction");
    }
  };

  /* ── Resume a held transaction ── */
  const handleResume = async (tx: Transaction) => {
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tx._id, status: "PENDING" }),
    });
    if (res.ok) {
      const d = await res.json();
      setTransactions(prev =>
        prev.map(t => t._id === d.transaction._id ? { ...t, ...d.transaction } : t)
      );
      setResumingTxId(tx._id);
      setDocType(tx.docType);
      setCompanyName(tx.companyName);
      setVolume(String(tx.volume));
      setNotes(tx.notes ?? "");
      setTxStatus("PENDING");
      setTaskCategory(tx.taskCategory ?? "Production");
      setFormSubtasks(
        (tx.subtasks ?? []).map(st => ({
          id: `st-resume-${st._id}`,
          docType: st.docType,
          number: String(st.number ?? ""),
          status: st.status,
          notes: st.notes ?? "",
        }))
      );
      setShowLogModal(true);
    }
  };

  /* ── Edit ── */
  const openEdit = (tx: Transaction) => {
    setEditingTx(tx); setEditDocType(tx.docType); setEditCompanyName(tx.companyName);
    setEditVolume(String(tx.volume)); setEditStatus(tx.status); setEditNotes(tx.notes ?? ""); setEditTaskCategory(tx.taskCategory ?? "Production");
  };
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setEditSubmitting(true);
    await fetch("/api/kpi/transactions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTx._id, docType: editDocType, companyName: editCompanyName.trim(), volume: Number(editVolume), status: editStatus, notes: editNotes.trim() || undefined, taskCategory: editTaskCategory }),
    });
    setEditSubmitting(false); setEditingTx(null); fetchTx();
  };
  const deleteTx = async () => {
    if (!deletingId) return;
    await fetch("/api/kpi/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deletingId }) });
    setDeletingId(null); fetchTx();
  };

  /* ── Settings helpers ── */
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
    const res = await fetch("/api/kpi/doc-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDocType.trim(),
        taskCategory: newDocTypeCategory,
        countType: newDocTypeCountType,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setDocTypes(prev => [...prev, d.docType]);
      if (!docType) { setDocType(d.docType.name); setTaskCategory(d.docType.taskCategory ?? "Production"); }
      setNewDocType("");
      setNewDocTypeCategory("Production");
      setNewDocTypeCountType("transaction");
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

  const updateDocType = async (id: string) => {
  if (!editDocTypeName.trim()) return;
  const res = await fetch("/api/kpi/doc-types", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: editDocTypeName.trim(),
      taskCategory: editDocTypeCategory,
      countType: editDocTypeCountType,
    }),
  });
  if (res.ok) {
    const d = await res.json();
    setDocTypes(prev => prev.map(dt => dt._id === id ? d.docType : dt));
    setEditingDocTypeId(null);
  }
};

  const canExport = !!selectedAgent && transactions.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── Left sidebar: task types only ── */}
      <div className="w-[200px] flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Task Types ({docTypes.length})</span>
          <button onClick={() => setShowSettings(s => !s)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
          {docTypes.length === 0 && <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">No task types yet.<br />Click + to add one.</p>}
          {docTypes.map(dt => (
            <button
              key={dt._id}
              onClick={() => {
                handleDocTypeChange(dt.name);
                setCompanyName(""); setNotes(""); setVolume("1");
                setTxStatus("COMPLETION"); setFormSubtasks([]);
                setResumingTxId(null); setFormError(""); setSaveSuccess("");
                setShowLogModal(true);
              }}
              className="w-full text-left px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 text-slate-500 dark:text-zinc-400 text-[11px] transition-colors"
            >
              <span className="block truncate">{dt.name}</span>
              <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                (dt.countType ?? "transaction") === "volume"
                  ? "bg-emerald-50 text-emerald-500"
                  : "bg-indigo-50 text-indigo-400"
              }`}>
                {(dt.countType ?? "transaction") === "volume" ? "VOL" : "TX"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              {agents.length > 0 ? (
                <div className="flex items-center gap-2.5">
                  {selectedAgent && (
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {selectedAgent.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <select
                      value={selectedAgent?._id ?? ""}
                      onChange={e => {
                        const agent = agents.find(a => a._id === e.target.value);
                        if (agent) setSelectedAgent(agent);
                      }}
                      className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]"
                    >
                      <option value="" disabled>Select agent…</option>
                      {agents.map(a => (
                        <option key={a._id} value={a._id}>
                          {a.name}{a.group ? ` · ${a.group}` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedAgent && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{formattedDate}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 dark:text-zinc-500 text-sm">No agents — click + to add one</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            <button onClick={() => setDate(today())} className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-100 transition-colors">Today</button>
            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
            <button onClick={handleExcelExport} disabled={!canExport || exporting === "excel"} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"}`}>
              <FileSpreadsheet size={13} />
              {exporting === "excel" ? "Exporting…" : "Excel"}
            </button>
            <button onClick={handlePdfExport} disabled={!canExport || exporting === "pdf"} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${canExport ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"}`}>
              <FileText size={13} />
              {exporting === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        {selectedAgent && (
          <div className="px-6 py-3 grid grid-cols-8 gap-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
            {[
              { label: "Total TX",         value: stats.total,                             color: "text-indigo-600",  bg: "bg-indigo-50  border-indigo-200"  },
              { label: "Completion",       value: stats.completion,                        color: "text-green-600",   bg: "bg-green-50   border-green-200"   },
              { label: "Pending",          value: stats.pending,                           color: "text-amber-600",   bg: "bg-amber-50   border-amber-200"   },
              { label: "Escalation",       value: stats.escalation,                        color: "text-purple-600",  bg: "bg-purple-50  border-purple-200"  },
              { label: "Hold",             value: stats.hold,                              color: "text-sky-600",     bg: "bg-sky-50     border-sky-200"     },
              { label: "Productivity Hrs", value: formatTat(stats.totalProductiveSeconds), color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Production",       value: stats.production,                        color: "text-indigo-600",  bg: "bg-indigo-50  border-indigo-200"  },
              { label: "Non-Production",   value: stats.nonProduction,                     color: "text-slate-600 dark:text-zinc-400", bg: "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border rounded-xl px-2 py-2.5 text-center`}>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left panel: Bio Break + Productivity Timer only ── */}
          {selectedAgent && (
            <div className="w-[280px] flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto">
             <BioBreakPanel selectedAgent={selectedAgent} date={date} onBioBreakChange={setTotalBioBreakSeconds} />
              <ProductivityTimer
                agentId={selectedAgent._id}
                date={date}
                onProductivityChange={setTimerProductiveSeconds}
                bioBreakSeconds={totalBioBreakSeconds}
              />

              {/* Log Transaction button in panel */}
              <div className="p-4">
                <button
                  onClick={() => { resetForm(); setShowLogModal(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-indigo-200"
                >
                  <Plus size={15} />
                  Log Transaction
                </button>
              </div>
            </div>
          )}

          {/* ── Transactions table ── */}
          <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 relative">
            {!selectedAgent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users size={32} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Select an agent from the dropdown above</p>
                  <p className="text-slate-400 text-xs mt-1">or add a new agent via the + button in the sidebar</p>
                </div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Tag size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-zinc-400 text-sm">No transactions for this date</p>
                  <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Click <span className="font-semibold text-indigo-500">Log Transaction</span> to add one</p>
                  <button
                    onClick={() => { resetForm(); setShowLogModal(true); }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                  >
                    <Plus size={14} /> Log Transaction
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Filter bar */}
                <div className="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Log — {formattedDate}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {filteredTransactions.length === transactions.length
                          ? `${transactions.length} transactions`
                          : `${filteredTransactions.length} of ${transactions.length}`}
                      </span>
                      <button
                        onClick={() => { resetForm(); setShowLogModal(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors"
                      >
                        <Plus size={11} /> Log Transaction
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search task, notes, subtasks…"
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-700 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500">
                      <option value="ALL">All statuses</option>
                      <option value="COMPLETION">Completion</option>
                      <option value="PENDING">Pending</option>
                      <option value="ESCALATION">Escalation</option>
                      <option value="HOLD">Hold</option>
                    </select>
                    <select value={filterDocType} onChange={e => setFilterDocType(e.target.value)} className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500">
                      <option value="ALL">All task types</option>
                      {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                    </select>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as typeof filterCategory)} className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500">
                      <option value="ALL">All categories</option>
                      <option value="Production">Production</option>
                      <option value="Non-Production">Non-Production</option>
                    </select>
                    {(searchQuery || filterStatus !== "ALL" || filterDocType !== "ALL" || filterCategory !== "ALL") && (
                      <button onClick={() => { setSearchQuery(""); setFilterStatus("ALL"); setFilterDocType("ALL"); setFilterCategory("ALL"); }} className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-xs font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap">Clear</button>
                    )}
                  </div>

                {/* Task type summary — split by Production / Non-Production */}
{Object.keys(docTypeCountMap).length > 0 && (() => {
  // Build merged counts with category tracking
  const mergedProd:    Record<string, { count: number; countType: CountType }> = {};
  const mergedNonProd: Record<string, { count: number; countType: CountType }> = {};

  transactions.forEach(tx => {
    const category = tx.taskCategory ?? "Production";
    const add      = tx.countType === "volume" ? (tx.volume ?? 1) : 1;
    const ct       = (tx.countType ?? "transaction") as CountType;
    if (category === "Production") {
      mergedProd[tx.docType] = { count: (mergedProd[tx.docType]?.count ?? 0) + add, countType: ct };
    } else {
      mergedNonProd[tx.docType] = { count: (mergedNonProd[tx.docType]?.count ?? 0) + add, countType: ct };
    }
  });

  transactions.forEach(tx => {
    (tx.subtasks ?? []).forEach(st => {
      // Fall back to parent tx category if subtask has no explicit category
      const category = st.taskCategory ?? tx.taskCategory ?? "Production";
      const add      = st.countType === "volume" ? (st.number ?? 1) : 1;
      const ct       = (st.countType ?? "transaction") as CountType;
      if (category === "Production") {
        mergedProd[st.docType] = { count: (mergedProd[st.docType]?.count ?? 0) + add, countType: ct };
      } else {
        mergedNonProd[st.docType] = { count: (mergedNonProd[st.docType]?.count ?? 0) + add, countType: ct };
      }
    });
  });

  const prodEntries    = Object.entries(mergedProd);
  const nonProdEntries = Object.entries(mergedNonProd);

  const renderTable = (
    entries: [string, { count: number; countType: CountType }][],
    label: string,
    isProduction: boolean
  ) => {
    if (entries.length === 0) return null;
    return (
      <div className="rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-[11px]">
        {/* Section header */}
        <div className={`px-2.5 py-1 flex items-center gap-1.5 border-b border-slate-200 dark:border-zinc-700 ${
          isProduction
            ? "bg-indigo-50 dark:bg-indigo-950/30"
            : "bg-slate-100 dark:bg-zinc-800"
        }`}>
          <span className="text-[10px]">{isProduction ? "⚙" : "✉"}</span>
          <span className={`font-bold uppercase tracking-wider text-[9px] ${
            isProduction ? "text-indigo-500" : "text-slate-400 dark:text-zinc-500"
          }`}>{label}</span>
        </div>
        <table className="border-collapse w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800/50">
              <th className="px-2.5 py-1 text-left font-semibold text-slate-500 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-700 whitespace-nowrap">Task Type</th>
              <th className="px-2.5 py-1 text-center font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">Count</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, { count, countType }], i) => (
              <tr key={name} className={i < entries.length - 1 ? "border-t border-slate-100 dark:border-zinc-800" : ""}>
                <td className="px-2.5 py-1 text-slate-600 dark:text-zinc-300 border-r border-slate-200 dark:border-zinc-700 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {name}
                    <CountTypeBadge countType={countType} />
                  </div>
                </td>
                <td className={`px-2.5 py-1 text-center font-bold whitespace-nowrap ${
                  isProduction ? "text-indigo-500 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400"
                }`}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="pt-0.5 flex gap-2">
      {renderTable(prodEntries, "Production", true)}
      {renderTable(nonProdEntries, "Non-Production", false)}
    </div>
  );
})()}

                  {/* Hold summary */}
                  {stats.hold > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200">
                      <PauseCircle size={12} className="text-sky-500" />
                      <span className="text-[11px] text-sky-600 font-semibold">{stats.hold} transaction{stats.hold > 1 ? "s" : ""} on hold</span>
                      <span className="text-[11px] text-sky-400">— click Resume on each to continue</span>
                    </div>
                  )}
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-700">
                      {["#", "Type of Task", "Category", "Status", "Notes","Actions", ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx, i) => (
                      <TxTableRow
  key={tx._id}
  tx={tx}
  index={i}
  docTypeCount={docTypeCountMap[tx.docType] ?? 1}
  subtaskDocTypeTotals={subtaskDocTypeTotals}
  docTypes={docTypes}
  onEdit={openEdit}
  onDelete={setDeletingId}
  onTxUpdated={handleTxUpdated}
  onResume={handleResume}
/>
                    ))}

                    {filteredTransactions.length === 0 && transactions.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center">
                          <p className="text-sm text-slate-400 dark:text-zinc-500">No transactions match your filters.</p>
                          <button onClick={() => { setSearchQuery(""); setFilterStatus("ALL"); setFilterDocType("ALL"); setFilterCategory("ALL"); }} className="mt-2 text-xs text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 transition-colors">Clear filters</button>
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

      {/* ── Log Transaction Modal ── */}
      {selectedAgent && (
        <LogTransactionModal
          open={showLogModal}
          onClose={() => { setShowLogModal(false); resetForm(); }}
          docTypes={docTypes}
          selectedAgent={selectedAgent}
          date={date}
          resumingTxId={resumingTxId}
          docType={docType}
          companyName={companyName}
          volume={volume}
          notes={notes}
          taskCategory={taskCategory}
          txStatus={txStatus}
          formSubtasks={formSubtasks}
          submitting={submitting}
          formError={formError}
          saveSuccess={saveSuccess}
          onDocTypeChange={handleDocTypeChange}
          onCompanyNameChange={setCompanyName}
          onVolumeChange={setVolume}
          onNotesChange={setNotes}
          onTxStatusChange={setTxStatus}
          onFormSubtasksChange={setFormSubtasks}
          onSave={handleSave}
          onCancelResume={() => {
            setResumingTxId(null);
            setCompanyName(""); setNotes(""); setVolume("1");
            setTxStatus("COMPLETION"); setFormSubtasks([]);
            if (docTypes.length > 0) {
              setDocType(docTypes[0].name);
              setTaskCategory(docTypes[0].taskCategory ?? "Production");
            }
          }}
        />
      )}

      {/* ── Settings modal ── */}
{showSettings && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[540px] max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
      <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-5">Manage Setup</h2>

      {/* Agents section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-indigo-500" />
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 uppercase tracking-wider">Agents</p>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={newAgent} onChange={e => setNewAgent(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Agent name…" className={inputCls} />
          <input value={newAgentGroup} onChange={e => setNewAgentGroup(e.target.value)} onKeyDown={e => e.key === "Enter" && addAgent()} placeholder="Group…" className="w-32 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400" />
          <button onClick={addAgent} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
        </div>
        <div className="space-y-1.5">
          {agents.map(a => (
            <div key={a._id} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm text-slate-700 dark:text-zinc-200 truncate">{a.name}</span>
                {a.group && <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-500 text-[10px] font-semibold">{a.group}</span>}
              </div>
              <input value={a.group ?? ""} onChange={e => setAgents(prev => prev.map(ag => ag._id === a._id ? { ...ag, group: e.target.value } : ag))}
                onBlur={e => updateAgentGroup(a._id, e.target.value.trim())}
                onKeyDown={e => { if (e.key === "Enter") { updateAgentGroup(a._id, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).blur(); } }}
                placeholder="No group" className="w-24 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-zinc-200 focus:outline-none focus:border-indigo-400" />
              <button onClick={() => deleteAgent(a._id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Task Types section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Tag size={13} className="text-indigo-500" />
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 uppercase tracking-wider">Task Types</p>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={newDocType} onChange={e => setNewDocType(e.target.value)} onKeyDown={e => e.key === "Enter" && addDocType()} placeholder="Task type name…" className={inputCls} />
          <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold flex-shrink-0">
            <button type="button" onClick={() => setNewDocTypeCategory("Production")} className={`px-2.5 py-2 transition-colors ${newDocTypeCategory === "Production" ? "bg-indigo-50 text-indigo-600 border-r border-indigo-200" : "text-slate-400 hover:bg-slate-50 border-r border-slate-200"}`}>⚙ Prod</button>
            <button type="button" onClick={() => setNewDocTypeCategory("Non-Production")} className={`px-2.5 py-2 transition-colors ${newDocTypeCategory === "Non-Production" ? "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300" : "text-slate-400 hover:bg-slate-50"}`}>✉ Non</button>
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold flex-shrink-0">
            <button type="button" onClick={() => setNewDocTypeCountType("transaction")} className={`px-2.5 py-2 transition-colors ${newDocTypeCountType === "transaction" ? "bg-indigo-50 text-indigo-600 border-r border-indigo-200" : "text-slate-400 hover:bg-slate-50 border-r border-slate-200"}`}># TX</button>
            <button type="button" onClick={() => setNewDocTypeCountType("volume")} className={`px-2.5 py-2 transition-colors ${newDocTypeCountType === "volume" ? "bg-emerald-50 text-emerald-600" : "text-slate-400 hover:bg-slate-50"}`}>Vol</button>
          </div>
          <button onClick={addDocType} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Add</button>
        </div>

        <div className="space-y-1.5">
          {docTypes.map(dt => (
            <div key={dt._id} className="rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
              {editingDocTypeId === dt._id ? (
                <div className="flex flex-wrap items-center gap-2 bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2.5">
                  <input
                    value={editDocTypeName}
                    onChange={e => setEditDocTypeName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") updateDocType(dt._id); if (e.key === "Escape") setEditingDocTypeId(null); }}
                    autoFocus
                    className="flex-1 min-w-[120px] bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                  <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold flex-shrink-0">
                    <button type="button" onClick={() => setEditDocTypeCategory("Production")} className={`px-2.5 py-1.5 transition-colors ${editDocTypeCategory === "Production" ? "bg-indigo-100 text-indigo-600 border-r border-indigo-200" : "text-slate-400 hover:bg-slate-50 border-r border-slate-200 dark:border-zinc-600"}`}>⚙ Prod</button>
                    <button type="button" onClick={() => setEditDocTypeCategory("Non-Production")} className={`px-2.5 py-1.5 transition-colors ${editDocTypeCategory === "Non-Production" ? "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300" : "text-slate-400 hover:bg-slate-50"}`}>✉ Non</button>
                  </div>
                  <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold flex-shrink-0">
                    <button type="button" onClick={() => setEditDocTypeCountType("transaction")} className={`px-2.5 py-1.5 transition-colors ${editDocTypeCountType === "transaction" ? "bg-indigo-100 text-indigo-600 border-r border-indigo-200" : "text-slate-400 hover:bg-slate-50 border-r border-slate-200 dark:border-zinc-600"}`}># TX</button>
                    <button type="button" onClick={() => setEditDocTypeCountType("volume")} className={`px-2.5 py-1.5 transition-colors ${editDocTypeCountType === "volume" ? "bg-emerald-50 text-emerald-600" : "text-slate-400 hover:bg-slate-50"}`}>Vol</button>
                  </div>
                  <button onClick={() => updateDocType(dt._id)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">Save</button>
                  <button onClick={() => setEditingDocTypeId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"><X size={13} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-zinc-200">{dt.name}</span>
                    <CategoryBadge category={dt.taskCategory ?? "Production"} />
                    <CountTypeBadge countType={dt.countType ?? "transaction"} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingDocTypeId(dt._id);
                        setEditDocTypeName(dt.name);
                        setEditDocTypeCategory(dt.taskCategory ?? "Production");
                        setEditDocTypeCountType(dt.countType ?? "transaction");
                      }}
                      className="text-slate-300 dark:text-zinc-600 hover:text-indigo-500 transition-colors"
                      title="Edit task type"
                    ><Pencil size={13} /></button>
                    <button onClick={() => deleteDocType(dt._id)} className="text-slate-300 dark:text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setShowSettings(false)} className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Done</button>
    </div>
  </div>
)}
      

      {/* ── Edit Transaction modal ── */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setEditingTx(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-4">Edit Transaction</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Type of Task</label>
                <select value={editDocType} onChange={e => handleEditDocTypeChange(e.target.value)} className={selectCls}>
                  <option value="">Select type…</option>
                  {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                </select>
                {editDocType && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Category:</span>
                    <CategoryBadge category={editTaskCategory} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Company Name</label>
                <input value={editCompanyName} onChange={e => setEditCompanyName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">No. of Employees / Volume</label>
                <input type="number" min="1" value={editVolume} onChange={e => setEditVolume(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">Status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["COMPLETION", "PENDING", "ESCALATION", "HOLD"] as const).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button key={s} type="button" onClick={() => setEditStatus(s)} className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${editStatus === s ? `${cfg.color} ${cfg.bg}` : "border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Notes (optional)</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingTx(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">{editSubmitting ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation modal ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[360px] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                <Trash2 size={15} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Delete Transaction</h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">This will also delete all subtasks.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={deleteTx} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}