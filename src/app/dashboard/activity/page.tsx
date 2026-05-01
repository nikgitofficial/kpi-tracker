"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AgentLeaderboard } from "@/components/ui/AgentLeaderboard";
import { PageSkeleton } from "@/components/ui/Skeleton";
import {
  Activity, TrendingUp, CheckCircle2, Clock,
  AlertTriangle, Users, FileText, ChevronDown, PauseCircle, Timer,
  Play, Coffee, Zap, LayoutGrid, List, Square, LogIn, LogOut,
  Pause, RefreshCw,
} from "lucide-react";


/* ─── Types ─── */
interface Transaction {
  _id: string;
  txId: string;
  agentName: string;
  agentId: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  endTime?: string;
  tat?: number;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  notes?: string;
  date: string;
  taskCategory?: "Production" | "Non-Production";
  productiveSeconds?: number;
  countType?: "transaction" | "volume";
  ownerEmail?: string;
  subtasks?: { _id: string; docType: string; status: string }[]; 
}

interface TimerRecord {
  _id: string;
  agentId: string;
  agentName: string;
  date: string;
  productiveSeconds: number;
  timerStartEpoch: number | null;
  timerPaused: boolean;
}

interface Agent {
  _id: string;
  name: string;
  group?: string;
}

interface BreakEntry {
  _id: string;
  type: "BIO";
  startEpoch: number;
  endEpoch?: number;
  durationSeconds?: number;
}

interface AgentSession {
  _id: string;
  sessionStartEpoch: number;
  sessionEndEpoch?: number;
  breaks: BreakEntry[];
  totalBreakSeconds: number;
}

interface AgentStatus {
  agent: Agent;
  session: AgentSession | null;
  transactions: Transaction[];
  productiveSeconds: number;
  timerPaused: boolean;
  /** True if a timer record exists for this agent today (even if paused or at 0). */
  timerExists: boolean;
  isOnBreak: boolean;
  isActive: boolean;
}

/* ─── Helpers ─── */
function formatHms(sec?: number): string {
  if (sec == null || isNaN(sec)) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function relativeDate(dateStr: string): string {
  const t = today();
  const y = daysAgo(1);
  if (dateStr === t) return "Today";
  if (dateStr === y) return "Yesterday";
  return formatDate(dateStr);
}

/**
 * Compute live productive seconds from a raw timer record.
 * Keeps the calculation in one place so the timeline and status
 * views always agree.
 */
function calcProductiveSeconds(timer: TimerRecord | null | undefined): number {
  if (!timer) return 0;
  let secs = timer.productiveSeconds ?? 0;
  if (timer.timerStartEpoch && !timer.timerPaused) {
    secs += Math.floor((Date.now() - timer.timerStartEpoch) / 1000);
  }
  return secs;
}

const AVATAR_COLORS = [
  { bg: "bg-indigo-100 dark:bg-indigo-950", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-violet-100 dark:bg-violet-950", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-rose-100 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-950", text: "text-cyan-700 dark:text-cyan-300" },
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_CONFIG = {
  COMPLETION: {
    label: "Completion",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  PENDING: {
    label: "Pending",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  ESCALATION: {
    label: "Escalation",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  HOLD: {
    label: "Hold",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
} as const;

/* ─── Live tick ─── */
function useTick(ms = 1000) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

/* ─── Action Button ─── */
type ActionVariant = "emerald" | "amber" | "red" | "indigo" | "slate" | "blue";

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  variant: ActionVariant;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}

const VARIANT_STYLES: Record<ActionVariant, string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60",
  amber:   "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60",
  red:     "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60",
  indigo:  "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60",
  slate:   "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700",
  blue:    "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60",
};

function ActionButton({ icon: Icon, label, variant, onClick, loading, disabled, small }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-1.5 border rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
        ${small ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-[11px]"}
        ${VARIANT_STYLES[variant]}
      `}
    >
      {loading
        ? <RefreshCw size={small ? 9 : 10} className="animate-spin" />
        : <Icon size={small ? 9 : 10} />
      }
      {label}
    </button>
  );
}

/* ─── Confirm modal ─── */
interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <p className="text-sm text-slate-700 dark:text-zinc-200 font-medium mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
/* ─── Summary Card (collapsible names) ─── */
interface SummaryCardProps {
  label: string;
  value: number;
  color: string;
  bg: string;
  dot: string;
  ping: boolean;
  names: string[];
  sub?: string;
}

function SummaryCard({ label, value, color, bg, dot, ping, names, sub }: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-2xl px-4 py-3.5 ${bg}`}>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full block ${dot}`} />
          {ping && <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-60`} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
            {sub && (
              <p className={`text-xs font-mono font-semibold leading-none ${color} opacity-80`}>{sub}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
        </div>
        {names.length > 0 && (
          <button
            onClick={() => setExpanded(x => !x)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex-shrink-0 transition-colors ${color} opacity-60 hover:opacity-100 border-current`}
          >
            {expanded ? "▲" : `▼ ${names.length}`}
          </button>
        )}
      </div>
      {expanded && names.length > 0 && (
        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex flex-col gap-0.5">
          {names.map(name => (
            <span key={name} className={`text-[10px] font-medium truncate ${color} opacity-70`}>· {name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Agent Status Card ─── */
interface AgentStatusCardProps {
  status: AgentStatus;
  index: number;
  onRefresh: () => void;
}

function AgentStatusCard({ status, onRefresh }: AgentStatusCardProps) {
  // 1-second tick so productive time and break time update live in this card.
  useTick(1000);

  const { agent, session, transactions, isOnBreak, isActive, productiveSeconds, timerPaused, timerExists } = status;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);

  /* ── Live break seconds (ongoing break only, computed each render tick) ── */
  const liveBreakSeconds = (() => {
    if (!session) return 0;
    const ongoing = session.breaks.find(b => !b.endEpoch);
    if (!ongoing) return 0;
    return Math.floor((Date.now() - ongoing.startEpoch) / 1000);
  })();

  // totalBreakSeconds = completed breaks (stored) + ongoing break (live)
  const totalBreakSeconds = (session?.totalBreakSeconds ?? 0) + liveBreakSeconds;
  const completedBreaks   = session?.breaks.filter(b => b.endEpoch).length ?? 0;

  // Exclude __PROD_TIMER__ pseudo-records from TX counts
  
const realTx  = transactions.filter(t => t.docType !== "__PROD_TIMER__");
const subtaskItems = realTx.flatMap(t =>
  (t.subtasks ?? []).map(st => ({ ...st, parentStatus: t.status }))
);

const done    = realTx.filter(t => t.status === "COMPLETION").length
              + subtaskItems.filter(st => st.parentStatus === "COMPLETION").length;
const pending = realTx.filter(t => t.status === "PENDING").length
              + subtaskItems.filter(st => st.parentStatus === "PENDING").length;
const hold    = realTx.filter(t => t.status === "HOLD").length
              + subtaskItems.filter(st => st.parentStatus === "HOLD").length;
const esc     = realTx.filter(t => t.status === "ESCALATION").length
              + subtaskItems.filter(st => st.parentStatus === "ESCALATION").length;
const totalTx = realTx.length + subtaskItems.length;

  const docTypeMap: Record<string, number> = {};
realTx.forEach(t => {
  docTypeMap[t.docType] = (docTypeMap[t.docType] ?? 0) + 1;
  (t.subtasks ?? []).forEach(st => {
    docTypeMap[st.docType] = (docTypeMap[st.docType] ?? 0) + 1;
  });
});
const docTypeEntries = Object.entries(docTypeMap).sort((a, b) => b[1] - a[1]);

  const SHIFT_SECONDS = 8 * 3600;
  const prodPct       = Math.min(100, Math.round((productiveSeconds / SHIFT_SECONDS) * 100));
  const av            = avatarColor(agent.name);
  const sessionEnded  = !!(session?.sessionEndEpoch);

  /* ── Generic API caller ── */
  const callApi = async (key: string, url: string, body: object) => {
    setActionLoading(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await onRefresh();
    } catch (err) {
      console.error(`Action ${key} failed:`, err);
      alert(`Action failed: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSession = () =>
    callApi("start-session", "/api/kpi/session/start", { agentId: agent._id, date: today() });

  const handleEndSession = () =>
    setConfirm({
      message: `End session for ${agent.name}? This will clock them out for today.`,
      action: () => callApi("end-session", "/api/kpi/session/end", { agentId: agent._id, date: today() }),
    });

  const handleStartBreak = () =>
    callApi("start-break", "/api/kpi/session/break/start", { agentId: agent._id });

  const handleEndBreak = () =>
    callApi("end-break", "/api/kpi/session/break/end", { agentId: agent._id });

  const handlePauseTimer = () =>
    callApi("pause-timer", "/api/kpi/timer/pause", { agentId: agent._id, date: today() });

  const handleResumeTimer = () =>
    callApi("resume-timer", "/api/kpi/timer/resume", { agentId: agent._id, date: today() });

  // Derived paused state (not on break, timer explicitly paused)
  const isPaused = timerExists && timerPaused && !isOnBreak;

  return (
    <>
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Card border reflects state: paused = violet, break = amber, active = emerald ── */}
      <div className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${
        isOnBreak
          ? "border-amber-200 dark:border-amber-800"
          : isPaused
          ? "border-violet-200 dark:border-violet-800"
          : isActive
          ? "border-emerald-200 dark:border-emerald-800"
          : sessionEnded
          ? "border-slate-200 dark:border-zinc-700 opacity-75"
          : "border-slate-200 dark:border-zinc-700"
      }`}>

        {/* ── Top accent bar ── */}
        <div className={`h-1 w-full ${
          isOnBreak    ? "bg-amber-400" :
          isPaused     ? "bg-violet-500" :
          isActive     ? "bg-emerald-500" :
          sessionEnded ? "bg-slate-300 dark:bg-zinc-600" :
                         "bg-slate-200 dark:bg-zinc-700"
        }`} />

        {/* Card header */}
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{agent.name}</p>
            {agent.group && <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{agent.group}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOnBreak ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Break
              </span>
            ) : isPaused ? (
              // ── Paused badge ──
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Paused
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Working
              </span>
            ) : sessionEnded ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Clocked out
              </span>
            ) : null}
          </div>
        </div>

        {/* TX stats */}
        <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-zinc-800 border-b border-slate-100 dark:border-zinc-800">
          {[
            { label: "TX",      value: totalTx,  color: "text-slate-700 dark:text-zinc-200"     },
            { label: "Done",    value: done,     color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Pending", value: pending,  color: "text-amber-600 dark:text-amber-400"     },
            { label: "Hold",    value: hold,     color: "text-blue-500 dark:text-blue-400"       },
            { label: "Esc",     value: esc,      color: "text-purple-600 dark:text-purple-400"   },
          ].map(s => (
            <div key={s.label} className="py-2.5 text-center">
              <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Task type breakdown */}
      {docTypeEntries.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-zinc-600 mb-2">
            Task Breakdown
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800">
                <th className="text-left text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 pb-1">
                  Task Type
                </th>
                <th className="text-right text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 pb-1">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {docTypeEntries.map(([name, count], i) => {
  const isSubtaskOnly = !realTx.some(t => t.docType === name);
  const isParent = realTx.some(t => t.docType === name);
  const hasSubtaskOccurrence = realTx.some(t =>
    (t.subtasks ?? []).some(st => st.docType === name)
  );
  const showSubBadge = hasSubtaskOccurrence && !isParent;

  return (
    <tr
      key={name}
      className={i < docTypeEntries.length - 1
        ? "border-b border-slate-50 dark:border-zinc-800/50"
        : ""}
    >
      <td className="py-1 text-[10px] text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">
        <div className="flex items-center gap-1">
          {name}
          {showSubBadge && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-500 dark:text-violet-400 flex-shrink-0">
              SUBTASK
            </span>
          )}
        </div>
      </td>
      <td className="py-1 text-right text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
        {count}
      </td>
    </tr>
  );
})}
            </tbody>
          </table>
        </div>
      )}

        {/* Productive time bar */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              <Zap size={9} className="text-emerald-500" />
              Productive
              {timerExists && timerPaused && (
                <span className="ml-1 px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 text-[9px] font-bold">
                  PAUSED
                </span>
              )}
            </span>
            <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatHms(productiveSeconds)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isPaused     ? "bg-violet-500" :
                isOnBreak    ? "bg-amber-400" :
                isActive     ? "bg-emerald-500" :
                               "bg-slate-300 dark:bg-zinc-600"
              }`}
              style={{ width: `${prodPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-slate-400 dark:text-zinc-600">{prodPct}% of shift</span>
            <span className="text-[9px] text-slate-400 dark:text-zinc-600">8h target</span>
          </div>
        </div>

        {/* Break info */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              <Coffee size={9} className="text-amber-500" />
              Bio breaks
            </span>
            <div className="flex items-center gap-2">
              {isOnBreak && (
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                  {formatHms(liveBreakSeconds)} live
                </span>
              )}
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                {completedBreaks} done · {formatHms(totalBreakSeconds)} total
              </span>
            </div>
          </div>

          {session && session.breaks.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.breaks.map((b, i) => (
                <span
                  key={b._id}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                    !b.endEpoch
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  #{i + 1} {b.endEpoch ? formatHms(b.durationSeconds) : "live"}
                </span>
              ))}
            </div>
          )}

          {!session && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 italic">No session started</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-zinc-600 mb-2">Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {!session && (
              <ActionButton
                icon={LogIn} label="Start Session" variant="emerald"
                onClick={handleStartSession} loading={actionLoading === "start-session"} small
              />
            )}
            {session && !sessionEnded && (
              <ActionButton
                icon={LogOut} label="Clock Out" variant="red"
                onClick={handleEndSession} loading={actionLoading === "end-session"} small
              />
            )}
            {session && !sessionEnded && !isOnBreak && (
              <ActionButton
                icon={Coffee} label="Start Break" variant="amber"
                onClick={handleStartBreak} loading={actionLoading === "start-break"} small
              />
            )}
            {isOnBreak && (
              <ActionButton
                icon={Play} label="End Break" variant="emerald"
                onClick={handleEndBreak} loading={actionLoading === "end-break"} small
              />
            )}
            {/* Pause timer: only when timer exists, is not paused, agent is active, and not on break */}
            {timerExists && !timerPaused && isActive && !isOnBreak && (
              <ActionButton
                icon={Pause} label="Pause Timer" variant="slate"
                onClick={handlePauseTimer} loading={actionLoading === "pause-timer"} small
              />
            )}
            {/* Resume timer: only when timer exists and is paused */}
            {timerExists && timerPaused && (
              <ActionButton
                icon={Play} label="Resume Timer" variant="indigo"
                onClick={handleResumeTimer} loading={actionLoading === "resume-timer"} small
              />
            )}
            {sessionEnded && (
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 italic py-1">Session ended for today.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════
   ─── Helpers for timer state
═══════════════════════════════════ */
interface LiveTimerState {
  productiveSeconds: number;
  timerPaused: boolean;
  timerExists: boolean;
}

function extractTimerState(timerRecord: TimerRecord | null | undefined): LiveTimerState {
  if (!timerRecord) {
    return { productiveSeconds: 0, timerPaused: false, timerExists: false };
  }
  return {
    productiveSeconds: calcProductiveSeconds(timerRecord),
    timerPaused: timerRecord.timerPaused ?? false,
    timerExists: true,
  };
}

/* ═══════════════════════════════════
   ─── Main Activity Page
═══════════════════════════════════ */
export default function ActivityPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  /**
   * timerMap stores the *raw* timer records from the API (no live offset applied).
   * Live seconds are computed on render via calcProductiveSeconds().
   * This ensures the timeline and status views always use the same formula.
   */
  const [timerMap, setTimerMap] = useState<Record<string, TimerRecord>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Record<string, AgentSession | null>>({});
  const [agentTxMap, setAgentTxMap] = useState<Record<string, Transaction[]>>({});
  /**
   * Raw timer records per agent for the status view (today only).
   * Live seconds are derived at render time; we never store a pre-computed
   * "live" value here to avoid stale state between auto-refresh ticks.
   */
  const [agentTimerMap, setAgentTimerMap] = useState<Record<string, TimerRecord | null>>({});
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"timeline" | "status">("status");
  const PAGE_SIZE = 15;

  // 1-second tick for live productive-time display in the timeline agent pills
  useTick(1000);
  // 10-second tick triggers the background status refresh
  const statusTick = useTick(10000);

  /* ── Fetch timeline transactions and timers ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/kpi/transactions?from=${from}&to=${to}`).then(r => r.json()),
      fetch("/api/kpi/agents").then(r => r.json()),
      fetch(`/api/kpi/productivity-timers?from=${from}&to=${to}`).then(r => r.json()),
    ])
      .then(([txData, agentData, timerData]) => {
        const allTx: Transaction[] = txData.transactions ?? [];
        const realTx = allTx.filter(t => t.docType !== "__PROD_TIMER__");

        // Store raw timer records; live seconds computed at render time.
        const timers: TimerRecord[] = timerData.timers ?? [];
        const rawTimerMap: Record<string, TimerRecord> = {};
        for (const timer of timers) {
          rawTimerMap[timer.agentId] = timer;
        }

        setTransactions(realTx);
        setTimerMap(rawTimerMap);
        setAgents(agentData.agents ?? []);
        setLoading(false);
        setPage(1);
      })
      .catch(err => {
        console.error("Failed to fetch data:", err);
        setLoading(false);
      });
  }, [from, to]);

  /* ── Fetch live agent status (runs once agents are loaded, then every 10s) ── */
  const fetchAgentStatus = useCallback(async (agentList: Agent[]) => {
    if (agentList.length === 0) return;
    setStatusLoading(true);
    const dateStr = today();

    const results = await Promise.all(
      agentList.map(async (agent) => {
        const [txRes, sessionRes, timerRes] = await Promise.all([
          fetch(`/api/kpi/transactions?date=${dateStr}&agentId=${agent._id}`).then(r => r.json()),
          fetch(`/api/kpi/session?agentId=${agent._id}&date=${dateStr}`).then(r => r.json()),
          fetch(`/api/kpi/productivity-timer?agentId=${agent._id}&date=${dateStr}`).then(r => r.json()),
        ]);

        return {
          agentId: agent._id,
          txs: (txRes.transactions ?? []) as Transaction[],
          session: (sessionRes.session ?? null) as AgentSession | null,
          // Store the raw record; live seconds derived at render time.
          timerRecord: (timerRes.record ?? null) as TimerRecord | null,
        };
      })
    );

    const txMap: Record<string, Transaction[]> = {};
    const sessionMap: Record<string, AgentSession | null> = {};
    const timerRecordMap: Record<string, TimerRecord | null> = {};

    for (const r of results) {
      txMap[r.agentId]          = r.txs;
      sessionMap[r.agentId]     = r.session;
      timerRecordMap[r.agentId] = r.timerRecord;
    }

    setAgentTxMap(txMap);
    setSessions(sessionMap);
    setAgentTimerMap(timerRecordMap);
    setStatusLoading(false);
  }, []);

  // Trigger full status refresh when agents first load or on 10s tick.
  useEffect(() => {
    if (agents.length > 0) fetchAgentStatus(agents);
  }, [agents, fetchAgentStatus, statusTick]);

  /* Per-agent refresh after manual actions (avoids full-team re-fetch) */
  const refreshAgent = useCallback(async (agentId: string) => {
    const dateStr = today();
    const [txRes, sessionRes, timerRes] = await Promise.all([
      fetch(`/api/kpi/transactions?date=${dateStr}&agentId=${agentId}`).then(r => r.json()),
      fetch(`/api/kpi/session?agentId=${agentId}&date=${dateStr}`).then(r => r.json()),
      fetch(`/api/kpi/productivity-timer?agentId=${agentId}&date=${dateStr}`).then(r => r.json()),
    ]);

    setAgentTxMap(prev    => ({ ...prev, [agentId]: txRes.transactions ?? [] }));
    setSessions(prev      => ({ ...prev, [agentId]: sessionRes.session ?? null }));
    setAgentTimerMap(prev => ({ ...prev, [agentId]: timerRes.record ?? null }));
  }, []);

  /* ── Build agent statuses for the status view ── */
const agentStatuses: AgentStatus[] = agents
  .map(agent => {
    const session = sessions[agent._id] ?? null;
    const txs     = agentTxMap[agent._id] ?? [];

    const isOnBreak = !!(session?.breaks.find(b => !b.endEpoch));
    const timerRaw  = agentTimerMap[agent._id];
    const timerIsRunning = !!(timerRaw && timerRaw.timerStartEpoch && !timerRaw.timerPaused);
    const isActive = !!(
      (session && !session.sessionEndEpoch && !isOnBreak && timerIsRunning) || timerIsRunning
    );

    const { productiveSeconds, timerPaused, timerExists } =
      extractTimerState(timerRaw);

    return {
      agent,
      session,
      transactions: txs,
      productiveSeconds,
      timerPaused,
      timerExists,
      isOnBreak,
      isActive,
    };
  })
   .sort((a, b) => {
   const realA = a.transactions.filter(t => t.docType !== "__PROD_TIMER__");
const realB = b.transactions.filter(t => t.docType !== "__PROD_TIMER__");

const doneA = realA.filter(t => t.status === "COMPLETION").length
            + realA.flatMap(t => t.subtasks ?? []).filter(st =>
                realA.find(t => (t.subtasks ?? []).some(s => s._id === st._id))?.status === "COMPLETION"
              ).length;
const doneB = realB.filter(t => t.status === "COMPLETION").length
            + realB.flatMap(t => t.subtasks ?? []).filter(st =>
                realB.find(t => (t.subtasks ?? []).some(s => s._id === st._id))?.status === "COMPLETION"
              ).length;

const totalTxA = realA.reduce((s, t) => s + 1 + (t.subtasks?.length ?? 0), 0);
const totalTxB = realB.reduce((s, t) => s + 1 + (t.subtasks?.length ?? 0), 0);
const escA = realA.filter(t => t.status === "ESCALATION").length;
const escB = realB.filter(t => t.status === "ESCALATION").length;
const ptsA = (doneA * 10) + (totalTxA * 2) - (escA * 3);
const ptsB = (doneB * 10) + (totalTxB * 2) - (escB * 3);
    return ptsB - ptsA;
  });
  

  /* ── Team summary counts ── */
  const activeCount     = agentStatuses.filter(s => s.isActive).length;
  const breakCount      = agentStatuses.filter(s => s.isOnBreak).length;
  const pausedCount     = agentStatuses.filter(s => s.timerExists && s.timerPaused && !s.isOnBreak).length;
  const clockedOutCount = agentStatuses.filter(s => s.session && !!s.session.sessionEndEpoch).length;
  const activeAgents    = agentStatuses.filter(s => s.isActive).map(s => s.agent.name);
  const breakAgents     = agentStatuses.filter(s => s.isOnBreak).map(s => s.agent.name);
  const pausedAgents    = agentStatuses.filter(s => s.timerExists && s.timerPaused && !s.isOnBreak).map(s => s.agent.name);
  const clockedOutAgents = agentStatuses.filter(s => s.session && !!s.session.sessionEndEpoch).map(s => s.agent.name);
  // Online = timer exists today (running OR paused OR ended)
const onlineCount  = agentStatuses.filter(s => s.timerExists).length;
const offlineCount = agentStatuses.filter(s => !s.timerExists).length;
const onlineAgents  = agentStatuses.filter(s => s.timerExists).map(s => s.agent.name);
const offlineAgents = agentStatuses.filter(s => !s.timerExists).map(s => s.agent.name);
  // Sum of live productive seconds across all currently active agents (updates every 1s via useTick)
  const totalActiveProductiveSec = agentStatuses
    .filter(s => s.isActive)
    .reduce((sum, s) => sum + s.productiveSeconds, 0);

  // Today's TX count excludes __PROD_TIMER__ pseudo-records
  const totalTodayTx = Object.values(agentTxMap)
  .flat()
  .filter(t => t.docType !== "__PROD_TIMER__")
  .reduce((sum, t) => sum + 1 + (t.subtasks?.length ?? 0), 0);

  /* ── Timeline filters ── */
  const filtered = transactions.filter(tx => {
    if (filterAgent    !== "all" && tx.agentName                          !== filterAgent)    return false;
    if (filterStatus   !== "all" && tx.status                             !== filterStatus)   return false;
    if (filterCategory !== "all" && (tx.taskCategory ?? "Production")     !== filterCategory) return false;
    return true;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = filtered.length > paginated.length;

  /* ── Timeline aggregate stats ── */
  const completions    = transactions.filter(t => t.status === "COMPLETION").length;
  const escalations    = transactions.filter(t => t.status === "ESCALATION").length;
  const holds          = transactions.filter(t => t.status === "HOLD").length;
  const completionRate = transactions.length
    ? Math.round((completions / transactions.length) * 100)
    : 0;
  const totalTat = transactions.reduce((s, t) => s + (t.tat ?? 0), 0);

  // Total productive seconds across all agents for the selected date range
  const totalProductiveSec = Object.values(timerMap).reduce(
    (sum, timer) => sum + calcProductiveSeconds(timer),
    0
  );

  /* ── Group by date for timeline ── */
  const byDate: Record<string, Transaction[]> = {};
  for (const tx of paginated) {
    if (!byDate[tx.date]) byDate[tx.date] = [];
    byDate[tx.date].push(tx);
  }
  const sortedDates  = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const uniqueAgents = [...new Set(transactions.map(t => t.agentName))].sort();

  const formattedFrom = new Date(from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formattedTo   = new Date(to   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KPI</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Activity</h1>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">{formattedFrom} — {formattedTo}</p>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
            <button
              onClick={() => setView("status")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "status"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid size={12} />
              Live status
            </button>
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "timeline"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <List size={12} />
              Timeline
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            LIVE STATUS VIEW
        ══════════════════════════════════════ */}
        {view === "status" && (
          <>
            {/* ── Team summary bar — 5 cards, always in one row on md+ ── */}
            {/* ── Row 1: Status cards ── */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
  {[
    {
      label: "Working", value: activeCount,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-500", ping: activeCount > 0,
      sub: formatHms(totalActiveProductiveSec), names: activeAgents,
    },
    {
      label: "Bio-Break", value: breakCount,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500", ping: breakCount > 0, names: breakAgents,
    },
    {
      label: "Paused/Lunch", value: pausedCount,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800",
      dot: "bg-violet-500", ping: pausedCount > 0, names: pausedAgents,
    },
    {
      label: "Clocked out", value: clockedOutCount,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
      dot: "bg-rose-400", ping: false, names: clockedOutAgents,
    },
  ].map(s => <SummaryCard key={s.label} {...s} />)}
</div>

{/* ── Row 2: Summary cards ── */}
<div className="grid grid-cols-3 gap-3 mb-6">
  {[
    {
      label: "Online", value: onlineCount,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800",
      dot: "bg-teal-500", ping: onlineCount > 0, names: onlineAgents,
    },
    {
      label: "Offline", value: offlineCount,
      color: "text-slate-500 dark:text-zinc-400",
      bg: "bg-slate-100 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700",
      dot: "bg-slate-400", ping: false, names: offlineAgents,
    },
    {
      label: "TX today", value: totalTodayTx,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
      dot: "bg-indigo-500", ping: false, names: [],
    },
  ].map(s => <SummaryCard key={s.label} {...s} />)}
</div>
               {/* ── Legend — 4-column grid, always aligned ── */}
            <div className="mb-4 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 block mb-2">
                Legend
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 items-start">
                {[
                  { dot: "bg-emerald-500", bar: "bg-emerald-500",                  label: "Working — session open, timer running" },
                  { dot: "bg-amber-400",   bar: "bg-amber-400",                    label: "Bio-Break"                             },
                  { dot: "bg-violet-500",  bar: "bg-violet-500",                   label: "Timer paused (Lunch Break)"            },
                  { dot: "bg-slate-400",   bar: "bg-slate-300 dark:bg-zinc-600",   label: "No timer running or session"             },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 flex-shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.dot}`} />
                      <div className="w-10 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                        <div className={`h-full w-3/5 rounded-full ${l.bar}`} />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent cards grid */}
            {statusLoading && agents.length === 0 ? (
              <PageSkeleton />
            ) : agents.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
                <Users size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-zinc-400 text-sm">No agents found.</p>
              </div>
            ) : (
              <div className="flex gap-4 items-start">
  {/* Agent cards */}
  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
    {agentStatuses.map((s, i) => (
      <AgentStatusCard
        key={s.agent._id}
        status={s}
        index={i}
        onRefresh={() => refreshAgent(s.agent._id)}
      />
    ))}
  </div>

  {/* Leaderboard — sticky sidebar */}
  <div className="w-72 flex-shrink-0 sticky top-6">
    <AgentLeaderboard statuses={agentStatuses} />
  </div>
</div>
            )}

            <p className="text-center text-[10px] text-slate-300 dark:text-zinc-700 mt-6 uppercase tracking-widest">
              Auto-refreshes every 10s
            </p>
          </>
        )}

        {/* ══════════════════════════════════════
            TIMELINE VIEW
        ══════════════════════════════════════ */}
        {view === "timeline" && (
          <>
            {/* Date range + filters */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-zinc-500">FROM</span>
                <input
                  type="date" value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <span className="text-xs text-slate-400 dark:text-zinc-500">TO</span>
                <input
                  type="date" value={to}
                  onChange={e => setTo(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  onClick={() => { setFrom(today()); setTo(today()); }}
                  className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <select
                  value={filterAgent}
                  onChange={e => { setFilterAgent(e.target.value); setPage(1); }}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 transition-all"
                >
                  <option value="all">All agents</option>
                  {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 transition-all"
                >
                  <option value="all">All statuses</option>
                  <option value="COMPLETION">Completion</option>
                  <option value="PENDING">Pending</option>
                  <option value="HOLD">Hold</option>
                  <option value="ESCALATION">Escalation</option>
                </select>
                <select
                  value={filterCategory}
                  onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                  className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 transition-all"
                >
                  <option value="all">All categories</option>
                  <option value="Production">Production</option>
                  <option value="Non-Production">Non-Production</option>
                </select>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: "Total TX",        value: transactions.length,           icon: Activity,      color: "text-slate-700 dark:text-zinc-200"    },
                { label: "Completion rate", value: `${completionRate}%`,          icon: CheckCircle2,  color: "text-green-600 dark:text-green-400"   },
                { label: "Hold",            value: holds,                         icon: PauseCircle,   color: "text-blue-500 dark:text-blue-400"     },
                { label: "Escalations",     value: escalations,                   icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400" },
                { label: "Total TAT",       value: formatHms(totalTat),           icon: Clock,         color: "text-indigo-600 dark:text-indigo-400" },
                { label: "Productive time", value: formatHms(totalProductiveSec), icon: Timer,         color: "text-cyan-600 dark:text-cyan-400"     },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3 py-3.5 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-base font-bold leading-none truncate ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agent summary pills */}
            {agents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {agents.map(agent => {
                  const av         = avatarColor(agent.name);
                  const agentTx    = transactions.filter(t => t.agentName === agent.name);
                  const agentTat   = agentTx.reduce((s, t) => s + (t.tat ?? 0), 0);
                  const agentCompl = agentTx.filter(t => t.status === "COMPLETION").length;
                  const agentHold  = agentTx.filter(t => t.status === "HOLD").length;
                  const isSelected = filterAgent === agent.name;

                  // Productive time for this agent across the selected date range
                  const agentProd = timerMap[agent._id]
                    ? calcProductiveSeconds(timerMap[agent._id])
                    : null;

                  return (
                    <button
                      key={agent._id}
                      onClick={() => { setFilterAgent(isSelected ? "all" : agent.name); setPage(1); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span>{agent.name}</span>
                      {agent.group && (
                        <span className="text-slate-400 dark:text-zinc-500">· {agent.group}</span>
                      )}
                      <span className="text-slate-300 dark:text-zinc-600">|</span>
                      <span>{agentTx.length} TX</span>
                      <span className="text-green-600 dark:text-green-400">{agentCompl} done</span>
                      {agentHold > 0 && (
                        <span className="text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                          <PauseCircle size={9} />{agentHold}
                        </span>
                      )}
                      {/* Show productive time if available, otherwise fall back to TAT */}
                      {agentProd !== null ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-0.5">
                          <Zap size={9} />{formatHms(agentProd)}
                        </span>
                      ) : agentTat > 0 ? (
                        <span className="text-indigo-500 dark:text-indigo-400 font-mono flex items-center gap-0.5">
                          <Clock size={9} />{formatHms(agentTat)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            {loading ? (
              <PageSkeleton />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
                <Activity size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-zinc-400 text-sm">No transactions found for this period.</p>
                <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Adjust the date range or filters above.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                        {relativeDate(date)}
                      </p>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">{byDate[date].length} tx</span>
                    </div>

                    <div className="relative">
                      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200 dark:bg-zinc-700" />
                      <div className="space-y-1.5">
                        {byDate[date].map(tx => {
                          const cfg    = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG["PENDING"];
                          const isHold = tx.status === "HOLD";
                          const av     = avatarColor(tx.agentName);
                          return (
                            <div key={tx._id} className="group flex gap-4">
                              <div className="flex-shrink-0 flex items-start pt-3.5">
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center z-10 transition-all group-hover:scale-105 ${cfg.bg}`}>
                                  {isHold
                                    ? <PauseCircle size={13} className={cfg.color} />
                                    : <FileText    size={13} className={cfg.color} />
                                  }
                                </div>
                              </div>

                              <div className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-4 my-1 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:border-slate-300 dark:hover:border-zinc-600 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{tx.companyName}</p>
                                      <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
                                        {cfg.label}
                                      </span>
                                      {tx.taskCategory && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                          tx.taskCategory === "Production"
                                            ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                                            : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                                        }`}>
                                          {tx.taskCategory}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 ml-3.5">
                                      {tx.docType} · {tx.agentName}
                                      {tx.countType === "volume" ? ` · vol: ${tx.volume}` : ""}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-mono text-indigo-500 dark:text-indigo-400 font-semibold">
                                      {formatHms(tx.tat)}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                      {tx.startTime}{tx.endTime ? ` → ${tx.endTime}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
                                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
                                      {tx.agentName.slice(0, 1)}
                                    </div>
                                    {tx.agentName}
                                    {(() => {
                                      const agent = agents.find(a => a.name === tx.agentName);
                                      return agent?.group
                                        ? <span className="text-slate-400 dark:text-zinc-500 ml-1">· {agent.group}</span>
                                        : null;
                                    })()}
                                  </span>
                                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                                    <TrendingUp size={10} className="text-slate-400 dark:text-zinc-500" />
                                    Vol: {tx.volume}
                                  </span>
                                  {tx.notes && (
                                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 italic">
                                      "{tx.notes}"
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600 transition-colors text-sm font-medium"
                >
                  <ChevronDown size={14} />
                  Load more ({filtered.length - paginated.length} remaining)
                </button>
              </div>
            )}

            {/* Bottom summary */}
            {!loading && filtered.length > 0 && (
              <div className="mt-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">{filtered.length}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Transactions shown</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-indigo-500 dark:text-indigo-400 font-mono">
                      {formatHms(filtered.reduce((s, t) => s + (t.tat ?? 0), 0))}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Total TAT</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                      {(() => {
                        if (filterAgent === "all") return formatHms(totalProductiveSec);
                        const agent = agents.find(a => a.name === filterAgent);
                        if (!agent) return "—";
                        return formatHms(calcProductiveSeconds(timerMap[agent._id]));
                      })()}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Productive time</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {filtered.filter(t => t.status === "COMPLETION").length}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Completed</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}