"use client";

import { useState, useEffect } from "react";
import {
  Activity, CheckCircle2, AlertTriangle, Clock, Users,
  TrendingUp, Award, Zap, BarChart2,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─── */
interface Summary {
  totalTx: number;
  done: number;
  pending: number;
  noDoc: number;
  escalated: number;
  avgTat: number;
  completionRate: number;
}

interface AgentStat {
  agentId: string;
  name: string;
  total: number;
  done: number;
  pending: number;
  noDoc: number;
  escalated: number;
  avgTat: number;
  rate: number;
}

interface DocTypeStat {
  type: string;
  count: number;
  avgTat: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

/* ─── Helpers ─── */
function formatTat(sec?: number) {
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
function fmtShort(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Mini sparkline ─── */
function Sparkline({ data }: { data: DailyPoint[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 120, h = 32;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── DonutRing ─── */
function DonutRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-zinc-700" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className={color} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

/* ─── Main Component ─── */
export function DashboardKpi() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [docTypeStats, setDocTypeStats] = useState<DocTypeStat[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Today's totals
  const [todaySummary, setTodaySummary] = useState<Summary | null>(null);

  useEffect(() => {
    const from7 = daysAgo(6);
    const t = today();

    Promise.all([
      fetch(`/api/kpi/analytics?from=${from7}&to=${t}`).then(r => r.json()),
      fetch(`/api/kpi/analytics?from=${t}&to=${t}`).then(r => r.json()),
    ]).then(([week, day]) => {
      setSummary(week.summary ?? null);
      setAgentStats(week.agentStats ?? []);
      setDocTypeStats(week.docTypeStats ?? []);
      setDailyTrend(week.dailyTrend ?? []);
      setTodaySummary(day.summary ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 animate-pulse">
            <div className="h-6 w-16 bg-slate-100 dark:bg-zinc-800 rounded mb-2" />
            <div className="h-3 w-24 bg-slate-100 dark:bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-8 text-center mb-2">
        <Activity size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
        <p className="text-slate-500 dark:text-zinc-400 text-sm">No KPI data yet.</p>
        <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">
          Start logging transactions in the{" "}
          <Link href="/dashboard/tx-log" className="text-indigo-500 dark:text-indigo-400 underline underline-offset-2">TX Log</Link>.
        </p>
      </div>
    );
  }

  const topAgent = agentStats.length ? [...agentStats].sort((a, b) => b.rate - a.rate)[0] : null;
  const mostActive = agentStats.length ? [...agentStats].sort((a, b) => b.total - a.total)[0] : null;
  const topDoc = docTypeStats.length ? [...docTypeStats].sort((a, b) => b.count - a.count)[0] : null;
  const maxDaily = Math.max(...dailyTrend.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      {/* ── Today vs 7-day header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          KPI Overview — Last 7 Days
        </p>
        <Link
          href="/dashboard/analytics"
          className="text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold hover:underline underline-offset-2"
        >
          Full analytics →
        </Link>
      </div>

      {/* ── Today's quick stats ── */}
      {todaySummary && todaySummary.totalTx > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-400">Today</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{todaySummary.totalTx} TX</span>
          <span className="text-sm text-green-600 dark:text-green-400 font-semibold">{todaySummary.done} done</span>
          {todaySummary.pending > 0 && <span className="text-sm text-amber-500 dark:text-amber-400 font-semibold">{todaySummary.pending} pending</span>}
          {todaySummary.escalated > 0 && <span className="text-sm text-purple-600 dark:text-purple-400 font-semibold">{todaySummary.escalated} escalated</span>}
          <span className="text-sm text-indigo-500 dark:text-indigo-400 font-mono">{todaySummary.completionRate}% rate</span>
        </div>
      )}

      {/* ── 7-day KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total TX",       value: summary.totalTx,            icon: Activity,      color: "text-slate-700 dark:text-zinc-200"  },
          { label: "Completion rate", value: `${summary.completionRate}%`, icon: CheckCircle2,  color: "text-green-600 dark:text-green-400"  },
          { label: "Escalations",    value: summary.escalated,          icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400" },
          { label: "Avg Handle Time", value: formatTat(summary.avgTat),  icon: Clock,         color: "text-indigo-600 dark:text-indigo-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm shadow-slate-100/60 dark:shadow-black/20">
              <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-indigo-400 dark:text-indigo-400" />
              </div>
              <div>
                <p className={`text-xl font-bold leading-none tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Spotlight + Chart row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Top performer */}
        {topAgent && (
          <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                <Award size={12} className="text-amber-500 dark:text-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400">Top Performer</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[120px]">{topAgent.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{topAgent.total} TX · {topAgent.done} done</p>
              </div>
              <div className="flex flex-col items-center">
                <DonutRing pct={topAgent.rate} color="text-amber-400" size={44} />
                <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400 -mt-7">{topAgent.rate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Most active */}
        {mostActive && (
          <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                <Zap size={12} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Most Active</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate">{mostActive.name}</p>
            <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mt-1">{mostActive.total}</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">transactions · {mostActive.done} done</p>
          </div>
        )}

        {/* Top doc type */}
        {topDoc && (
          <div className="bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
                <BarChart2 size={12} className="text-green-600 dark:text-green-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Top Doc Type</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate">{topDoc.type}</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{topDoc.count}</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">transactions · avg {formatTat(topDoc.avgTat)}</p>
          </div>
        )}
      </div>

      {/* ── Daily trend bar chart ── */}
      {dailyTrend.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5 shadow-sm shadow-slate-100/60 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={13} className="text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Daily Volume</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
              <Sparkline data={dailyTrend} />
              <span className="ml-2">Peak: <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{maxDaily}</span></span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {dailyTrend.map((d, i) => {
              const pct = Math.max(4, (d.count / maxDaily) * 100);
              const isMax = d.count === maxDaily;
              const isToday = d.date === today();
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <span className={`text-[9px] font-semibold tabular-nums transition-all absolute -top-4 ${
                    isMax ? "text-indigo-500 dark:text-indigo-400 opacity-100" : "text-slate-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100"
                  }`}>{d.count}</span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isToday ? "bg-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" :
                      isMax ? "bg-indigo-400 dark:bg-indigo-500" : "bg-indigo-200 dark:bg-indigo-900 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-800"
                    }`}
                    style={{ height: `${pct}%`, transitionDelay: `${i * 30}ms` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {dailyTrend.map(d => (
              <div key={d.date} className="flex-1 text-center">
                <span className={`text-[9px] ${d.date === today() ? "text-indigo-500 dark:text-indigo-400 font-semibold" : "text-slate-400 dark:text-zinc-500"}`}>
                  {fmtShort(d.date).split(" ")[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent mini-leaderboard ── */}
      {agentStats.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5 shadow-sm shadow-slate-100/60 dark:shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Agent Leaderboard</span>
            </div>
            <Link href="/dashboard/analytics" className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:underline underline-offset-2">
              View all →
            </Link>
          </div>
          <div className="space-y-2.5">
            {[...agentStats].sort((a, b) => b.rate - a.rate).slice(0, 5).map((a, i) => (
              <div key={a.agentId} className="flex items-center gap-3">
                <span className={`text-[10px] font-mono w-4 text-right flex-shrink-0 ${
                  i === 0 ? "text-amber-500 dark:text-amber-400 font-bold" : "text-slate-400 dark:text-zinc-500"
                }`}>#{i + 1}</span>
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {a.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium flex-1 truncate">{a.name}</span>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-slate-400 dark:text-zinc-500">{a.total} TX</span>
                  <span className={`font-bold ${a.rate >= 80 ? "text-green-600 dark:text-green-400" : a.rate >= 50 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
                    {a.rate}%
                  </span>
                </div>
                <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
                  <div
                    className={`h-full rounded-full ${a.rate >= 80 ? "bg-green-500" : a.rate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${a.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}