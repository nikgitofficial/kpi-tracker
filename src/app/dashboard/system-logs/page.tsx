"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, Trash2, Search, Circle,
  Clock, AlertTriangle, CheckCircle2, Database,
  Wifi, Activity, Server, Filter, ChevronDown, X,
} from "lucide-react";

/* ─── Types ─── */
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type LogStatus = "ok" | "warn" | "error";

interface ApiLogEntry {
  id: string;
  ts: number;
  method: HttpMethod;
  path: string;
  status: number;
  ms: number;
  tag: string;
  detail?: string;
  requestBody?: string;
  responseSize?: number;
}

interface DbLogEntry {
  id: string;
  ts: number;
  collection: string;
  op: string;
  ms: number;
  docs: number;
  filter: string;
}

interface BeaconEntry {
  id: string;
  ts: number;
  agentId?: string;
  productiveSeconds: number;
  display: string;
  timerStartEpoch?: number | null;
  ok: boolean;
}

interface CacheEntry {
  key: string;
  size: string;
  ageSecs: number;
  fresh: boolean;
  hits: number;
}

interface SystemStats {
  agents: number;
  docTypes: number;
  txCount: number;
  timersActive: number;
  totalProductiveSeconds: number;
}

/* ─── Constants ─── */
const ROUTE_TAGS: Record<string, string> = {
  "/api/kpi/analytics": "analytics",
  "/api/kpi/productivity": "productivity",
  "/api/kpi/productivity-timer": "timer",
  "/api/kpi/productivity-timers": "timer",
  "/api/kpi/timer-beacon": "beacon",
  "/api/kpi/transactions": "tx",
  "/api/kpi/agents": "agents",
  "/api/kpi/doc-types": "doctypes",
  "/api/kpi/session": "session",
  "/api/kpi/search": "search",
};

const TAG_COLORS: Record<string, string> = {
  analytics:    "bg-purple-50 text-purple-700 border-purple-200",
  productivity: "bg-indigo-50 text-indigo-700 border-indigo-200",
  timer:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  beacon:       "bg-amber-50 text-amber-700 border-amber-200",
  tx:           "bg-blue-50 text-blue-700 border-blue-200",
  agents:       "bg-sky-50 text-sky-700 border-sky-200",
  doctypes:     "bg-violet-50 text-violet-700 border-violet-200",
  session:      "bg-pink-50 text-pink-700 border-pink-200",
  search:       "bg-slate-100 text-slate-600 border-slate-200",
};

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-50 text-blue-700 border-blue-200",
  POST:   "bg-green-50 text-green-700 border-green-200",
  PATCH:  "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

/* ─── Helpers ─── */
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function formatMs(ms: number) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatHms(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today() { return new Date().toISOString().split("T")[0]; }

function msColor(ms: number) {
  if (ms > 500) return "text-red-500";
  if (ms > 200) return "text-amber-500";
  return "text-slate-400 dark:text-zinc-500";
}

function statusColor(status: number) {
  if (status >= 500) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800";
  if (status >= 400) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800";
}

/* ─── Proxy wrapper — intercepts fetch globally ─── */
function installFetchProxy(
  onRequest: (entry: Omit<ApiLogEntry, "id" | "ts">) => void
) {
  const original = window.fetch.bind(window);
  (window as any).__kpiLogsOriginalFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = ((init?.method ?? (input instanceof Request ? input.method : "GET")) as HttpMethod).toUpperCase() as HttpMethod;
    const start = performance.now();
    const path = url.startsWith("/") ? url.split("?")[0] : new URL(url).pathname;
    const tag = ROUTE_TAGS[path] ?? "other";

    try {
      const res = await original(input, init);
      const ms = performance.now() - start;
      const clone = res.clone();
      const text = await clone.text().catch(() => "");
      onRequest({
        method,
        path: url.startsWith("/") ? url : new URL(url).pathname + (new URL(url).search || ""),
        status: res.status,
        ms: Math.round(ms),
        tag,
        responseSize: text.length,
        detail: res.ok ? undefined : `HTTP ${res.status}`,
      });
      return res;
    } catch (err) {
      onRequest({
        method, path, status: 0, ms: Math.round(performance.now() - start),
        tag, detail: String(err),
      });
      throw err;
    }
  };

  return () => {
    window.fetch = original;
  };
}

/* ─── Tabs ─── */
type Tab = "api" | "db" | "cache" | "beacon" | "errors" | "system";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "api",    label: "API log",      icon: Activity  },
  { key: "db",     label: "DB queries",   icon: Database  },
  { key: "cache",  label: "Cache / state", icon: Server   },
  { key: "beacon", label: "Timer beacons", icon: Wifi     },
  { key: "errors", label: "Errors",        icon: AlertTriangle },
  { key: "system", label: "System info",   icon: CheckCircle2  },
];

/* ─── Pill ─── */
function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Unauthorized Warning Modal
   ═══════════════════════════════════════════════════════ */
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
              System Logs &amp; Cache Inspector
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-3">

          {/* Warning banner */}
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
            <p className="text-[12px] text-red-700 dark:text-red-400 leading-relaxed">
              Unauthorized access to this page is <span className="font-bold">strictly prohibited</span>. 
              This area contains sensitive system logs, API activity, database queries, 
              and internal diagnostics reserved for authorized personnel only.
            </p>
          </div>

          {/* Bullet points */}
          <div className="space-y-2">
            {[
              "All access attempts are logged and monitored at all times.",
              "This page is intended for authorized DevOps personnel only.",
              "Misuse or unauthorized viewing may result in disciplinary action.",
              "Do not share, screenshot, or distribute any content from this page.",
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
              By continuing, you confirm that you are an <span className="font-semibold text-slate-700 dark:text-zinc-200">authorized DevOps user</span> and 
              acknowledge that your session activity is being recorded.
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

/* ─── Main page ─── */
export default function SystemLogsPage() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("api");
  const [apiLog,    setApiLog]    = useState<ApiLogEntry[]>([]);
  const [dbLog,     setDbLog]     = useState<DbLogEntry[]>([]);
  const [beacons,   setBeacons]   = useState<BeaconEntry[]>([]);
  const [cache,     setCache]     = useState<CacheEntry[]>([]);
  const [sysStats,  setSysStats]  = useState<SystemStats | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [live,      setLive]      = useState(true);

  /* Filters */
  const [apiSearch,      setApiSearch]      = useState("");
  const [apiMethodFilter, setApiMethodFilter] = useState("");
  const [apiStatusFilter, setApiStatusFilter] = useState("");
  const [dbSearch,       setDbSearch]       = useState("");

  const uninstallRef = useRef<(() => void) | null>(null);

  /* Install fetch interceptor */
  useEffect(() => {
    uninstallRef.current = installFetchProxy((entry) => {
      const full: ApiLogEntry = { ...entry, id: Math.random().toString(36).slice(2), ts: Date.now() };
      setApiLog(prev => [full, ...prev].slice(0, 500));

      /* Synthetic DB entry for write operations */
      if (entry.method !== "GET" && entry.tag !== "other") {
        const colMap: Record<string, string> = {
          tx: "Transaction", agents: "Agent", doctypes: "DocType",
          timer: "ProductivityTimer", session: "AgentSession",
        };
        const opMap: Record<string, string> = {
          POST: "create", PATCH: "findOneAndUpdate", DELETE: "deleteOne",
        };
        const col = colMap[entry.tag];
        if (col) {
          const dbEntry: DbLogEntry = {
            id: Math.random().toString(36).slice(2),
            ts: Date.now(),
            collection: col,
            op: opMap[entry.method] ?? "findOne",
            ms: Math.max(2, Math.round(entry.ms * 0.4)),
            docs: entry.status < 400 ? 1 : 0,
            filter: "{ ownerEmail: session.user.email }",
          };
          setDbLog(prev => [dbEntry, ...prev].slice(0, 500));
        }
      }

      /* Beacon tracking */
      if (entry.tag === "beacon") {
        const beacon: BeaconEntry = {
          id: full.id,
          ts: full.ts,
          productiveSeconds: 0,
          display: "—",
          ok: entry.status < 400,
        };
        setBeacons(prev => [beacon, ...prev].slice(0, 100));
      }
    });
    return () => { uninstallRef.current?.(); };
  }, []);

  /* Load system stats + cache simulation */
  const loadSystemData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, dtRes, txRes, timerRes] = await Promise.allSettled([
        fetch("/api/kpi/agents"),
        fetch("/api/kpi/doc-types"),
        fetch(`/api/kpi/transactions?date=${today()}`),
        fetch(`/api/kpi/productivity-timers?date=${today()}`),
      ]);

      const agents  = agentsRes.status  === "fulfilled" && agentsRes.value.ok  ? (await agentsRes.value.json()).agents   ?? [] : [];
      const dts     = dtRes.status      === "fulfilled" && dtRes.value.ok      ? (await dtRes.value.json()).docTypes     ?? [] : [];
      const txs     = txRes.status      === "fulfilled" && txRes.value.ok      ? (await txRes.value.json()).transactions ?? [] : [];
      const timers  = timerRes.status   === "fulfilled" && timerRes.value.ok   ? (await timerRes.value.json()).timers    ?? [] : [];

      const now = Date.now();
      const totalProdSecs = timers.reduce((acc: number, t: any) => {
        let secs = t.productiveSeconds ?? 0;
        if (t.timerStartEpoch && !t.timerPaused) secs += Math.floor((now - t.timerStartEpoch) / 1000);
        return acc + secs;
      }, 0);

      setSysStats({
        agents:               agents.length,
        docTypes:             dts.length,
        txCount:              txs.length,
        timersActive:         timers.filter((t: any) => t.timerStartEpoch && !t.timerPaused).length,
        totalProductiveSeconds: totalProdSecs,
      });

      /* Build cache entry list from routes we just hit */
      setCache([
        { key: "/api/kpi/agents",              size: `${(JSON.stringify(agents).length/1024).toFixed(1)} KB`,  ageSecs: 0,  fresh: true, hits: 1 },
        { key: "/api/kpi/doc-types",           size: `${(JSON.stringify(dts).length/1024).toFixed(1)} KB`,    ageSecs: 0,  fresh: true, hits: 1 },
        { key: `/api/kpi/transactions?date=${today()}`, size: `${(JSON.stringify(txs).length/1024).toFixed(1)} KB`, ageSecs: 0, fresh: true, hits: 1 },
        { key: `/api/kpi/productivity-timers?date=${today()}`, size: `${(JSON.stringify(timers).length/1024).toFixed(1)} KB`, ageSecs: 0, fresh: true, hits: 1 },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSystemData(); }, [loadSystemData]);

  /* Auto-refresh live */
  useEffect(() => {
    if (!live) return;
    const id = setInterval(loadSystemData, 30_000);
    return () => clearInterval(id);
  }, [live, loadSystemData]);

  /* Filtered lists */
  const filteredApi = apiLog.filter(r => {
    const q = apiSearch.toLowerCase();
    const matchSearch = !q || r.path.toLowerCase().includes(q) || r.tag.includes(q) || r.method.toLowerCase().includes(q);
    const matchMethod = !apiMethodFilter || r.method === apiMethodFilter;
    const matchStatus = !apiStatusFilter || (apiStatusFilter === "ok" ? r.status < 400 : r.status >= 400);
    return matchSearch && matchMethod && matchStatus;
  });

  const filteredDb = dbLog.filter(r => {
    const q = dbSearch.toLowerCase();
    return !q || r.collection.toLowerCase().includes(q) || r.op.toLowerCase().includes(q);
  });

  const errors = apiLog.filter(r => r.status >= 400);
  const avgMs  = apiLog.length ? Math.round(apiLog.reduce((a, r) => a + r.ms, 0) / apiLog.length) : 0;

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">

      {/* ── Unauthorized Warning Modal ── */}
      {!acknowledged && (
        <UnauthorizedWarningModal onAcknowledge={() => setAcknowledged(true)} />
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">System</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Logs &amp; Cache Inspector</h1>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">
              Real-time API activity, DB queries, timer beacons, and route cache
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <span className={`w-2 h-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-zinc-600"}`} />
              {live ? "Live" : "Paused"}
            </span>
            <button
              onClick={() => setLive(l => !l)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                live
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400"
              }`}
            >
              {live ? "Pause" : "Resume"}
            </button>
            <button
              onClick={loadSystemData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => { setApiLog([]); setDbLog([]); setBeacons([]); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all"
            >
              <Trash2 size={12} /> Clear logs
            </button>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "API requests",    value: apiLog.length,  color: "text-slate-900 dark:text-zinc-100" },
            { label: "Errors",          value: errors.length,  color: errors.length > 0 ? "text-red-500 dark:text-red-400" : "text-slate-900 dark:text-zinc-100" },
            { label: "Avg response",    value: apiLog.length ? `${avgMs}ms` : "—", color: avgMs > 300 ? "text-amber-500" : "text-slate-900 dark:text-zinc-100" },
            { label: "Timer beacons",   value: beacons.length, color: "text-slate-900 dark:text-zinc-100" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-4 text-center">
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-1 mb-5 w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            const count = t.key === "errors" ? errors.length : t.key === "beacon" ? beacons.length : 0;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === t.key ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                }`}
              >
                <Icon size={11} />
                {t.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    activeTab === t.key ? "bg-white/20 text-white" : (t.key === "errors" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500")
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── API LOG ── */}
        {activeTab === "api" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={apiSearch} onChange={e => setApiSearch(e.target.value)} placeholder="Filter path, tag, method…"
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-700 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400" />
              </div>
              <select value={apiMethodFilter} onChange={e => setApiMethodFilter(e.target.value)}
                className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none">
                <option value="">All methods</option>
                {["GET","POST","PATCH","DELETE"].map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={apiStatusFilter} onChange={e => setApiStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none">
                <option value="">All statuses</option>
                <option value="ok">2xx OK</option>
                <option value="err">4xx / 5xx errors</option>
              </select>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">{filteredApi.length} entries</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredApi.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-zinc-500 text-sm py-10">No API calls captured yet — calls are intercepted automatically.</p>
              ) : filteredApi.slice(0, 100).map(r => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 min-w-[64px]">{formatTime(r.ts)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill label={r.method} cls={METHOD_COLORS[r.method] ?? "bg-slate-100 text-slate-600 border-slate-200"} />
                      <span className="font-mono text-xs text-slate-700 dark:text-zinc-200 truncate max-w-[340px]">{r.path}</span>
                      <Pill label={String(r.status)} cls={statusColor(r.status)} />
                      {r.tag && <Pill label={r.tag} cls={TAG_COLORS[r.tag] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"} />}
                    </div>
                    {r.detail && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{r.detail}</p>}
                    {r.responseSize != null && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{(r.responseSize / 1024).toFixed(1)} KB response</p>
                    )}
                  </div>
                  <span className={`text-[11px] font-mono mt-0.5 ${msColor(r.ms)}`}>{formatMs(r.ms)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DB QUERIES ── */}
        {activeTab === "db" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={dbSearch} onChange={e => setDbSearch(e.target.value)} placeholder="Filter collection, operation…"
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-700 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400" />
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">{filteredDb.length} queries</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredDb.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-zinc-500 text-sm py-10">No DB queries logged yet. Write operations (POST/PATCH/DELETE) generate DB log entries.</p>
              ) : filteredDb.slice(0, 100).map(r => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 min-w-[64px]">{formatTime(r.ts)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill label={r.op} cls="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800" />
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{r.collection}</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 mt-1">{r.filter}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{r.docs} doc(s) affected</p>
                  </div>
                  <span className={`text-[11px] font-mono mt-0.5 ${msColor(r.ms)}`}>{formatMs(r.ms)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CACHE / STATE ── */}
        {activeTab === "cache" && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                <Server size={13} className="text-indigo-500 dark:text-indigo-400" />
                <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest">Route cache entries</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {cache.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-zinc-500 text-sm py-10">Cache entries load after the first API calls.</p>
                ) : cache.map(e => (
                  <div key={e.key} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <span className="font-mono text-xs text-slate-600 dark:text-zinc-300 flex-1 truncate">{e.key}</span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">{e.size}</span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">{e.ageSecs}s old</span>
                    <Pill label={e.fresh ? "fresh" : "stale"} cls={e.fresh
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"} />
                  </div>
                ))}
              </div>
            </div>

            {sysStats && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
                <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={13} className="text-indigo-500 dark:text-indigo-400" />
                  Today's state snapshot
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Agents loaded",     value: sysStats.agents },
                    { label: "Task types",         value: sysStats.docTypes },
                    { label: "TX today",           value: sysStats.txCount },
                    { label: "Active timers",      value: sysStats.timersActive },
                    { label: "Total prod. time",   value: formatHms(sysStats.totalProductiveSeconds) },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 dark:bg-zinc-800 rounded-xl px-3 py-3">
                      <p className="text-base font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{s.value}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-relaxed">
                  Agent list and doc-type list are cached client-side after first load. TX records refetch on agent/date change. Timer state syncs to DB on every start, pause, resume, and end action. Beacon flushes on page hide/unload via <span className="font-mono">sendBeacon()</span>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TIMER BEACONS ── */}
        {activeTab === "beacon" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <Wifi size={13} className="text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest">Timer beacon log</h2>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto">{beacons.length} beacons</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {beacons.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Wifi size={24} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-zinc-400">No beacons yet</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Beacons fire via <span className="font-mono">navigator.sendBeacon()</span> when a tab closes or hides while a productivity timer is active.</p>
                </div>
              ) : beacons.map(b => (
                <div key={b.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 min-w-[64px]">{formatTime(b.ts)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill label="sendBeacon" cls="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" />
                      <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">POST /api/kpi/timer-beacon</span>
                    </div>
                    {b.display !== "—" && (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                        Flushed <span className="font-mono font-semibold text-slate-700 dark:text-zinc-200">{b.display}</span> productive seconds on page hide/unload
                      </p>
                    )}
                  </div>
                  <Pill label={b.ok ? "ok" : "fail"} cls={b.ok
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ERRORS ── */}
        {activeTab === "errors" && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-500 dark:text-red-400" />
              <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest">Error log</h2>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-auto">{errors.length} errors</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {errors.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 size={24} className="text-green-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-zinc-400">No errors</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">4xx and 5xx responses will appear here.</p>
                </div>
              ) : errors.map(r => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 min-w-[64px]">{formatTime(r.ts)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill label={String(r.status)} cls={statusColor(r.status)} />
                      <Pill label={r.method} cls={METHOD_COLORS[r.method] ?? "bg-slate-100 text-slate-600 border-slate-200"} />
                      <span className="font-mono text-xs text-slate-600 dark:text-zinc-300 truncate max-w-[300px]">{r.path}</span>
                    </div>
                    <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{r.detail ?? "Unspecified error"}</p>
                  </div>
                  <span className={`text-[11px] font-mono mt-0.5 ${msColor(r.ms)}`}>{formatMs(r.ms)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SYSTEM INFO ── */}
        {activeTab === "system" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-4">API routes</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ROUTE_TAGS).map(([path, tag]) => (
                  <div key={path} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[220px]">{path}</span>
                    <Pill label={tag} cls={TAG_COLORS[tag] ?? "bg-slate-100 text-slate-600 border-slate-200"} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-4">Mongoose collections</h2>
              <div className="grid grid-cols-3 gap-2">
                {["Transaction","Agent","DocType","ProductivityTimer","AgentSession"].map(col => (
                  <div key={col} className="px-3 py-2 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">{col}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                      {dbLog.filter(d => d.collection === col).length} ops this session
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-3">Session summary</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total API calls",    value: apiLog.length },
                  { label: "Write operations",   value: apiLog.filter(r => r.method !== "GET").length },
                  { label: "Read operations",    value: apiLog.filter(r => r.method === "GET").length },
                  { label: "DB queries logged",  value: dbLog.length },
                  { label: "Error rate",         value: apiLog.length ? `${Math.round(errors.length/apiLog.length*100)}%` : "—" },
                  { label: "Avg response",       value: apiLog.length ? `${avgMs}ms` : "—" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 dark:bg-zinc-800 rounded-xl px-3 py-3">
                    <p className="text-base font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}