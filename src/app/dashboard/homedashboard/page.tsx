// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import {
  Activity, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  Users, Award, Zap, Shield, Mail, CalendarDays,
  Settings, Sun, Moon, Laptop, User, PauseCircle, Timer,
} from "lucide-react";
import { useTheme } from "next-themes";

/* ─── Types ─── */
interface Summary {
  totalTx: number;
  done: number;
  pending: number;
  hold: number;
  escalated: number;
  avgTat: number;
  completionRate: number;
  totalProductiveSeconds: number;
}

interface AgentStat {
  agentId: string;
  name: string;
  total: number;
  done: number;
  pending: number;
  hold: number;
  escalated: number;
  avgTat: number;
  rate: number;
  productiveSeconds: number; // Add this field
}

interface DailyPoint {
  date: string;
  count: number;
}

/* ─── Helpers ─── */
function formatHms(sec: number) {
  if (!sec && sec !== 0) return "—";
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/* ─── Theme Toggle ─── */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;
  return (
    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
      {([["light", Sun], ["dark", Moon], ["system", Laptop]] as const).map(([t, Icon]) => (
        <button key={t} onClick={() => setTheme(t)}
          className={`p-1.5 rounded-lg transition-all ${theme === t ? "bg-indigo-600 text-white" : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700"}`}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, subtitle, icon: Icon, color = "text-slate-900 dark:text-white" }: {
  label: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-1">{label}</p>
          {subtitle && <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
          <Icon size={18} className="text-indigo-500 dark:text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

/* ─── Status breakdown bar ─── */
function StatusBreakdown({ summary }: { summary: Summary }) {
  const total = summary.totalTx || 1;
  const segments = [
    { label: "Completion", value: summary.done,      pct: Math.round((summary.done / total) * 100),      color: "bg-green-500",  text: "text-green-600 dark:text-green-400"  },
    { label: "Pending",    value: summary.pending,   pct: Math.round((summary.pending / total) * 100),   color: "bg-amber-400",  text: "text-amber-500 dark:text-amber-400"  },
    { label: "Hold",       value: summary.hold,      pct: Math.round((summary.hold / total) * 100),      color: "bg-blue-400",   text: "text-blue-500 dark:text-blue-400"    },
    { label: "Escalation", value: summary.escalated, pct: Math.round((summary.escalated / total) * 100), color: "bg-purple-400", text: "text-purple-500 dark:text-purple-400" },
  ];
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status Breakdown</h3>
        <span className="ml-auto text-[11px] text-slate-400 dark:text-zinc-500">{summary.totalTx} total TX</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
        {segments.map(s => s.value > 0 && (
          <div key={s.label} className={`${s.color} transition-all duration-700`} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-sm ${s.color}`} />
              <span className="text-xs text-slate-500 dark:text-zinc-400">{s.label}</span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${s.text}`}>{s.value}</span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Daily Volume Chart ─── */
function DailyVolumeChart({ data }: { data: DailyPoint[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500 dark:text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Daily Volume</h3>
        </div>
        <span className="text-[10px] text-slate-400">Last 7 days</span>
      </div>
      {data.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">No data available</p>
      ) : (
        <>
          <div className="flex items-end gap-2 h-32 mb-3">
            {data.map((point, idx) => {
              const height = Math.max(4, (point.count / maxCount) * 100);
              const isMax = point.count === maxCount;
              return (
                <div key={point.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className={`text-[9px] font-semibold tabular-nums transition-all ${isMax ? "text-indigo-500" : "opacity-0 group-hover:opacity-100 text-slate-400"}`}>{point.count}</span>
                  <div className={`w-full rounded-lg transition-all duration-500 ${isMax ? "bg-indigo-500" : "bg-indigo-200 dark:bg-indigo-900 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-700"}`}
                    style={{ height: `${height}%`, minHeight: "4px", transitionDelay: `${idx * 30}ms` }} />
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500">{formatShortDate(point.date).split(" ")[1]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-[10px] text-slate-400">Total: {data.reduce((s, d) => s + d.count, 0)} TX</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">Peak: {maxCount}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Top Performers ─── */
function TopPerformers({ agents }: { agents: AgentStat[] }) {
  const topByVolume = [...agents].sort((a, b) => b.total - a.total).slice(0, 3);
  const topByRate   = [...agents].sort((a, b) => b.rate - a.rate).slice(0, 1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award size={16} className="text-amber-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Top Performers</h3>
      </div>
      <div className="space-y-3">
        {topByVolume[0] && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Zap size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{topByVolume[0].name}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {topByVolume[0].total} TX · {topByVolume[0].done} done · {topByVolume[0].hold > 0 ? `${topByVolume[0].hold} hold` : ""} {topByVolume[0].escalated > 0 ? `· ${topByVolume[0].escalated} esc.` : ""}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">MOST ACTIVE</span>
          </div>
        )}
        {topByRate[0] && topByRate[0].agentId !== topByVolume[0]?.agentId && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{topByRate[0].name}</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">{topByRate[0].rate}% completion rate · {topByRate[0].total} TX</p>
              </div>
            </div>
            <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">TOP RATE</span>
          </div>
        )}
        {topByVolume.slice(1).map((agent, idx) => (
          <div key={agent.agentId} className="flex items-center gap-3 p-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-slate-500">
              {agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{agent.name}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-2">
                <span>{agent.total} TX</span>
                <span className="text-green-600 dark:text-green-400">{agent.done} done</span>
                {agent.hold > 0 && <span className="text-blue-500 dark:text-blue-400 flex items-center gap-0.5"><PauseCircle size={9} />{agent.hold}</span>}
              </p>
            </div>
            <span className="text-xs text-slate-400">{agent.rate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Agent Leaderboard ─── */
function AgentLeaderboard({ agents }: { agents: AgentStat[] }) {
  const sorted = [...agents].sort((a, b) => b.total - a.total);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Agent Leaderboard</h3>
      </div>
      <div className="space-y-2">
        {sorted.slice(0, 5).map((agent, idx) => (
          <div key={agent.agentId} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-slate-400 w-5">#{idx + 1}</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{agent.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-600 dark:text-green-400">{agent.done} done</span>
                  <span className="text-[10px] text-amber-500">{agent.pending} pending</span>
                  {agent.hold > 0 && <span className="text-[10px] text-blue-500 dark:text-blue-400 flex items-center gap-0.5"><PauseCircle size={9} />{agent.hold}</span>}
                  {agent.escalated > 0 && <span className="text-[10px] text-purple-500">{agent.escalated} esc.</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{agent.total} TX</p>
              <p className={`text-[10px] font-semibold ${agent.rate >= 80 ? "text-green-600 dark:text-green-400" : agent.rate >= 50 ? "text-amber-500" : "text-red-500"}`}>{agent.rate}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Security Card ─── */
function SecurityCard({ userEmail }: { userEmail?: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Account</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <User size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{userEmail?.split("@")[0] || "User"}</p>
            <p className="text-[11px] text-green-600 dark:text-green-400">Verified Account</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <Mail size={13} className="text-slate-400" />{userEmail || "user@example.com"}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <CalendarDays size={13} className="text-slate-400" />
            Member since {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-start gap-2">
            <Shield size={11} className="text-green-500 mt-0.5" />
            Session protected — authenticated with JWT
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Card ─── */
function SettingsCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Settings</h3>
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Session expires after <span className="font-semibold text-indigo-600 dark:text-indigo-400">30 days</span> of inactivity.
          </p>
        </div>
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
          <Settings size={13} />Preferences
        </button>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function DashboardPage() {
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyPoint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userName, setUserName]     = useState<string>("");
  const [userEmail, setUserEmail]   = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const from = daysAgo(6);
      const to   = today();
      
      // Fetch analytics (which should now use ProductivityTimer model)
      const res  = await fetch(`/api/kpi/analytics?from=${from}&to=${to}`);
      const data = await res.json();
      
      setSummary(data.summary);
      setAgentStats(data.agentStats ?? []);
      setDailyTrend(data.dailyTrend ?? []);
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetch("/api/auth/session").then(r => r.json()).then(data => {
      if (data.user) {
        setUserName(data.user.name || data.user.email?.split("@")[0] || "User");
        setUserEmail(data.user.email || "");
      }
    }).catch(() => {});
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-indigo-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Welcome back, {userName || "User"} — here's what's happening with your team.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {loading && <PageSkeleton />}

        {!loading && summary && (
          <>
            {/* ── Top KPI row: 4 cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <StatCard label="Total TX"         value={summary.totalTx}                           subtitle="last 7 days"               icon={Activity}      color="text-slate-900 dark:text-white"       />
              <StatCard label="Completion Rate"  value={`${summary.completionRate}%`}              subtitle={`${summary.done} done`}    icon={CheckCircle2}  color="text-green-600 dark:text-green-400"   />
              <StatCard label="Pending"          value={summary.pending}                           subtitle="in queue"                  icon={Clock}         color="text-amber-500 dark:text-amber-400"   />
              <StatCard label="Productive Time"  value={formatHms(summary.totalProductiveSeconds)} subtitle="total active handle time"  icon={Timer}         color="text-indigo-500 dark:text-indigo-400" />
            </div>

            {/* ── Second row: Hold + Escalation ── */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                  <PauseCircle size={15} className="text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-500 dark:text-blue-400">{summary.hold}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">On Hold</p>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={15} className="text-purple-500 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-500 dark:text-purple-400">{summary.escalated}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">Escalations</p>
                </div>
              </div>
            </div>

            {/* ── Main layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
              <div className="lg:col-span-2 space-y-5">
                <DailyVolumeChart data={dailyTrend} />
                <StatusBreakdown summary={summary} />
                <TopPerformers agents={agentStats} />
              </div>
              <div className="space-y-5">
                <AgentLeaderboard agents={agentStats} />
                <SecurityCard userEmail={userEmail} />
                <SettingsCard />
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Data for the last 7 days · Last updated {new Date().toLocaleTimeString()}
              </p>
            </div>
          </>
        )}

        {!loading && !summary && (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <Activity size={48} className="text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-zinc-400">No data available</p>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-1">Complete some transactions to see your dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}