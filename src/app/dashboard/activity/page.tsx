"use client";

import { useState, useEffect } from "react";
import {
  LogIn,
  LogOut,
  Shield,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Globe,
  Smartphone,
  ChevronDown,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
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
  ownerEmail?: string;
}

interface Agent {
  _id: string;
  name: string;
  group?: string;
}

interface Summary {
  totalTx: number; done: number; pending: number; noDoc: number;
  escalated: number; avgTat: number; completionRate: number;
  totalProductiveSeconds: number; // ← add this
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatHms(sec?: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function relativeDate(dateStr: string) {
  const t = today();
  const y = daysAgo(1);
  if (dateStr === t) return "Today";
  if (dateStr === y) return "Yesterday";
  return formatDate(dateStr);
}

const STATUS_CONFIG = {
  COMPLETION: { label: "Completion", color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",   dot: "bg-green-500"  },
  PENDING:    { label: "Pending",    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",   dot: "bg-amber-500"  },
  ESCALATION: { label: "Escalation", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800", dot: "bg-purple-500" },
};

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function ActivityPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [agents, setAgents]             = useState<Agent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [from, setFrom]                 = useState(daysAgo(6));
  const [to, setTo]                     = useState(today());
  const [filterAgent, setFilterAgent]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 15;

  /* ── Fetch ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/kpi/transactions?from=${from}&to=${to}`).then(r => r.json()),
      fetch("/api/kpi/agents").then(r => r.json()),
    ]).then(([txData, agentData]) => {
      const allTx: Transaction[] = (txData.transactions ?? [])
        .filter((t: Transaction) => t.endTime); // only completed
      setTransactions(allTx);
      setAgents(agentData.agents ?? []);
      setLoading(false);
      setPage(1);
    });
  }, [from, to]);

  /* ── Filter ── */
  const filtered = transactions.filter(tx => {
    if (filterAgent !== "all" && tx.agentName !== filterAgent) return false;
    if (filterStatus !== "all" && tx.status !== filterStatus) return false;
    return true;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = filtered.length > paginated.length;

  /* ── Stats ── */
  const totalTat      = transactions.reduce((s, t) => s + (t.tat ?? 0), 0);
  const totalVolume   = transactions.reduce((s, t) => s + (t.volume ?? 0), 0);
  const completions   = transactions.filter(t => t.status === "COMPLETION").length;
  const escalations   = transactions.filter(t => t.status === "ESCALATION").length;
  const completionRate = transactions.length
    ? Math.round((completions / transactions.length) * 100)
    : 0;

  /* ── Group by date ── */
  const byDate: Record<string, Transaction[]> = {};
  for (const tx of paginated) {
    if (!byDate[tx.date]) byDate[tx.date] = [];
    byDate[tx.date].push(tx);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  /* ── Unique agents for filter ── */
  const uniqueAgents = [...new Set(transactions.map(t => t.agentName))].sort();

  const formattedFrom = new Date(from + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formattedTo   = new Date(to   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KPI</p>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Activity Log</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">{formattedFrom} — {formattedTo}</p>
        </div>

        {/* ── Date range + filters ── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-zinc-500">FROM</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
            <span className="text-xs text-slate-400 dark:text-zinc-500">TO</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
            <button onClick={() => { setFrom(today()); setTo(today()); }}
              className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Agent filter */}
            <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all">
              <option value="all">All agents</option>
              {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {/* Status filter */}
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all">
              <option value="all">All statuses</option>
              <option value="COMPLETION">Completion</option>
              <option value="PENDING">Pending</option>
              <option value="ESCALATION">Escalation</option>
            </select>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total TX",          value: transactions.length,    icon: Activity,      color: "text-slate-700 dark:text-zinc-200"  },
            { label: "Completion rate",    value: `${completionRate}%`,   icon: CheckCircle2,  color: "text-green-600 dark:text-green-400"  },
            { label: "Escalations",        value: escalations,            icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400" },
            { label: "Total handle time",  value: formatHms(totalTat),    icon: Clock,         color: "text-indigo-600 dark:text-indigo-400" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-indigo-500 dark:text-indigo-400" />
                </div>
                <div>
                  <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Agent summary pills ── */}
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {agents.map(agent => {
              const agentTx = transactions.filter(t => t.agentName === agent.name);
              const agentTat = agentTx.reduce((s, t) => s + (t.tat ?? 0), 0);
              const agentCompl = agentTx.filter(t => t.status === "COMPLETION").length;
              return (
                <button
                  key={agent._id}
                  onClick={() => { setFilterAgent(filterAgent === agent.name ? "all" : agent.name); setPage(1); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    filterAgent === agent.name
                      ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span>{agent.name}</span>
                  {agent.group && <span className="text-slate-400 dark:text-zinc-500">· {agent.group}</span>}
                  <span className="text-slate-400 dark:text-zinc-500">|</span>
                  <span>{agentTx.length} TX</span>
                  <span className="text-green-600 dark:text-green-400">{agentCompl} done</span>
                  <span className="text-indigo-500 dark:text-indigo-400 font-mono">{formatHms(agentTat)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Timeline ── */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 dark:text-zinc-500 text-sm">Loading activity…</div>
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
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    {relativeDate(date)}
                  </p>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">{byDate[date].length} tx</span>
                </div>

                {/* Transactions for this date */}
                <div className="relative">
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200 dark:bg-zinc-700" />

                  <div className="space-y-1.5">
                    {byDate[date].map(tx => {
                      const cfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG["PENDING"];
                      return (
                        <div key={tx._id} className="group flex gap-4">
                          {/* Timeline icon */}
                          <div className="flex-shrink-0 flex items-start pt-3.5">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center z-10 transition-all group-hover:scale-105 ${cfg.bg}`}>
                              <FileText size={13} className={cfg.color} />
                            </div>
                          </div>

                          {/* Card */}
                          <div className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-4 my-1 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:border-slate-300 dark:hover:border-zinc-600 transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{tx.companyName}</p>
                                  <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-zinc-500 ml-3.5">{tx.docType} · {tx.agentName}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-mono text-indigo-500 dark:text-indigo-400 font-semibold">{formatHms(tx.tat)}</p>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{tx.startTime} → {tx.endTime}</p>
                              </div>
                            </div>

                            {/* Meta row */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-x-4 gap-y-1">
                              <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                                <Users size={10} className="text-slate-400 dark:text-zinc-500" />
                                {tx.agentName}
                                {(() => {
                                  const agent = agents.find(a => a.name === tx.agentName);
                                  return agent?.group ? <span className="text-slate-400 dark:text-zinc-500 ml-1">· {agent.group}</span> : null;
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

        {/* ── Load more ── */}
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

        {/* ── Bottom summary ── */}
        {!loading && filtered.length > 0 && (
          <div className="mt-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">{filtered.length}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Transactions shown</p>
              </div>
              <div>
                <p className="text-lg font-bold text-indigo-500 dark:text-indigo-400 font-mono">{formatHms(filtered.reduce((s, t) => s + (t.tat ?? 0), 0))}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Total handle time</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{filtered.filter(t => t.status === "COMPLETION").length}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Completed</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}