"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AgentLeaderboard } from "@/components/ui/AgentLeaderboard";
import { createPortal } from "react-dom";
import { PageSkeleton } from "@/components/ui/Skeleton";
import {
  Plus, Trash2, Pencil, CheckCircle2,
  Clock, AlertTriangle, Users, Tag, FileText, FileSpreadsheet,
  Pause, ChevronDown, ChevronRight, ListPlus, X, Play, Square,
  Timer, PauseCircle, Check, Info, AlertCircle,Bell, Pin,Trophy,
} from "lucide-react";
import { SnackbarProvider, useSnackbar } from "@/contexts/SnackbarContext";

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

/* ═══════════════════════════════════════════════════════
   ─── Announcements Modal — Live holidays via Nager.Date
       https://date.nager.at  |  Free · No API key · CORS
   ═══════════════════════════════════════════════════════ */

// ─── Types ───────────────────────────────────────────────────────────────────

type AnnPriority = "urgent" | "info" | "normal";
type AnnTag      = "Urgent" | "Info" | "New" | "Policy" | "System";
type AnnTab      = "all" | "pinned" | "unread";

interface Announcement {
  id:        string;
  title:     string;
  body:      string;
  priority:  AnnPriority;
  tag:       AnnTag;
  pinned:    boolean;
  postedBy:  string;
  createdAt: string; // ISO date — when the announcement was posted
  eventDate: string; // ISO date — the actual holiday / event date
}

// Raw shape returned by Nager.Date
interface NagerHoliday {
  date:        string;
  name:        string;
  localName:   string;
  countryCode: string;
  global:      boolean;
  types:       string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAGER_BASE = "https://date.nager.at/api/v3/publicholidays";

/** Countries we fetch holidays for. Add more ISO codes here as needed. */
const HOLIDAY_COUNTRIES: { code: string; label: string; tag: AnnTag }[] = [
  { code: "PH", label: "PH Holiday",     tag: "Policy" },
  { code: "US", label: "US Holiday",     tag: "Info"   },
  { code: "CA", label: "Canada Holiday", tag: "Info"   },
];

/** Pinned operational reminders — always hardcoded, never from the API. */
const PINNED_ANNOUNCEMENTS: Announcement[] = [
  {
    id:        "ann-r001",
    title:     "Select your name before logging transactions",
    body:      "Always choose your name from the agent dropdown at the top before you start logging. Entries saved under the wrong agent cannot be automatically reassigned.",
    priority:  "urgent",
    tag:       "Urgent",
    pinned:    true,
    postedBy:  "DevOps",
    createdAt: "2026-04-29",
    eventDate: "2026-04-29",
  },
  {
    id:        "ann-r002",
    title:     "End your timer to calculate productivity hours",
    body:      "Click the End button on the Productivity Timer before leaving your shift. Your hours will not be recorded until the timer is properly ended — pausing alone is not enough.",
    priority:  "urgent",
    tag:       "Urgent",
    pinned:    true,
    postedBy:  "DevOps",
    createdAt: "2026-04-29",
    eventDate: "2026-04-29",
  },
  {
    id:        "ann-r003",
    title:     "Review all entries before submitting",
    body:      "Double-check task types, company names, volumes, and statuses before your end-of-day submission. Corrections after submission require supervisor or team leader approval.",
    priority:  "info",
    tag:       "Info",
    pinned:    true,
    postedBy:  "DevOps",
    createdAt: "2026-04-29",
    eventDate: "2026-04-29",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ANN_PRIORITY_DOT: Record<AnnPriority, string> = {
  urgent: "bg-red-400",
  info:   "bg-blue-400",
  normal: "bg-slate-300 dark:bg-zinc-600",
};

const ANN_TAG_STYLE: Record<AnnTag, string> = {
  Urgent: "bg-red-50 border-red-200 text-red-700",
  Info:   "bg-blue-50 border-blue-200 text-blue-700",
  New:    "bg-green-50 border-green-200 text-green-700",
  Policy: "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300",
  System: "bg-amber-50 border-amber-200 text-amber-700",
};

const annLsKey      = (k: string) => `txlog_ann_read_${k}`;
const holidayCacheKey = (year: number) => `txlog_holidays_cache_${year}`;

/** Map a Nager.Date holiday + country config into our Announcement shape. */
function nagerToAnnouncement(
  h:       NagerHoliday,
  country: typeof HOLIDAY_COUNTRIES[number],
): Announcement {
  const isRegular  = h.types.includes("Public");
  const priority: AnnPriority = isRegular ? "info" : "normal";

  // Posted 3 days before the holiday
  const eventMs    = new Date(h.date + "T00:00:00").getTime();
  const postedDate = new Date(eventMs - 3 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Short month+day label, e.g. "Jan 1"
  const label = new Date(h.date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
  });

  const kind = isRegular ? "Regular Holiday" : "Special Holiday";

  return {
    id:        `ann-api-${country.code.toLowerCase()}-${h.date}`,
    title:     `${country.label} — ${h.name} (${label})`,
    body:      `${h.date} is ${h.localName}${h.localName !== h.name ? ` (${h.name})` : ""}, a ${country.label.split(" ")[0]} ${kind}.`,
    priority,
    tag:       country.tag,
    pinned:    false,
    postedBy:  "DevOps",
    createdAt: postedDate,
    eventDate: h.date,
  };
}

/** Fetch holidays for one country+year, with localStorage caching (24h TTL). */
async function fetchHolidays(
  year:    number,
  country: typeof HOLIDAY_COUNTRIES[number],
): Promise<Announcement[]> {
  const cacheKey = `${holidayCacheKey(year)}_${country.code}`;

  // Try cache first
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, ts } = JSON.parse(cached) as { data: NagerHoliday[]; ts: number };
      // 24-hour TTL
      if (Date.now() - ts < 86_400_000) {
        return data.map((h) => nagerToAnnouncement(h, country));
      }
    }
  } catch {}

  const res  = await fetch(`${NAGER_BASE}/${year}/${country.code}`);
  if (!res.ok) return [];
  const data: NagerHoliday[] = await res.json();

  // Cache the raw API response
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  } catch {}

  return data.map((h) => nagerToAnnouncement(h, country));
}

/** Fetch current year + next year so the list stays relevant in December. */
async function fetchAllHolidays(): Promise<Announcement[]> {
  const now       = new Date();
  const thisYear  = now.getFullYear();
  const nextYear  = thisYear + 1;

  const results = await Promise.allSettled(
    HOLIDAY_COUNTRIES.flatMap((country) =>
      [thisYear, nextYear].map((year) => fetchHolidays(year, country))
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Announcement[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

// ─── Modal Component ─────────────────────────────────────────────────────────

function AnnouncementModal({
  open,
  onClose,
  storageKey = "global",
}: {
  open:        boolean;
  onClose:     () => void;
  storageKey?: string;
}) {
  const [readIds,   setReadIds]   = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<AnnTab>("all");
  const [holidays,  setHolidays]  = useState<Announcement[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState(false);

  // Restore read-state from localStorage whenever modal opens
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(annLsKey(storageKey));
      setReadIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setReadIds(new Set());
    }
  }, [open, storageKey]);

  // Fetch holiday data when modal first opens
  useEffect(() => {
    if (!open || holidays.length > 0) return;
    setLoading(true);
    setApiError(false);
    fetchAllHolidays()
  .then(results => {
    const seen = new Set<string>();
    setHolidays(
      results.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      })
    );
  })
  .catch(() => setApiError(true))
  .finally(() => setLoading(false));
  }, [open]);

  const persist = (ids: Set<string>) => {
    try {
      localStorage.setItem(annLsKey(storageKey), JSON.stringify([...ids]));
    } catch {}
  };

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set([...readIds, id]);
    setReadIds(next);
    persist(next);
  };

  const markAllRead = () => {
    const next = new Set(ALL_ANNOUNCEMENTS.map((a) => a.id));
    setReadIds(next);
    persist(next);
  };

  // Merged list: pinned reminders + live holiday announcements
 const ALL_ANNOUNCEMENTS: Announcement[] = [
  ...PINNED_ANNOUNCEMENTS,
  ...holidays,
].filter((ann, index, self) => self.findIndex(a => a.id === ann.id) === index);

  const unreadCount = ALL_ANNOUNCEMENTS.filter((a) => !readIds.has(a.id)).length;

  const filtered = ALL_ANNOUNCEMENTS
    .filter((a) => {
      if (activeTab === "pinned") return a.pinned;
      if (activeTab === "unread") return !readIds.has(a.id);
      return true;
    })
    .sort((a, b) => {
      // Pinned always floats to top
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Among pinned: newest createdAt first
      if (a.pinned && b.pinned) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Among non-pinned: sort by eventDate ascending (Jan → Dec)
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl w-[480px] max-h-[580px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
              <Bell size={13} className="text-indigo-500" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Reminders &amp; Holidays
            </h2>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full px-2 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex px-5 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          {(["all", "pinned", "unread"] as AnnTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 text-[11px] font-semibold border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Loading holiday data…
              </p>
            </div>
          )}

          {/* API error banner */}
          {!loading && apiError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40">
              <span className="text-amber-600 text-xs mt-0.5">⚠</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Could not load live holiday data. Pinned reminders are still shown.
                Holiday data will retry on next open.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Bell size={22} className="text-slate-200 dark:text-zinc-700" />
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                {activeTab === "unread" ? "All caught up!" : "Nothing here."}
              </p>
            </div>
          )}

          {/* Announcement cards */}
          {!loading && filtered.map((ann) => {
            const isUnread = !readIds.has(ann.id);
            return (
              <div
                key={ann.id}
                onClick={() => markRead(ann.id)}
                className={`rounded-xl border overflow-hidden cursor-default transition-colors ${
                  isUnread
                    ? "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    : "border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 opacity-75"
                }`}
              >
                {ann.pinned && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40">
                    <Pin size={10} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      Pinned
                    </span>
                  </div>
                )}
                <div className="px-3 py-2.5 flex items-start gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0 ${ANN_PRIORITY_DOT[ann.priority]}`}
                  />
                  {isUnread && (
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-[5px] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          isUnread
                            ? "text-slate-800 dark:text-zinc-100"
                            : "text-slate-400 dark:text-zinc-500"
                        }`}
                      >
                        {ann.title}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ANN_TAG_STYLE[ann.tag]}`}
                      >
                        {ann.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-1">
                      {ann.postedBy} ·{" "}
                      {new Date(ann.createdAt + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day:   "numeric",
                        year:  "numeric",
                      })}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      {ann.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
            {loading
              ? "Fetching holidays…"
              : `${ALL_ANNOUNCEMENTS.length} announcement${ALL_ANNOUNCEMENTS.length !== 1 ? "s" : ""}${
                  unreadCount > 0 ? ` · ${unreadCount} unread` : " · all read"
                }`}
          </span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && !loading && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
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
   ─── Productivity Timer (fully DB-driven, no local timer state)
   ═══════════════════════════════════════════════════════ */
interface ProductivityTimerProps {
  agentId: string;
  agentName: string;
  date: string;
  onProductivityChange: (seconds: number) => void;
  bioBreakSeconds: number;
}

interface TimerRecord {
  _id: string;
  productiveSeconds: number;
  timerStartEpoch: number | null;
  timerPaused: boolean;
}

function parseHMS(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [h, m, s] = parts;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

function toHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function ProductivityTimer({
  agentId,
  agentName,
  date,
  onProductivityChange,
  bioBreakSeconds,
}: ProductivityTimerProps) {
  const { showSnackbar } = useSnackbar();
  // ── DB record (single source of truth) ──
  const [record, setRecord] = useState<TimerRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Clock-skew offset: clientTime - serverTime (ms) ──
  const [serverOffset, setServerOffset] = useState(0);

  // ── Live display tick (purely cosmetic — derived from DB record) ──
  const tick = useTick(1000);

  // ── End-timer confirmation ──
  const [pendingEnd, setPendingEnd] = useState<EndTimerConfirmation | null>(null);

  // ── Password gate state ──
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateChecking, setGateChecking] = useState(false);

  // ── Edit modal ──
  const [showEdit, setShowEdit] = useState(false);
  const [editHMS, setEditHMS] = useState("00:00:00");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Beacon ref ──
  const recordRef = useRef<TimerRecord | null>(null);
  useEffect(() => { recordRef.current = record; }, [record]);

  // ── serverOffset ref so beacon always has latest value ──
  const serverOffsetRef = useRef(0);
  useEffect(() => { serverOffsetRef.current = serverOffset; }, [serverOffset]);

  // ── Computed display seconds (derived from DB record + live tick) ──
  // FIX: Only add positive elapsed time, never negative
  const computeDisplaySeconds = useCallback((r: TimerRecord | null, offset = 0): number => {
    if (!r) return 0;
    if (r.timerStartEpoch && !r.timerPaused) {
      const adjustedNow = Date.now() - offset;
      const elapsed = Math.floor((adjustedNow - r.timerStartEpoch) / 1000);
      // Only add positive elapsed time, never negative
      if (elapsed > 0) {
        return r.productiveSeconds + elapsed;
      }
      return r.productiveSeconds;
    }
    return r.productiveSeconds;
  }, []);

  // ── Load from DB on mount / agent/date change ──
  useEffect(() => {
    setLoading(true);
    setRecord(null);

    const clientBefore = Date.now();

    fetch(`/api/kpi/productivity-timer?agentId=${agentId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        const clientAfter = Date.now();

        // Calculate clock-skew offset
        let offset = 0;
        if (d.serverNow) {
          const roundTrip = clientAfter - clientBefore;
          const serverEstimate = d.serverNow + roundTrip / 2;
          offset = clientAfter - serverEstimate;
          setServerOffset(offset);
          serverOffsetRef.current = offset;
        }

        const recordData = d.record ?? null;
        setRecord(recordData);
        
        // Calculate initial display seconds
        let initialSeconds = 0;
        if (recordData && recordData.timerStartEpoch && !recordData.timerPaused) {
          const adjustedNow = Date.now() - offset;
          const elapsed = Math.floor((adjustedNow - recordData.timerStartEpoch) / 1000);
          initialSeconds = recordData.productiveSeconds + (elapsed > 0 ? elapsed : 0);
        } else if (recordData) {
          initialSeconds = recordData.productiveSeconds;
        }
        onProductivityChange(initialSeconds);
      })
      .catch((err) => {
        console.error("Failed to load timer:", err);
        showSnackbar("error", "Failed to load timer", "Please refresh the page");
      })
      .finally(() => setLoading(false));
  }, [agentId, date, onProductivityChange, showSnackbar]);

  // ── Notify parent whenever tick fires or record changes ──
  useEffect(() => {
    onProductivityChange(computeDisplaySeconds(record, serverOffset));
  }, [tick, record, serverOffset, onProductivityChange, computeDisplaySeconds]);

  // ── Beacon on unload/hide - FIX: Don't add live elapsed, just pause the timer ──
  const flushBeacon = useCallback(() => {
    const r = recordRef.current;
    if (!r || !r.timerStartEpoch || r.timerPaused) return;
    
    // Calculate the total time to save (base + elapsed up to now)
    const total = computeDisplaySeconds(r, serverOffsetRef.current);
    
    navigator.sendBeacon(
      "/api/kpi/timer-beacon",
      new Blob(
        [JSON.stringify({
          id: r._id,
          productiveSeconds: total,
          timerStartEpoch: null, // Clear the start epoch
          timerPaused: true, // Mark as paused
        })],
        { type: "application/json" }
      )
    );
  }, [computeDisplaySeconds]);

  useEffect(() => {
    const handleUnload = () => flushBeacon();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushBeacon]);

  // ── API helpers ──
  const apiPatch = useCallback(async (
    id: string,
    patch: { productiveSeconds?: number; timerStartEpoch?: number | null; timerPaused?: boolean }
  ): Promise<TimerRecord | null> => {
    const res = await fetch("/api/kpi/productivity-timer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.record ?? null;
  }, []);

  const ensureRecord = useCallback(async (): Promise<TimerRecord | null> => {
    if (record) return record;
    const res = await fetch("/api/kpi/productivity-timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, agentName, date }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    setRecord(d.record);
    return d.record ?? null;
  }, [record, agentId, agentName, date]);

  // ── Timer actions ──
  const handleStart = async () => {
    const r = await ensureRecord();
    if (!r) return;
    const epoch = Date.now() - serverOffsetRef.current;
    const updated = await apiPatch(r._id, {
      timerStartEpoch: epoch,
      timerPaused: false,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("success", "Timer started", "Productivity timer is now running");
    }
  };

  const handlePause = async () => {
    if (!record) return;
    const acc = computeDisplaySeconds(record, serverOffset);
    const updated = await apiPatch(record._id, {
      productiveSeconds: acc,
      timerStartEpoch: null,
      timerPaused: true,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("info", "Timer paused", "Click Resume to continue");
    }
  };

  const handleResume = async () => {
    if (!record) return;
    const epoch = Date.now() - serverOffsetRef.current;
    const updated = await apiPatch(record._id, {
      timerStartEpoch: epoch,
      timerPaused: false,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("success", "Timer resumed", "Productivity tracking continues");
    }
  };

  const handleEnd = () => {
    if (!record) return;
    const total = computeDisplaySeconds(record, serverOffset);
    const net = Math.max(0, total - bioBreakSeconds);
    setPendingEnd({ productiveSeconds: total, bioBreakSeconds, netSeconds: net });
  };

  const confirmEnd = async () => {
    if (!record || !pendingEnd) return;
    const updated = await apiPatch(record._id, {
      productiveSeconds: pendingEnd.netSeconds,
      timerStartEpoch: null,
      timerPaused: false,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("success", "Timer ended", `Net productive time: ${formatTat(pendingEnd.netSeconds)}`);
    }
    setPendingEnd(null);
  };

  const handleReset = async () => {
    if (!record) return;
    const updated = await apiPatch(record._id, {
      productiveSeconds: 0,
      timerStartEpoch: null,
      timerPaused: false,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("warning", "Timer reset", "Productive time has been reset to 0");
    }
  };

  const handleContinue = async () => {
    if (!record) return;
    const epoch = Date.now() - serverOffsetRef.current;
    const updated = await apiPatch(record._id, {
      timerStartEpoch: epoch,
      timerPaused: false,
    });
    if (updated) { 
      setRecord(updated); 
      showSnackbar("success", "Timer continued", "Keep tracking your productivity");
    }
  };

  // ── Password gate ──
  const openEdit = () => {
    setGatePassword("");
    setGateError("");
    setShowPasswordGate(true);
  };

  const handleGateSubmit = async () => {
    if (!gatePassword) { setGateError("Enter your password"); return; }
    setGateChecking(true);
    setGateError("");
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: gatePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGateError(data.error ?? "Incorrect password");
        setGateChecking(false);
        return;
      }
      setShowPasswordGate(false);
      setGatePassword("");
      setEditHMS(toHMS(computeDisplaySeconds(record, serverOffset)));
      setEditError("");
      setShowEdit(true);
    } catch {
      setGateError("Something went wrong. Try again.");
    } finally {
      setGateChecking(false);
    }
  };

  // ── Edit modal save ──
  const handleEditSave = async () => {
    const secs = parseHMS(editHMS);
    if (secs === null) {
      setEditError("Enter a valid time HH:MM:SS (e.g. 07:30:00)");
      return;
    }
    setEditSaving(true);
    const r = await ensureRecord();
    if (!r) { setEditSaving(false); return; }
    const updated = await apiPatch(r._id, {
      productiveSeconds: secs,
      timerStartEpoch: null,
      timerPaused: false,
    });
    setEditSaving(false);
    if (updated) { 
      setRecord(updated); 
      setShowEdit(false); 
      showSnackbar("success", "Time updated", `Productive time set to ${editHMS}`);
    }
  };

  // ── Derived display state ──
  const displaySeconds = computeDisplaySeconds(record, serverOffset);
  const display = formatTat(displaySeconds);

  const isIdle    = !record || (!record.timerStartEpoch && !record.timerPaused && record.productiveSeconds === 0);
  const isRunning = !!record?.timerStartEpoch && !record?.timerPaused;
  const isPaused  = !!record?.timerPaused;
  const isDone    = !record?.timerStartEpoch && !record?.timerPaused && (record?.productiveSeconds ?? 0) > 0;

  return (
    <div className="border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Timer size={12} className="text-emerald-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          Productivity Timer
        </p>
        {isRunning && (
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        {record && !isRunning && (
          <button            onClick={openEdit}
            title="Edit productive time (requires password)"
            className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Clock display */}
        <div
          className={`rounded-xl border px-4 py-3 text-center transition-all ${
            loading        ? "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700" :
            isRunning      ? "bg-emerald-50 border-emerald-200" :
            isPaused       ? "bg-amber-50 border-amber-200" :
            isDone         ? "bg-indigo-50 border-indigo-200" :
                             "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
          }`}
        >
          <p
            className={`font-mono text-2xl font-bold tracking-widest ${
              loading   ? "text-slate-300 dark:text-zinc-600" :
              isRunning ? "text-emerald-600" :
              isPaused  ? "text-amber-500" :
              isDone    ? "text-indigo-600" :
                          "text-slate-400 dark:text-zinc-500"
            }`}
          >
            {loading ? "—:——:——" : display}
          </p>
          <p className="text-[10px] mt-1 uppercase tracking-widest font-semibold text-slate-400 dark:text-zinc-500">
            {loading ? "Loading…" : isRunning ? "Running" : isPaused ? "Paused" : isDone ? "Total Time" : "Ready"}
          </p>
        </div>

        {/* Controls */}
        {!loading && (
          <div className="flex gap-2">
            {isIdle && (
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                <Play size={12} /> Start
              </button>
            )}
            {isRunning && (
              <>
                <button
                  onClick={handlePause}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition-colors"
                >
                  <Pause size={12} /> Pause
                </button>
                <button
                  onClick={handleEnd}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                >
                  <Square size={12} /> End
                </button>
              </>
            )}
            {isPaused && (
              <>
                <button
                  onClick={handleResume}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Play size={12} /> Resume
                </button>
                <button
                  onClick={handleEnd}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                >
                  <Square size={12} /> End
                </button>
              </>
            )}
            {isDone && (
              <>
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Plus size={12} className="rotate-45" /> Reset
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Play size={12} /> Continue
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── End confirmation modal ── */}
      {pendingEnd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[360px] shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <Timer size={15} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  End Productivity Timer?
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  Bio break time will be deducted
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-xs text-emerald-700 font-medium">Total Timer</span>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  {formatTat(pendingEnd.productiveSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <span>🚻</span> Bio Break Time
                </span>
                <span className="text-xs font-mono font-bold text-amber-600">
                  − {formatTat(pendingEnd.bioBreakSeconds)}
                </span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-700 mx-1" />
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-xs text-indigo-700 font-semibold">Net Productive Time</span>
                <span className="text-sm font-mono font-bold text-indigo-600">
                  {formatTat(pendingEnd.netSeconds)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingEnd(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEnd}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Gate Modal ── */}
      {showPasswordGate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[340px] shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Confirm your identity
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  Enter your account password to edit the timer
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                Account password
              </label>
              <input
                type="password"
                value={gatePassword}
                onChange={(e) => { setGatePassword(e.target.value); setGateError(""); }}
                placeholder="••••••••"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleGateSubmit(); }}
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              {gateError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  {gateError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowPasswordGate(false); setGatePassword(""); setGateError(""); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGateSubmit}
                disabled={gateChecking}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {gateChecking ? "Checking…" : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {showEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[340px] shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <Pencil size={15} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Edit Productive Time
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  Enter the correct time in HH:MM:SS
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                Productive time (HH:MM:SS)
              </label>
              <input
                type="text"
                value={editHMS}
                onChange={(e) => { setEditHMS(e.target.value); setEditError(""); }}
                placeholder="07:30:00"
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono text-center text-lg tracking-widest"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); }}
              />
              {editError && (
                <p className="mt-1.5 text-xs text-red-500">{editError}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {[
                { label: "7h",     secs: 7 * 3600 },
                { label: "7h 30m", secs: 7 * 3600 + 30 * 60 },
                { label: "8h",     secs: 8 * 3600 },
                { label: "8h 30m", secs: 8 * 3600 + 30 * 60 },
                { label: "9h",     secs: 9 * 3600 },
              ].map(({ label, secs }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setEditHMS(toHMS(secs)); setEditError(""); }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-[11px] font-semibold hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
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
  const { showSnackbar } = useSnackbar();
  const [editing,   setEditing]   = useState(false);
  const [stDocType, setStDocType] = useState(subtask.docType);
  const [stNumber,  setStNumber]  = useState(String(subtask.number ?? ""));
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
  }, [subtask._id, txId, onDeleted]);

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
          number:       stNumber ? Number(stNumber) : undefined,
          notes:        stNotes.trim() || undefined,
          status:       stStatus,
          taskCategory: subtaskCategory,
        },
      }),
    });
    setSaving(false);
    if (res.ok) { 
      const d = await res.json(); 
      onUpdated(d.transaction); 
      setEditing(false);
      showSnackbar("success", "Subtask updated", `${stDocType} has been updated`);
    } else {
      showSnackbar("error", "Failed to update subtask", "Please try again");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, subtaskAction: "DELETE", subtaskId: subtask._id }),
    });
    setDeleting(false);
    if (res.ok) { 
      const d = await res.json(); 
      onDeleted(d.transaction);
      showSnackbar("warning", "Subtask deleted", `${subtask.docType} has been removed`);
    } else {
      showSnackbar("error", "Failed to delete subtask", "Please try again");
    }
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
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              value={stNumber}
              onChange={e => setStNumber(e.target.value)}
              placeholder="Vol/Num"
              className={`${inputSmCls} w-20`}
            />
            <input value={stNotes} onChange={e => setStNotes(e.target.value)} placeholder="Notes…" className={inputSmCls} />
          </div>
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
          <div className="flex items-center gap-1.5">
            <span>{subtask.docType}</span>
            {subtask.number != null && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                ×{subtask.number}
              </span>
            )}
          </div>
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
  parentCategory: TaskCategory;
  onAdded: (updated: Transaction) => void;
  onCancel: () => void;
}
function AddSubtaskInlineRow({ docTypes, txId, parentCategory, onAdded, onCancel }: AddSubtaskInlineRowProps) {
  const { showSnackbar } = useSnackbar();
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
          taskCategory: subtaskCategory,
        },
      }),
    });
    setSaving(false);
    if (res.ok) { 
      const d = await res.json(); 
      onAdded(d.transaction);
      showSnackbar("success", "Subtask added", `${stDocType} has been added`);
    } else {
      setErr("Failed to add");
      showSnackbar("error", "Failed to add subtask", "Please try again");
    }
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
  const hoveredRef = useRef(false);
  const subtasks = tx.subtasks ?? [];

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  // Keyboard shortcuts — only fires when this row is hovered
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hoveredRef.current) return;
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
  const { showSnackbar } = useSnackbar();
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
    showSnackbar("success", "Session started", "Your work session has begun");
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
    showSnackbar("info", "Bio break started", "Take a short break. Timer will pause.");
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
    showSnackbar("success", "Bio break ended", "Welcome back! Continue working.");
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
   ─── Import Excel Modal
   ═══════════════════════════════════════════════════════ */
// ─── Drop-in replacement for the ImportExcelModal component and ImportRow type ───
// Replace the existing ImportRow interface and ImportExcelModal function in your page file.
// Everything else (types, helpers, other components) stays unchanged.

/* ─── Updated ImportRow type ─── */
interface ImportSubtaskRow {
  docType: string;
  number: number | undefined;
  status: Transaction["status"];
  notes: string;
}

interface ImportRow {
  docType: string;
  volume: number;
  category: TaskCategory;
  status: Transaction["status"];
  notes: string;
  subtasks: ImportSubtaskRow[];
}

/* ─── Updated ImportExcelModal ─── */
function ImportExcelModal({
  open,
  onClose,
  docTypes,
  selectedAgent,
  date,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  docTypes: DocType[];
  selectedAgent: Agent;
  date: string;
  onImported: () => void;
}) {
  const { showSnackbar } = useSnackbar();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const VALID_STATUSES = new Set(["COMPLETION", "PENDING", "ESCALATION", "HOLD"]);

  const normalizeStatus = (raw: string): Transaction["status"] => {
    const up = (raw ?? "").toUpperCase().trim();
    if (VALID_STATUSES.has(up)) return up as Transaction["status"];
    return "COMPLETION";
  };

  const normalizeCategory = (raw: string): TaskCategory => {
    if ((raw ?? "").toLowerCase().includes("non")) return "Non-Production";
    return "Production";
  };

  const handleFile = async (file: File) => {
    setParseError("");
    setRows([]);
    setExpandedRows(new Set());
    setFileName(file.name);
    setParsing(true);

    try {
      // Dynamically load SheetJS
      await new Promise<void>((resolve, reject) => {
        if ((window as any).XLSX) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });

      const XLSX = (window as any).XLSX;
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      // Read "Transactions" sheet (first sheet as fallback)
      const sheetName = wb.SheetNames.includes("Transactions")
        ? "Transactions"
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rawData.length) {
        setParseError("No rows found in the Transactions sheet.");
        setParsing(false);
        return;
      }

      // ── Parse rows, grouping subtask rows under their parent transaction ──
      // A subtask row is identified by having a non-empty "Subtask Task" column
      // and an empty "Type of Task" column (matching the export format).
      const parsed: ImportRow[] = [];

      for (const r of rawData) {
        const mainTask = String(r["Type of Task"] ?? "").trim();
        const subtaskTask = String(r["Subtask Task"] ?? "").trim();

        if (mainTask) {
          // ── Main transaction row ──
          parsed.push({
            docType:  mainTask,
            volume:   Number(r["Volume"]) || 1,
            category: normalizeCategory(String(r["Category"] ?? "")),
            status:   normalizeStatus(String(r["Status"] ?? "")),
            notes:    String(r["Notes"] ?? "").trim(),
            subtasks: [],
          });
        } else if (subtaskTask && parsed.length > 0) {
          // ── Subtask row — attach to the most recent parent ──
          const rawNum = r["Subtask Number"];
          const parsedNum = rawNum !== "" && rawNum != null ? Number(rawNum) : undefined;
          parsed[parsed.length - 1].subtasks.push({
            docType: subtaskTask,
            number:  !isNaN(parsedNum as number) ? parsedNum : undefined,
            status:  normalizeStatus(String(r["Subtask Status"] ?? "")),
            notes:   String(r["Subtask Notes"] ?? "").trim(),
          });
        }
        // Rows with neither mainTask nor subtaskTask (e.g. blank rows) are skipped
      }

      const validRows = parsed.filter(r => r.docType);

      if (!validRows.length) {
        setParseError(
          "Could not find any valid rows. Make sure the sheet has a 'Type of Task' column."
        );
        setParsing(false);
        return;
      }

      setRows(validRows);
    } catch (err) {
      setParseError("Failed to parse the file. Make sure it's a valid .xlsx file.");
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const toggleRowExpanded = (i: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const totalSubtasks = rows.reduce((acc, r) => acc + r.subtasks.length, 0);

  const handleSaveAll = async () => {
    if (!rows.length) return;
    setSaving(true);

    const docTypeMap: Record<string, DocType> = {};
    docTypes.forEach(dt => { docTypeMap[dt.name] = dt; });

    let saved = 0;
    let failed = 0;

    for (const row of rows) {
      const foundDocType = docTypeMap[row.docType];

      // Build subtask payload
      const subtasksPayload = row.subtasks
        .filter(st => st.docType)
        .map(st => {
          const stDocType = docTypeMap[st.docType];
          return {
            docType:      st.docType,
            number:       st.number,
            status:       st.status,
            notes:        st.notes || undefined,
            taskCategory: stDocType?.taskCategory ?? row.category,
            countType:    stDocType?.countType ?? "transaction",
          };
        });

      const res = await fetch("/api/kpi/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId:        selectedAgent._id,
          agentName:      selectedAgent.name,
          docType:        row.docType,
          companyName:    "Imported",
          volume:         row.volume,
          date,
          status:         row.status,
          notes:          row.notes || undefined,
          startEpoch:     Date.now(),
          elapsedSeconds: 0,
          taskCategory:   row.category,
          countType:      foundDocType?.countType ?? "transaction",
          subtasks:       subtasksPayload,
        }),
      });

      if (res.ok) saved++; else failed++;
    }

    setSaving(false);

    if (failed === 0) {
      showSnackbar(
        "success",
        `${saved} transaction${saved !== 1 ? "s" : ""} imported`,
        totalSubtasks > 0
          ? `${totalSubtasks} subtask${totalSubtasks !== 1 ? "s" : ""} included`
          : "All rows have been saved to the log"
      );
    } else {
      showSnackbar("warning", `${saved} saved, ${failed} failed`, "Some rows could not be saved");
    }

    onImported();
    onClose();
    setRows([]);
    setExpandedRows(new Set());
    setFileName("");
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
    setRows([]);
    setExpandedRows(new Set());
    setFileName("");
    setParseError("");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-[600px] max-h-[82vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <FileSpreadsheet size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Import from Excel
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Drop zone */}
          {!rows.length && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-all"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Parsing file…</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                    Drop your .xlsx file here
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    or click to browse — use your exported tx-log file
                  </p>
                </>
              )}
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{parseError}</p>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    Preview —{" "}
                    <span className="text-emerald-600">{fileName}</span>
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600">
                    {rows.length} tx
                  </span>
                  {totalSubtasks > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-500">
                      {totalSubtasks} subtask{totalSubtasks !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setRows([]);
                    setExpandedRows(new Set());
                    setFileName("");
                    setParseError("");
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden max-h-[320px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                    <tr>
                      {["#", "Type of Task", "Category", "Status", "Vol", "Subtasks", "Notes"].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <>
                        {/* Parent row */}
                        <tr
                          key={`row-${i}`}
                          className="border-t border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-3 py-2 text-slate-400 dark:text-zinc-500">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-zinc-200 font-medium">
                            {r.docType}
                          </td>
                          <td className="px-3 py-2">
                            <CategoryBadge category={r.category} />
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{r.volume}</td>
                          <td className="px-3 py-2">
                            {r.subtasks.length > 0 ? (
                              <button
                                onClick={() => toggleRowExpanded(i)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-500 text-[10px] font-semibold hover:bg-indigo-100 transition-colors"
                              >
                                {expandedRows.has(i) ? (
                                  <ChevronDown size={9} />
                                ) : (
                                  <ChevronRight size={9} />
                                )}
                                {r.subtasks.length}
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-600 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400 dark:text-zinc-500 max-w-[120px] truncate">
                            {r.notes || "—"}
                          </td>
                        </tr>

                        {/* Expanded subtask rows */}
                        {expandedRows.has(i) &&
                          r.subtasks.map((st, si) => (
                            <tr
                              key={`row-${i}-st-${si}`}
                              className="border-t border-indigo-50 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/10"
                            >
                              <td className="pl-7 pr-3 py-1.5 text-slate-300 dark:text-zinc-600 text-[10px]">
                                ↳ {i + 1}.{si + 1}
                              </td>
                              <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                  <span>{st.docType}</span>
                                  {st.number != null && (
                                    <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[9px] font-bold text-slate-400">
                                      ×{st.number}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <CategoryBadge
                                  category={docTypes.find(dt => dt.name === st.docType)?.taskCategory}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <StatusBadge status={st.status} />
                              </td>
                              <td className="px-3 py-1.5 text-slate-400">
                                {st.number ?? "—"}
                              </td>
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5 text-slate-400 dark:text-zinc-500 max-w-[120px] truncate">
                                {st.notes || "—"}
                              </td>
                            </tr>
                          ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info notes */}
              <div className="mt-2 space-y-1.5">
                <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                  <Info size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    Company name will be set to{" "}
                    <span className="font-semibold">"Imported"</span> — you can edit each row
                    after import.
                  </p>
                </div>
                {totalSubtasks > 0 && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
                    <ListPlus size={11} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400">
                      {totalSubtasks} subtask{totalSubtasks !== 1 ? "s" : ""} detected and will
                      be imported. Click the count badge on any row to preview them.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!rows.length || saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check size={14} />
                Import {rows.length > 0
                  ? `${rows.length} row${rows.length !== 1 ? "s" : ""}${totalSubtasks > 0 ? ` + ${totalSubtasks} subtask${totalSubtasks !== 1 ? "s" : ""}` : ""}`
                  : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Main Page Content
   ═══════════════════════════════════════════════════════ */
function TxLogPageContent() {
  const { showSnackbar } = useSnackbar();
  const [agents, setAgents]               = useState<Agent[]>([]);
  const [docTypes, setDocTypes]           = useState<DocType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterStatus, setFilterStatus]   = useState<Transaction["status"] | "ALL">("ALL");
  const [filterDocType, setFilterDocType] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "ALL">("ALL");
  const [date, setDate]                   = useState(today());
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // news and announcement 
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  
  // agent leader board 
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const leaderboardDismissedAt = useRef<number>(0);
  const [currentTopAgentId, setCurrentTopAgentId] = useState<string | null>(null);

  const [timerProductiveSeconds, setTimerProductiveSeconds] = useState(0);
  const [totalBioBreakSeconds, setTotalBioBreakSeconds]     = useState(0);

  /* ── Bootstrap loading state ── */
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

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
  const [showImportModal, setShowImportModal] = useState(false);

  // Show leaderboard on mount + auto-show when top 3 changes
useEffect(() => {
  let pollInterval: ReturnType<typeof setTimeout>;
  let isActive = true;

  const checkTopAgent = async () => {
    if (!isActive) return;

    try {
      const agentRes = await fetch("/api/kpi/agents");
      const agentData = await agentRes.json();
      const agents = agentData.agents ?? [];

      if (agents.length === 0) return;

      const scores = await Promise.all(
        agents.map(async (agent: Agent) => {
          const txRes = await fetch(`/api/kpi/transactions?date=${date}&agentId=${agent._id}`);
          const txData = await txRes.json();
          const transactions = txData.transactions ?? [];

          const completions = transactions.filter(
            (t: Transaction) => t.status === "COMPLETION"
          ).length;

          const timerRes = await fetch(`/api/kpi/productivity-timer?agentId=${agent._id}&date=${date}`);
          const timerData = await timerRes.json();
          const timerRecord = timerData.record ?? null;

          let productiveSeconds = timerRecord?.productiveSeconds ?? 0;
          if (timerRecord?.timerStartEpoch && !timerRecord?.timerPaused) {
            productiveSeconds += Math.floor((Date.now() - timerRecord.timerStartEpoch) / 1000);
          }

          const score = Math.round(productiveSeconds / 60) + completions * 12;
          return { agentId: agent._id, score };
        })
      );

      const sorted = [...scores].sort((a, b) => b.score - a.score);
      setCurrentTopAgentId(sorted[0]?.agentId ?? null);

    } catch (error) {
      console.error("Failed to check top agent:", error);
    }

    const randomDelay = Math.floor(Math.random() * 60000) + 30000;
    if (isActive) {
      pollInterval = setTimeout(checkTopAgent, randomDelay);
    }
  };

  checkTopAgent();

  return () => {
    isActive = false;
    if (pollInterval) clearTimeout(pollInterval);
  };
}, [date]);

  // news and announcement useEffect 
useEffect(() => {
  try {
    const raw = localStorage.getItem(annLsKey("global"));
    const readSet: Set<string> = raw ? new Set(JSON.parse(raw)) : new Set();
    const hasUnread = PINNED_ANNOUNCEMENTS.some(a => !readSet.has(a.id));
    if (hasUnread) setShowAnnouncements(true);
  } catch {
    setShowAnnouncements(true);
  }
}, []);

  /* ── Bootstrap ── */
  useEffect(() => {
    Promise.all([
      fetch("/api/kpi/agents").then(r => r.json()),
      fetch("/api/kpi/doc-types").then(r => r.json()),
    ]).then(([agentData, docTypeData]) => {
      const agentList = agentData.agents ?? [];
      setAgents(agentList);
      if (agentList.length > 0 && !selectedAgent) setSelectedAgent(agentList[0]);

      const dts: DocType[] = docTypeData.docTypes ?? [];
      setDocTypes(dts);
      if (dts.length > 0) {
        setDocType(dts[0].name);
        setTaskCategory(dts[0].taskCategory ?? "Production");
      }
    }).finally(() => setBootstrapLoading(false));
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
    try { 
      await exportToExcel(transactions, selectedAgent.name, date, stats); 
      showSnackbar("success", "Export complete", `tx-log_${selectedAgent.name}_${date}.xlsx has been saved`);
    } catch (error) {
      showSnackbar("error", "Export failed", "Could not generate Excel file");
    } finally { 
      setExporting(null); 
    }
  };
  
  const handlePdfExport = async () => {
    if (!selectedAgent || transactions.length === 0) return;
    setExporting("pdf");
    try { 
      await exportToPdf(transactions, selectedAgent.name, date, formattedDate, stats);
      showSnackbar("success", "Export complete", `tx-log_${selectedAgent.name}_${date}.pdf has been saved`);
    } catch (error) {
      showSnackbar("error", "Export failed", "Could not generate PDF file");
    } finally { 
      setExporting(null); 
    }
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
        const successMsg = finalStatus === "HOLD" ? "Transaction placed on hold" : "Transaction updated";
        showSnackbar("success", successMsg, `"${companyName}" has been ${finalStatus === "HOLD" ? "held" : "updated"}`);
        setShowLogModal(false);
        resetForm();
      } else {
        const errData = await res.json();
        setFormError(errData.error ?? "Failed to update transaction");
        showSnackbar("error", "Failed to update", errData.error ?? "Please try again");
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
      const successMsg = finalStatus === "HOLD" ? "Transaction placed on hold" : "Transaction saved";
      showSnackbar("success", successMsg, `"${companyName}" has been added to your log`);
      setShowLogModal(false);
      resetForm();
    } else {
      const errData = await res.json();
      setFormError(errData.error ?? "Failed to save transaction");
      showSnackbar("error", "Failed to save", errData.error ?? "Please check your inputs and try again");
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
      showSnackbar("info", "Transaction resumed", "You can now continue editing this transaction");
    } else {
      showSnackbar("error", "Failed to resume", "Could not resume the held transaction");
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
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTx._id, docType: editDocType, companyName: editCompanyName.trim(), volume: Number(editVolume), status: editStatus, notes: editNotes.trim() || undefined, taskCategory: editTaskCategory }),
    });
    setEditSubmitting(false);
    if (res.ok) {
      setEditingTx(null);
      fetchTx();
      showSnackbar("success", "Transaction updated", `Changes to "${editCompanyName}" have been saved`);
    } else {
      showSnackbar("error", "Failed to update", "Could not save changes");
    }
  };
  
  const deleteTx = async () => {
    if (!deletingId) return;
    const res = await fetch("/api/kpi/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deletingId }) });
    if (res.ok) {
      setDeletingId(null);
      fetchTx();
      showSnackbar("warning", "Transaction deleted", "The transaction has been permanently removed");
    } else {
      showSnackbar("error", "Failed to delete", "Could not remove the transaction");
    }
  };

  const deleteAllTx = async () => {
  if (!selectedAgent) return;
  setDeletingAll(true);
  const res = await fetch("/api/kpi/transactions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleteAll: true, agentId: selectedAgent._id, date }),
  });
  setDeletingAll(false);
  if (res.ok) {
    const d = await res.json();
    setShowDeleteAllConfirm(false);
    setTransactions([]);
    showSnackbar("warning", "All transactions deleted", `${d.deleted} transaction${d.deleted !== 1 ? "s" : ""} removed for ${selectedAgent.name}`);
  } else {
    showSnackbar("error", "Failed to delete", "Could not remove all transactions");
  }
};

  /* ── Settings helpers ── */
  const addAgent = async () => {
    if (!newAgent.trim()) return;
    const res = await fetch("/api/kpi/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAgent.trim(), group: newAgentGroup.trim() || undefined }) });
    if (res.ok) { 
      const d = await res.json(); 
      setAgents(prev => [...prev, d.agent]); 
      setNewAgent(""); 
      setNewAgentGroup("");
      showSnackbar("success", "Agent added", `${newAgent.trim()} has been added to the team`);
    } else {
      showSnackbar("error", "Failed to add agent", "Please try again");
    }
  };
  
  const updateAgentGroup = async (id: string, group: string) => {
    const res = await fetch("/api/kpi/agents", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, group: group || undefined }) });
    if (res.ok) { 
      const d = await res.json(); 
      setAgents(prev => prev.map(a => a._id === id ? { ...a, group: d.agent.group } : a));
      showSnackbar("info", "Group updated", `Agent group changed to "${group || "none"}"`);
    }
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
      showSnackbar("success", "Task type added", `${newDocType.trim()} is now available`);
    } else {
      showSnackbar("error", "Failed to add task type", "Please try again");
    }
  };
  
  const deleteAgent = async (id: string) => {
    const agentToDelete = agents.find(a => a._id === id);
    await fetch("/api/kpi/agents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAgents(prev => prev.filter(a => a._id !== id));
    if (selectedAgent?._id === id) setSelectedAgent(agents.find(a => a._id !== id) ?? null);
    showSnackbar("warning", "Agent removed", `${agentToDelete?.name} has been removed from the system`);
  };
  
  const deleteDocType = async (id: string) => {
    const dtToDelete = docTypes.find(dt => dt._id === id);
    await fetch("/api/kpi/doc-types", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDocTypes(prev => prev.filter(d => d._id !== id));
    showSnackbar("warning", "Task type removed", `${dtToDelete?.name} has been deleted`);
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
      showSnackbar("success", "Task type updated", `Updated to "${editDocTypeName.trim()}"`);
    } else {
      showSnackbar("error", "Failed to update", "Could not save changes");
    }
  };

  const canExport = !!selectedAgent && transactions.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── Bootstrap loading overlay ── */}
      {bootstrapLoading && (
        <div className="flex-1 flex items-center justify-center">
          <PageSkeleton />
        </div>
      )}

      {!bootstrapLoading && <>

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
  {[...agents]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => (
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
   
{/* Marque */}
<div className="flex-1 overflow-hidden rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1">
  <div
    className="whitespace-nowrap text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-6"
    style={{ animation: "marquee 18s linear infinite" }}
  >
    <span>⚠️ Select your name before starting logs</span>
    <span>•</span>
    <span>⏱ End your timer after your shift to calculate productivity</span>
    <span>•</span>
    <span>☕ Track your Bio Breaks accurately during your shift</span>
    <span>•</span>
    <span>📊 Review all entries before submission</span>
  </div>
</div>
          
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            <button onClick={() => setDate(today())} className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-100 transition-colors">Today</button>
            <button
  onClick={() => setShowLeaderboard(s => !s)}
  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
    showLeaderboard
      ? "bg-amber-50 border-amber-200 text-amber-600"
      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
  }`}
>
  <Trophy size={13} />
  Leaderboard
</button>
<button
  onClick={() => setShowImportModal(true)}
  disabled={!selectedAgent}
  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
    selectedAgent
      ? "bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100"
      : "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
  }`}
>
  <FileSpreadsheet size={13} />
  Import
</button>
<div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
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
                agentName={selectedAgent.name}
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
                      {transactions.length > 0 && (
    <button
      onClick={() => setShowDeleteAllConfirm(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-500 text-[11px] font-semibold hover:bg-red-100 transition-colors"
    >
      <Trash2 size={11} /> Delete All
    </button>
  )}
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
  // Single source of truth: always resolve from live docTypes config
  const resolveCountType = (name: string): CountType =>
    countTypeMap[name] ?? "transaction";

  const mergedProd:    Record<string, { count: number; countType: CountType }> = {};
  const mergedNonProd: Record<string, { count: number; countType: CountType }> = {};

  const addToMerged = (
    name: string,
    category: TaskCategory,
    countType: CountType,
    value: number
  ) => {
    const target = category === "Production" ? mergedProd : mergedNonProd;
    target[name] = {
      count:     (target[name]?.count ?? 0) + value,
      countType,
    };
  };

  transactions.forEach(tx => {
    const ct       = resolveCountType(tx.docType);
    const category = tx.taskCategory ?? "Production";
    const value    = ct === "volume" ? (tx.volume ?? 1) : 1;
    addToMerged(tx.docType, category, ct, value);

    (tx.subtasks ?? []).forEach(st => {
      const stCt       = resolveCountType(st.docType);
      const stCategory = st.taskCategory ?? category;   // fall back to parent category
      const stValue    = stCt === "volume" ? (st.number ?? 1) : 1;
      addToMerged(st.docType, stCategory, stCt, stValue);
    });
  });

  const prodEntries    = Object.entries(mergedProd);
  const nonProdEntries = Object.entries(mergedNonProd);

  if (prodEntries.length === 0 && nonProdEntries.length === 0) return null;

  const renderTable = (
    entries: [string, { count: number; countType: CountType }][],
    label: string,
    isProduction: boolean
  ) => {
    if (entries.length === 0) return null;
    return (
      <div className="rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-[11px]">
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
              <th className="px-2.5 py-1 text-left font-semibold text-slate-500 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-700 whitespace-nowrap">
                Task Type
              </th>
              <th className="px-2.5 py-1 text-center font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, { count, countType }], i) => (
              <tr
                key={name}
                className={i < entries.length - 1 ? "border-t border-slate-100 dark:border-zinc-800" : ""}
              >
                <td className="px-2.5 py-1 text-slate-600 dark:text-zinc-300 border-r border-slate-200 dark:border-zinc-700 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {name}
                    <CountTypeBadge countType={countType} />
                  </div>
                </td>
                <td className={`px-2.5 py-1 text-center font-bold whitespace-nowrap ${
                  isProduction
                    ? "text-indigo-500 dark:text-indigo-400"
                    : "text-slate-500 dark:text-zinc-400"
                }`}>
                  {count}
                </td>
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

      {/* ── Delete All Confirmation modal ── */}
{showDeleteAllConfirm && selectedAgent && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
    onClick={() => !deletingAll && setShowDeleteAllConfirm(false)}
  >
    <div
      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[380px] shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
          <Trash2 size={15} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Delete All Transactions?
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            {selectedAgent.name} · {formattedDate}
          </p>
        </div>
      </div>
      <div className="px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 mb-5">
        <p className="text-xs text-red-600 font-semibold mb-0.5">⚠ This cannot be undone</p>
        <p className="text-[11px] text-red-500 leading-relaxed">
          All {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} and their subtasks for this agent on this date will be permanently deleted.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowDeleteAllConfirm(false)}
          disabled={deletingAll}
          className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={deleteAllTx}
          disabled={deletingAll}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {deletingAll ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deleting…
            </>
          ) : (
            <>
              <Trash2 size={13} />
              Delete All {transactions.length}
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)}

      {/* ── Import Excel Modal ── */}
{selectedAgent && (
  <ImportExcelModal
    open={showImportModal}
    onClose={() => setShowImportModal(false)}
    docTypes={docTypes}
    selectedAgent={selectedAgent}
    date={date}
    onImported={fetchTx}
  />
)}

      {/* ── Announcements Modal ── */}
<AnnouncementModal
  open={showAnnouncements}
  onClose={() => setShowAnnouncements(false)}
  storageKey="global"
/>
{/* ── Leaderboard Slide-in Panel ── */}
{showLeaderboard && (
  <div className="fixed inset-0 z-[55] flex justify-end pointer-events-none">
    <div
      className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
      onClick={() => setShowLeaderboard(false)}
    />
    <div className="relative w-[340px] h-full bg-slate-50 dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-700 overflow-y-auto pointer-events-auto shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Live Leaderboard</span>
        </div>
        <button
  onClick={() => {
    leaderboardDismissedAt.current = Date.now();
    setShowLeaderboard(false);
  }}
  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
>
  <X size={15} />
</button>
      </div>
      <div className="p-4 flex-1">
        <AgentLeaderboard
          date={date}
          refreshIntervalSeconds={15}
          className="w-full"
        />
      </div>
    </div>
  </div>
)}

      </>}
       {/* closes !bootstrapLoading fragment */}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Main Page Export
   ═══════════════════════════════════════════════════════ */
export default function TxLogPage() {
  return (
    <SnackbarProvider>
      <TxLogPageContent />
    </SnackbarProvider>
  );
}