// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Calendar,
  Award,
  Zap,
  Shield,
  Mail,
  CalendarDays,
  LogOut,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  User,
  Verified,
} from "lucide-react";
import { useTheme } from "next-themes";

/* ─── Types ─── */
interface Summary {
  totalTx: number;
  done: number;
  pending: number;
  noDoc: number;
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
  noDoc: number;
  escalated: number;
  avgTat: number;
  rate: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

/* ─── Helpers ─── */
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
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
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-lg transition-all ${
          theme === "light"
            ? "bg-indigo-600 text-white"
            : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700"
        }`}
      >
        <Sun size={15} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-lg transition-all ${
          theme === "dark"
            ? "bg-indigo-600 text-white"
            : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700"
        }`}
      >
        <Moon size={15} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-lg transition-all ${
          theme === "system"
            ? "bg-indigo-600 text-white"
            : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700"
        }`}
      >
        <Laptop size={15} />
      </button>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wide mt-1">
            {label}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
          <Icon size={18} className="text-indigo-500 dark:text-indigo-400" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={`text-[10px] font-semibold ${
              trend.isPositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {trend.isPositive ? "+" : "-"}
            {trend.value}%
          </span>
          <span className="text-[10px] text-slate-400">vs last period</span>
        </div>
      )}
    </div>
  );
}

/* ─── Daily Volume Chart ─── */
function DailyVolumeChart({ data }: { data: DailyPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500 dark:text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Daily Volume
          </h3>
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
                <div
                  key={point.date}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      isMax
                        ? "bg-indigo-500"
                        : "bg-indigo-200 dark:bg-indigo-900 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-700"
                    }`}
                    style={{
                      height: `${height}%`,
                      minHeight: "4px",
                      transitionDelay: `${idx * 30}ms`,
                    }}
                  />
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                    {formatShortDate(point.date).split(" ")[1]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-[10px] text-slate-400">Total: {data.reduce((s, d) => s + d.count, 0)} TX</span>
            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
              Peak: {maxCount}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Top Performers ─── */
function TopPerformers({ agents }: { agents: AgentStat[] }) {
  const topByVolume = [...agents].sort((a, b) => b.total - a.total).slice(0, 3);
  const topByRate = [...agents].sort((a, b) => b.rate - a.rate).slice(0, 3);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award size={16} className="text-amber-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Top Performers
        </h3>
      </div>

      <div className="space-y-4">
        {/* Most Active */}
        {topByVolume[0] && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Zap size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {topByVolume[0].name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {topByVolume[0].total} TX · {topByVolume[0].done} done
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">
              MOST ACTIVE
            </span>
          </div>
        )}

        {/* Completion Rate Leader */}
        {topByRate[0] && topByRate[0].agentId !== topByVolume[0]?.agentId && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {topByRate[0].name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {topByRate[0].rate}% completion rate
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">
              TOP RATE
            </span>
          </div>
        )}

        {/* Second best */}
        {topByVolume[1] && (
          <div className="flex items-center gap-3 p-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-slate-500">
              {topByVolume[1].name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                {topByVolume[1].name}
              </p>
              <p className="text-[10px] text-slate-400">
                {topByVolume[1].total} transactions · {topByVolume[1].done} done
              </p>
            </div>
            <span className="text-xs text-slate-400">{topByVolume[1].rate}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Agent Leaderboard ─── */
function AgentLeaderboard({ agents }: { agents: AgentStat[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Agent Leaderboard
        </h3>
      </div>
      <div className="space-y-3">
        {agents.slice(0, 4).map((agent, idx) => (
          <div
            key={agent.agentId}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-slate-400 w-5">
                #{idx + 1}
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  {agent.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                    <CheckCircle2 size={9} /> {agent.done}
                  </span>
                  <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                    <Clock size={9} /> {agent.pending}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {agent.total} TX
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Verified size={10} className="text-indigo-500" />
                <span className="text-[9px] text-slate-400">Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Security Card ─── */
function SecurityCard({ userEmail }: { userEmail?: string }) {
  const memberSince = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Security
        </h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <User size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {userEmail?.split("@")[0] || "User"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
              <Verified size={10} className="text-green-500" /> Verified Account
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <Mail size={13} className="text-slate-400" />
            <span>{userEmail || "user@example.com"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <CalendarDays size={13} className="text-slate-400" />
            <span>Member since {memberSince}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-start gap-2">
            <Shield size={11} className="text-green-500 mt-0.5" />
            Your session is protected — authenticated with JWT
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          Settings
        </h3>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Your session will expire after <span className="font-semibold text-indigo-600 dark:text-indigo-400">30 days</span> of inactivity.
            Use the sign out button to end your session immediately.
          </p>
        </div>

        <div className="flex items-center gap-2">
          
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
            <Settings size={13} />
            Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const from = daysAgo(6);
      const to = today();
      const res = await fetch(`/api/kpi/analytics?from=${from}&to=${to}`);
      const data = await res.json();
      setSummary(data.summary);
      setAgentStats(data.agentStats ?? []);
      setDailyTrend(data.dailyTrend ?? []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Fetch user info from session
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.name || data.user.email?.split("@")[0] || "User");
          setUserEmail(data.user.email || "");
        }
      })
      .catch(() => {});
  }, [loadData]);

  // Calculate today's stats
  const todayStats = summary
    ? {
        total: summary.totalTx,
        completionRate: summary.completionRate,
        pendingRate: Math.round((summary.pending / summary.totalTx) * 100) || 0,
      }
    : { total: 0, completionRate: 0, pendingRate: 0 };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header with Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={18} className="text-indigo-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                Overview
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Welcome back, {userName || "User"} — here's what's happening with your team today.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && summary && (
          <>
            {/* KPI Cards - Today's metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="TODAY"
                value={todayStats.total}
                subtitle="total transactions"
                icon={Activity}
              />
              <StatCard
                label="Completion Rate"
                value={`${todayStats.completionRate}%`}
                subtitle={`${summary.done} done · ${summary.pending} pending`}
                icon={CheckCircle2}
              />
              <StatCard
                label="Pending Rate"
                value={`${todayStats.pendingRate}%`}
                subtitle="in queue"
                icon={Clock}
              />
            </div>

            {/* Main 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
              {/* Left column - 2/3 width on large screens */}
              <div className="lg:col-span-2 space-y-5">
                <DailyVolumeChart data={dailyTrend} />
                <TopPerformers agents={agentStats} />
              </div>

              {/* Right column - 1/3 width */}
              <div className="space-y-5">
                <AgentLeaderboard agents={agentStats} />
                <SecurityCard userEmail={userEmail} />
                <SettingsCard />
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-4 text-center">
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Data for the last 7 days · Last updated {new Date().toLocaleTimeString()}
              </p>
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !summary && (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl">
            <Activity size={48} className="text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-zinc-400">No data available</p>
            <p className="text-slate-400 dark:text-zinc-500 text-sm mt-1">
              Complete some transactions to see your dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}