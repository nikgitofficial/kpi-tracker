"use client";

import { useState, useCallback, useRef } from "react";
import {
  Download, Database, FileSpreadsheet, FileJson,
  FileText, Users, Tag, Timer, Coffee, Activity,
  ChevronDown, ChevronRight, CheckCircle2, AlertCircle,
  Calendar, Filter, RefreshCw, Info, X, Eye, Layers,
  Package, BarChart2,AlertTriangle,
} from "lucide-react";

/* ─── Unauthorized Warning Modal ─── */
function UnauthorizedWarningModal({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl w-[440px] shadow-2xl overflow-hidden">

        {/* Red gradient top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-snug">
              Restricted Area — Authorized Access Only
            </h2>
            <p className="text-[11px] text-red-500 dark:text-red-400 font-semibold mt-0.5 uppercase tracking-wider">
              Data Export &amp; Database Download
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-3">

          {/* Warning banner */}
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
            <p className="text-[12px] text-red-700 dark:text-red-400 leading-relaxed">
              Unauthorized access to this page is <span className="font-bold">strictly prohibited</span>. 
              This area contains sensitive business data exports, database snapshots, 
              and export logs reserved for authorized personnel only.
            </p>
          </div>

          {/* Bullet points */}
          <div className="space-y-2">
            {[
              "All export actions are logged and monitored at all times.",
              "This page is intended for authorized DevOps and Admin personnel only.",
              "Misuse or unauthorized data export may result in disciplinary action.",
              "Do not share, screenshot, or distribute any exported data without approval.",
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-[5px] flex-shrink-0" />
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

          {/* Acknowledgement note */}
          <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-[5px] flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
              By continuing, you confirm that you are an <span className="font-semibold text-slate-700 dark:text-zinc-200">authorized user</span> and 
              acknowledge that your export activity is being recorded.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <a
            href="/dashboard/homedashboard"
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-semibold text-center hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Leave Page
          </a>
          <button
            onClick={onAcknowledge}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-sm shadow-red-200 dark:shadow-none"
          >
            I Understand, Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Types ─── */
type CollectionKey = "transactions" | "agents" | "docTypes" | "sessions" | "timers";
type ExportFormat  = "json" | "excel" | "csv";

interface ExportStats {
  transactions?: number;
  agents?:       number;
  docTypes?:     number;
  sessions?:     number;
  timers?:       number;
  exportedAt?:   string;
}

interface CollectionMeta {
  key:         CollectionKey;
  label:       string;
  description: string;
  icon:        React.ElementType;
  color:       string;
  bg:          string;
  border:      string;
}

/* ─── Config ─── */
const COLLECTIONS: CollectionMeta[] = [
  {
    key:         "transactions",
    label:       "Transactions",
    description: "All logged tasks, statuses, subtasks, volumes and notes",
    icon:        Activity,
    color:       "text-indigo-600",
    bg:          "bg-indigo-50",
    border:      "border-indigo-200",
  },
  {
    key:         "agents",
    label:       "Agents",
    description: "Team members, names, and group assignments",
    icon:        Users,
    color:       "text-violet-600",
    bg:          "bg-violet-50",
    border:      "border-violet-200",
  },
  {
    key:         "docTypes",
    label:       "Task Types",
    description: "Document / task type definitions, categories, and count types",
    icon:        Tag,
    color:       "text-emerald-600",
    bg:          "bg-emerald-50",
    border:      "border-emerald-200",
  },
  {
    key:         "sessions",
    label:       "Sessions & Bio Breaks",
    description: "Work session records including all bio break entries and durations",
    icon:        Coffee,
    color:       "text-sky-600",
    bg:          "bg-sky-50",
    border:      "border-sky-200",
  },
  {
    key:         "timers",
    label:       "Productivity Timers",
    description: "Timer records with productive seconds, start epochs, and pause states",
    icon:        Timer,
    color:       "text-amber-600",
    bg:          "bg-amber-50",
    border:      "border-amber-200",
  },
];

/* ─── Helpers ─── */
function today()     { return new Date().toISOString().split("T")[0]; }
function monthStart(){ 
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function formatBytes(n: number) {
  if (n < 1024)       return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ─── Shared input classes (matching existing app) ─── */
const inputCls  = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const selectCls = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all";

/* ─── JSON Preview ─── */
function JsonPreview({ data, maxRows = 5 }: { data: Record<string, unknown>; maxRows?: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
        >
          <Eye size={11} />
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <pre className={`text-[10px] font-mono text-slate-600 dark:text-zinc-300 p-3 overflow-auto transition-all ${expanded ? "max-h-[400px]" : "max-h-[120px]"}`}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/* ─── Collection Card ─── */
function CollectionCard({
  meta,
  selected,
  count,
  onToggle,
}: {
  meta:     CollectionMeta;
  selected: boolean;
  count?:   number;
  onToggle: () => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? `${meta.border} ${meta.bg} shadow-sm`
          : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-600"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? `${meta.bg} ${meta.border} border` : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"}`}>
            <Icon size={14} className={selected ? meta.color : "text-slate-400 dark:text-zinc-500"} />
          </div>
          <div>
            <p className={`text-xs font-semibold ${selected ? "text-slate-900 dark:text-zinc-100" : "text-slate-600 dark:text-zinc-300"}`}>
              {meta.label}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-relaxed">
              {meta.description}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            selected
              ? `${meta.color.replace("text-", "bg-").replace("-600", "-600")} border-transparent`
              : "border-slate-300 dark:border-zinc-600"
          }`}>
            {selected && <CheckCircle2 size={10} className="text-white" />}
          </div>
          {count !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              selected ? `${meta.bg} ${meta.border} ${meta.color}` : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400"
            }`}>
              {count.toLocaleString()} rows
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Format Button ─── */
function FormatButton({
  format, label, icon: Icon, description, selected, onClick,
}: {
  format: ExportFormat; label: string; icon: React.ElementType;
  description: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? "border-indigo-400 bg-indigo-50 shadow-sm"
          : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={selected ? "text-indigo-600" : "text-slate-400"} />
        <span className={`text-xs font-bold ${selected ? "text-indigo-700" : "text-slate-600 dark:text-zinc-300"}`}>{label}</span>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{description}</p>
    </button>
  );
}

/* ─── Main Export Page ─── */
export default function DataExportPage() {
  // ── Authorization state ──
  const [acknowledged, setAcknowledged] = useState(false);
  
  // ── Selections ──
  const [selectedCollections, setSelectedCollections] = useState<Set<CollectionKey>>(
    new Set<CollectionKey>(["transactions"])
  );
  const [exportFormat, setExportFormat]   = useState<ExportFormat>("excel");
  const [dateFrom,     setDateFrom]       = useState(monthStart());
  const [dateTo,       setDateTo]         = useState(today());
  const [useDateFilter, setUseDateFilter] = useState(true);

  // ── State ──
  const [loading,       setLoading]      = useState(false);
  const [previewData,   setPreviewData]  = useState<Record<string, unknown> | null>(null);
  const [exportStats,   setExportStats]  = useState<ExportStats | null>(null);
  const [error,         setError]        = useState("");
  const [lastExport,    setLastExport]   = useState<{ at: string; size: string; format: string } | null>(null);
  const [previewOpen,   setPreviewOpen]  = useState(false);
  const [loadingMsg,    setLoadingMsg]   = useState("");

  const abortRef = useRef<AbortController | null>(null);

  /* ── Toggle collection ── */
  const toggleCollection = (key: CollectionKey) => {
    setSelectedCollections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const selectAll   = () => setSelectedCollections(new Set(COLLECTIONS.map(c => c.key)));
  const selectNone  = () => setSelectedCollections(new Set());

  /* ── Fetch data ── */
  const fetchData = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const params = new URLSearchParams();
    if (selectedCollections.size === 5) {
      params.set("collection", "all");
    } else {
      // Fetch all selected separately and merge
    }
    if (useDateFilter && dateFrom) params.set("dateFrom", dateFrom);
    if (useDateFilter && dateTo)   params.set("dateTo",   dateTo);

    // If only one collection, fetch directly
    if (selectedCollections.size === 1) {
      const [single] = selectedCollections;
      params.set("collection", single);
      const res = await fetch(`/api/kpi/export-all?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    // Fetch all and filter to selected
    params.set("collection", "all");
    const res = await fetch(`/api/kpi/export-all?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json() as Record<string, unknown>;

    // Keep only selected collections
    const filtered: Record<string, unknown> = {
      exportedAt: all.exportedAt,
      exportedBy: all.exportedBy,
    };
    for (const key of selectedCollections) {
      if (key in all) filtered[key] = all[key];
    }
    return filtered;
  }, [selectedCollections, useDateFilter, dateFrom, dateTo]);

  /* ── Preview ── */
  const handlePreview = async () => {
    if (selectedCollections.size === 0) { setError("Select at least one collection"); return; }
    setError("");
    setLoading(true);
    setLoadingMsg("Fetching data…");
    setPreviewData(null);

    try {
      const data = await fetchData();
      if (!data) return;
      setPreviewData(data);

      const stats: ExportStats = { exportedAt: data.exportedAt as string };
      if (Array.isArray(data.transactions)) stats.transactions = (data.transactions as unknown[]).length;
      if (Array.isArray(data.agents))       stats.agents       = (data.agents as unknown[]).length;
      if (Array.isArray(data.docTypes))     stats.docTypes     = (data.docTypes as unknown[]).length;
      if (Array.isArray(data.sessions))     stats.sessions     = (data.sessions as unknown[]).length;
      if (Array.isArray(data.timers))       stats.timers       = (data.timers as unknown[]).length;
      setExportStats(stats);
      setPreviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  /* ── Export as JSON ── */
  const exportJSON = (data: Record<string, unknown>) => {
    const json    = JSON.stringify(data, null, 2);
    const blob    = new Blob([json], { type: "application/json" });
    const fname   = `txlog-export_${today()}.json`;
    downloadBlob(blob, fname);
    return { size: formatBytes(blob.size), format: "JSON" };
  };

  /* ── Export as CSV ── */
  const exportCSV = (data: Record<string, unknown>) => {
    const sheets: string[] = [];

    const toCSV = (rows: Record<string, unknown>[], label: string) => {
  if (!rows?.length) return;

  // ── Sort alphabetically ──
  const sorted = [...rows].sort((a, b) => {
    const nameKey = ["name", "agentName", "label", "title", "docType"].find(k => k in a);
    if (!nameKey) return 0;
    const aVal = String(a[nameKey] ?? "").toLowerCase();
    const bVal = String(b[nameKey] ?? "").toLowerCase();
    return aVal.localeCompare(bVal);
  });

  const allKeys = Array.from(new Set(sorted.flatMap(r => Object.keys(r))));
  const header  = allKeys.join(",");
  const body    = sorted.map(r =>
    allKeys.map(k => {
      const v = r[k];
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  sheets.push(`=== ${label.toUpperCase()} ===\n${header}\n${body}`);
};

    if (Array.isArray(data.transactions)) toCSV(data.transactions as Record<string, unknown>[], "Transactions");
    if (Array.isArray(data.agents))       toCSV(data.agents as Record<string, unknown>[], "Agents");
    if (Array.isArray(data.docTypes))     toCSV(data.docTypes as Record<string, unknown>[], "Task Types");
    if (Array.isArray(data.sessions))     toCSV(data.sessions as Record<string, unknown>[], "Sessions");
    if (Array.isArray(data.timers))       toCSV(data.timers as Record<string, unknown>[], "Timers");

    const content = sheets.join("\n\n");
    const blob    = new Blob([content], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `txlog-export_${today()}.csv`);
    return { size: formatBytes(blob.size), format: "CSV" };
  };

 // ─────────────────────────────────────────────────────────────
// DROP-IN REPLACEMENT for the exportExcel function in DataExportPage
// Replace from  /* ── Export as Excel ── */  to its closing  };
// ─────────────────────────────────────────────────────────────

  /* ── Export as Excel ── */
  const exportExcel = async (data: Record<string, unknown>) => {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX = (window as any).XLSX;
    const wb   = XLSX.utils.book_new();

    // ── Helpers ──────────────────────────────────────────────
    const formatHMS = (sec: number) => {
      const h = Math.floor(sec / 3600).toString().padStart(2, "0");
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
      const s = (sec % 60).toString().padStart(2, "0");
      return `${h}:${m}:${s}`;
    };

    // ── Build a lookup: "agentName|date" → { productiveSeconds, hms } ──
    const timerRows = Array.isArray(data.timers)
      ? (data.timers as Record<string, unknown>[])
      : [];

    const timerLookup = new Map<string, { productiveSeconds: number; hms: string }>();
    for (const t of timerRows) {
      const key  = `${String(t.agentName ?? "").toLowerCase()}|${String(t.date ?? "")}`;
      const secs = typeof t.productiveSeconds === "number" ? t.productiveSeconds : 0;
      const existing = timerLookup.get(key);
      if (existing) {
        existing.productiveSeconds += secs;
        existing.hms = formatHMS(existing.productiveSeconds);
      } else {
        timerLookup.set(key, { productiveSeconds: secs, hms: formatHMS(secs) });
      }
    }

    // ── Generic addSheet (with alpha sort + flatten) ─────────
    const addSheet = (rows: Record<string, unknown>[] | undefined, name: string) => {
      if (!rows?.length) return;

      const sorted = [...rows].sort((a, b) => {
        const nameKey = ["name", "agentName", "label", "title", "docType"].find(k => k in a);
        if (!nameKey) return 0;
        return String(a[nameKey] ?? "").toLowerCase().localeCompare(String(b[nameKey] ?? "").toLowerCase());
      });

      const flat = sorted.map(r => {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (Array.isArray(v)) {
            row[k] = v.length > 0 ? `[${v.length} items]` : "";
          } else if (typeof v === "object" && v !== null) {
            for (const [sk, sv] of Object.entries(v as object)) {
              row[`${k}.${sk}`] = sv;
            }
          } else {
            row[k] = v;
          }
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    // ── Transactions sheet — with productivity columns injected ──
    if (Array.isArray(data.transactions) && (data.transactions as unknown[]).length > 0) {
      const txRows = data.transactions as Record<string, unknown>[];
      const sorted = [...txRows].sort((a, b) =>
        String(a.agentName ?? "").toLowerCase().localeCompare(String(b.agentName ?? "").toLowerCase())
      );

      const flat = sorted.map(r => {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (Array.isArray(v)) {
            row[k] = v.length > 0 ? `[${v.length} items]` : "";
          } else if (typeof v === "object" && v !== null) {
            for (const [sk, sv] of Object.entries(v as object)) {
              row[`${k}.${sk}`] = sv;
            }
          } else {
            row[k] = v;
          }
        }
        // Inject productivity columns using agentName + date lookup
        const key   = `${String(r.agentName ?? "").toLowerCase()}|${String(r.date ?? "")}`;
        const timer = timerLookup.get(key);
        row["productiveTime (HH:MM:SS)"] = timer?.hms ?? "";
        row["productiveSeconds"]          = timer?.productiveSeconds ?? "";
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    }

    // ── Agents, DocTypes sheets (unchanged) ──
    addSheet(data.agents   as Record<string, unknown>[], "Agents");
    addSheet(data.docTypes as Record<string, unknown>[], "Task Types");
    addSheet(data.sessions as Record<string, unknown>[], "Sessions");

    // ── Timers sheet — with productiveTime (HH:MM:SS) column injected ──
    if (Array.isArray(data.timers) && (data.timers as unknown[]).length > 0) {
      const sorted = [...timerRows].sort((a, b) => {
        const nameCmp = String(a.agentName ?? "").toLowerCase().localeCompare(String(b.agentName ?? "").toLowerCase());
        if (nameCmp !== 0) return nameCmp;
        return String(b.date ?? "") > String(a.date ?? "") ? 1 : -1;
      });

      const flat = sorted.map(r => {
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (Array.isArray(v)) {
            row[k] = v.length > 0 ? `[${v.length} items]` : "";
          } else if (typeof v === "object" && v !== null) {
            for (const [sk, sv] of Object.entries(v as object)) {
              row[`${k}.${sk}`] = sv;
            }
          } else {
            row[k] = v;
          }
        }
        // Inject formatted column right after productiveSeconds
        row["productiveTime (HH:MM:SS)"] = formatHMS(
          typeof r.productiveSeconds === "number" ? r.productiveSeconds : 0
        );
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, "Timers");
    }

    // ── Productivity Hrs sheet ────────────────────────────────
    // Group timers by agentName → per-date rows + subtotal row per agent
    {
      const byAgent = new Map<string, { date: string; secs: number }[]>();
      for (const t of timerRows) {
        const agent = String(t.agentName ?? "—");
        const date  = String(t.date ?? "—");
        const secs  = typeof t.productiveSeconds === "number" ? t.productiveSeconds : 0;
        if (!byAgent.has(agent)) byAgent.set(agent, []);
        byAgent.get(agent)!.push({ date, secs });
      }

      // Sort agents A→Z, dates newest-first within each agent
      const sortedAgents = [...byAgent.entries()].sort(([a], [b]) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      const header = [
        "Agent Name",
        "Date",
        "Productive Time (HH:MM:SS)",
        "Productive Seconds",
      ];

      const sheetRows: (string | number)[][] = [header];
      let grandTotal = 0;

      for (const [agent, entries] of sortedAgents) {
        const sorted = [...entries].sort((a, b) =>
          b.date > a.date ? 1 : b.date < a.date ? -1 : 0
        );
        let agentTotal = 0;
        for (const { date, secs } of sorted) {
          sheetRows.push([agent, date, formatHMS(secs), secs]);
          agentTotal += secs;
        }
        // Subtotal row for this agent
        sheetRows.push([
          `SUBTOTAL — ${agent}`,
          "",
          formatHMS(agentTotal),
          agentTotal,
        ]);
        sheetRows.push([]); // blank spacer
        grandTotal += agentTotal;
      }

      // Grand total row
      sheetRows.push(["GRAND TOTAL — All Agents", "", formatHMS(grandTotal), grandTotal]);

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, "Productivity Hrs");
    }

    // ── Export Summary sheet ──────────────────────────────────
    const totalTx       = Array.isArray(data.transactions) ? (data.transactions as unknown[]).length : 0;
    const totalAgents   = Array.isArray(data.agents)       ? (data.agents as unknown[]).length       : 0;
    const totalDocTypes = Array.isArray(data.docTypes)     ? (data.docTypes as unknown[]).length     : 0;
    const totalSessions = Array.isArray(data.sessions)     ? (data.sessions as unknown[]).length     : 0;
    const totalTimers   = timerRows.length;

    const totalProductiveSeconds = timerRows.reduce(
      (acc, t) => acc + (typeof t.productiveSeconds === "number" ? t.productiveSeconds : 0),
      0
    );

    const summary = [
      ["TX Log — Full Database Export"],
      [],
      ["Exported At", data.exportedAt],
      ["Exported By", data.exportedBy],
      [],
      ["Collection",          "Row Count"],
      ["Transactions",        totalTx],
      ["Agents",              totalAgents],
      ["Task Types",          totalDocTypes],
      ["Sessions",            totalSessions],
      ["Productivity Timers", totalTimers],
      [],
      ["Productivity Hours Summary"],
      ["Agent", "Date", "Productive Time (HH:MM:SS)", "Productive Seconds"],
      ...[...timerRows]
        .sort((a, b) => {
          const nameCmp = String(a.agentName ?? "").toLowerCase().localeCompare(String(b.agentName ?? "").toLowerCase());
          if (nameCmp !== 0) return nameCmp;
          return String(b.date ?? "") > String(a.date ?? "") ? 1 : -1;
        })
        .map(t => [
          t.agentName ?? "—",
          t.date      ?? "—",
          formatHMS(typeof t.productiveSeconds === "number" ? t.productiveSeconds : 0),
          typeof t.productiveSeconds === "number" ? t.productiveSeconds : 0,
        ]),
      [],
      ["Total Productive Time (all agents)", "", formatHMS(totalProductiveSeconds), totalProductiveSeconds],
    ];

    if (useDateFilter) {
      summary.push([]);
      summary.push(["Date Filter", `${dateFrom} → ${dateTo}`]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Export Summary");

    const fname = `txlog-export_${today()}.xlsx`;
    XLSX.writeFile(wb, fname);

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return { size: formatBytes(buf.byteLength), format: "Excel" };
  };

  /* ── Main export handler ── */
  const handleExport = async () => {
    if (selectedCollections.size === 0) { setError("Select at least one collection"); return; }
    setError("");
    setLoading(true);
    setLoadingMsg("Fetching data from server…");

    try {
      const data = await fetchData();
      if (!data) throw new Error("No data returned");

      setLoadingMsg("Generating file…");

      let result: { size: string; format: string };
      if (exportFormat === "json") {
        result = exportJSON(data);
      } else if (exportFormat === "csv") {
        result = exportCSV(data);
      } else {
        result = await exportExcel(data);
      }

      const stats: ExportStats = { exportedAt: data.exportedAt as string };
      if (Array.isArray(data.transactions)) stats.transactions = (data.transactions as unknown[]).length;
      if (Array.isArray(data.agents))       stats.agents       = (data.agents as unknown[]).length;
      if (Array.isArray(data.docTypes))     stats.docTypes     = (data.docTypes as unknown[]).length;
      if (Array.isArray(data.sessions))     stats.sessions     = (data.sessions as unknown[]).length;
      if (Array.isArray(data.timers))       stats.timers       = (data.timers as unknown[]).length;
      setExportStats(stats);
      setLastExport({
        at:     new Date().toLocaleString(),
        size:   result.size,
        format: result.format,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const totalRows = exportStats
    ? ((exportStats.transactions ?? 0) +
       (exportStats.agents       ?? 0) +
       (exportStats.docTypes     ?? 0) +
       (exportStats.sessions     ?? 0) +
       (exportStats.timers       ?? 0))
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* ── Unauthorized Warning Modal ── */}
      {!acknowledged && (
        <UnauthorizedWarningModal onAcknowledge={() => setAcknowledged(true)} />
      )}

      {/* ── Page Header ── */}
      <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Data Export
              </h1>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Download all your database records in multiple formats
              </p>
            </div>
          </div>

          {lastExport && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-emerald-700">Last export</p>
                <p className="text-[10px] text-emerald-600">
                  {lastExport.format} · {lastExport.size} · {lastExport.at}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Step 1: Choose Collections ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">1</span>
              </div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Choose Collections
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                Select All
              </button>
              <span className="text-slate-300 dark:text-zinc-600">·</span>
              <button
                onClick={selectNone}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COLLECTIONS.map(meta => (
              <CollectionCard
                key={meta.key}
                meta={meta}
                selected={selectedCollections.has(meta.key)}
                count={exportStats?.[meta.key as keyof ExportStats] as number | undefined}
                onToggle={() => toggleCollection(meta.key)}
              />
            ))}

            {/* "All Collections" quick-select */}
            <button
              onClick={selectAll}
              className={`rounded-xl border-2 border-dashed p-4 text-left transition-all ${
                selectedCollections.size === COLLECTIONS.length
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 dark:border-zinc-700 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                  <Layers size={14} className="text-slate-400 dark:text-zinc-500" />
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                  Everything
                </p>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                Export all collections at once — full database snapshot
              </p>
            </button>
          </div>

          {selectedCollections.size === 0 && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle size={11} />
              Select at least one collection to export
            </p>
          )}
        </section>

        {/* ── Step 2: Date Filter ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">2</span>
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Date Range
            </h2>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">(applies to transactions, sessions, timers)</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUseDateFilter(f => !f)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  useDateFilter ? "bg-indigo-600" : "bg-slate-200 dark:bg-zinc-700"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  useDateFilter ? "translate-x-[18px]" : "translate-x-[3px]"
                }`} />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Apply date filter
              </span>
              {!useDateFilter && (
                <span className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle size={11} />
                  All dates will be exported
                </span>
              )}
            </div>

            {useDateFilter && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                    <Calendar size={11} className="inline mr-1" />From
                  </label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                    <Calendar size={11} className="inline mr-1" />To
                  </label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}

            {/* Quick range presets */}
            {useDateFilter && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Presets:</span>
                {[
                  { label: "Today",        from: today(),       to: today() },
                  { label: "This Month",   from: monthStart(),  to: today() },
                  { label: "Last 7 days",  from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; })(), to: today() },
                  { label: "Last 30 days", from: (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; })(), to: today() },
                  { label: "This Year",    from: `${new Date().getFullYear()}-01-01`, to: today() },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                      dateFrom === p.from && dateTo === p.to
                        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                        : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Step 3: Format ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">3</span>
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Export Format
            </h2>
          </div>

          <div className="flex gap-3">
            <FormatButton
              format="excel"
              label="Excel (.xlsx)"
              icon={FileSpreadsheet}
              description="Multi-sheet workbook with summary. Best for spreadsheets."
              selected={exportFormat === "excel"}
              onClick={() => setExportFormat("excel")}
            />
            <FormatButton
              format="json"
              label="JSON (.json)"
              icon={FileJson}
              description="Structured data dump. Best for developers & backups."
              selected={exportFormat === "json"}
              onClick={() => setExportFormat("json")}
            />
            <FormatButton
              format="csv"
              label="CSV (.csv)"
              icon={FileText}
              description="Flat text format. Compatible with any spreadsheet app."
              selected={exportFormat === "csv"}
              onClick={() => setExportFormat("csv")}
            />
          </div>
        </section>

        {/* ── Stats preview (after fetch) ── */}
        {exportStats && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={14} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Data Preview
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                — fetched at {exportStats.exportedAt ? new Date(exportStats.exportedAt).toLocaleTimeString() : "—"}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-3">
              {COLLECTIONS.map(meta => {
                const count = exportStats[meta.key as keyof ExportStats] as number | undefined;
                if (count === undefined) return null;
                const Icon = meta.icon;
                return (
                  <div key={meta.key} className={`${meta.bg} ${meta.border} border rounded-xl px-3 py-2.5 text-center`}>
                    <Icon size={13} className={`${meta.color} mx-auto mb-1`} />
                    <p className={`text-base font-bold ${meta.color}`}>{count.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{meta.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                Total rows to export
              </span>
              <span className="text-sm font-bold text-indigo-600">
                {totalRows.toLocaleString()} rows across {selectedCollections.size} collection{selectedCollections.size !== 1 ? "s" : ""}
              </span>
            </div>

            {previewData && (
              <div className="mt-3">
                <button
                  onClick={() => setPreviewOpen(o => !o)}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors mb-2"
                >
                  {previewOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  {previewOpen ? "Hide" : "Show"} JSON preview
                </button>
                {previewOpen && <JsonPreview data={previewData} />}
              </div>
            )}
          </section>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Export Error</p>
              <p className="text-[11px] text-red-600 dark:text-red-500 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Info notice ── */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
          <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            Exported data includes only records owned by your account. Agents and task types are not date-filtered. Subtasks are nested inside their parent transactions in JSON/Excel exports.
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={loading || selectedCollections.size === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading && loadingMsg.includes("Fetching") ? loadingMsg : "Preview Data"}
          </button>

          <button
            onClick={handleExport}
            disabled={loading || selectedCollections.size === 0}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {loadingMsg || "Processing…"}
              </>
            ) : (
              <>
                <Download size={16} />
                Export {selectedCollections.size > 0 ? `${selectedCollections.size} collection${selectedCollections.size !== 1 ? "s" : ""}` : ""} as {exportFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>

        {/* ── Bottom padding ── */}
        <div className="h-8" />
      </div>
    </div>
  );
}