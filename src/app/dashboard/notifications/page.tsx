"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  PauseCircle,
  Users,
  FileText,
  Timer,
  ChevronRight,
  X,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

/* ─── Types ─── */
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
}

interface AgentDailyRate {
  date: string;
  rate: number | null;
}

interface Transaction {
  _id: string;
  agentName: string;
  docType: string;
  companyName: string;
  volume: number;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  date: string;
  notes?: string;
}

interface TimerRecord {
  _id: string;
  productiveSeconds: number;
  timerStartEpoch: number | null;
  timerPaused: boolean;
}

interface Notification {
  id: string;
  type: "warning" | "critical" | "info" | "success";
  title: string;
  description: string;
  timestamp: string;
  link?: string;
  linkText?: string;
  dismissible?: boolean;
}

/* ─── Helpers ─── */
function formatTat(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/* ─── Main Page ─── */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all necessary data and generate notifications
  const loadNotifications = useCallback(async () => {
    try {
      // Fetch analytics data for the last 7 days
      const from = daysAgo(6);
      const to = today();

      const [analyticsRes, txRes, timerRes] = await Promise.all([
        fetch(`/api/kpi/analytics?from=${from}&to=${to}`),
        fetch(`/api/kpi/transactions?date=${today()}`),
        fetch(`/api/kpi/productivity-timer?date=${today()}`),
      ]);

      const analytics = await analyticsRes.json();
      const txData = await txRes.json();
      const timerData = await timerRes.json();

      const agentStats: AgentStat[] = analytics.agentStats ?? [];
      const agentDailyRates: Record<string, AgentDailyRate[]> = analytics.agentDailyRates ?? {};
      const transactions: Transaction[] = txData.transactions ?? [];
      const timerRecord: TimerRecord | null = timerData.record ?? null;

      const newNotifications: Notification[] = [];

      // 1. Consecutive low performance alerts
      for (const agent of agentStats) {
        const dailyRates = agentDailyRates[agent.agentId] ?? [];
        let currentStreak = 0;
        let maxStreak = 0;
        let streakStartDate: string | null = null;

        for (let i = dailyRates.length - 1; i >= 0; i--) {
          const day = dailyRates[i];
          if (day.rate !== null && day.rate < 60) {
            if (currentStreak === 0) streakStartDate = day.date;
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
          } else {
            currentStreak = 0;
            streakStartDate = null;
          }
        }

        if (maxStreak >= 3) {
          const isCritical = maxStreak >= 5;
          newNotifications.push({
            id: `low-perf-${agent.agentId}-${from}`,
            type: isCritical ? "critical" : "warning",
            title: `${agent.name} - ${maxStreak}-day low performance streak`,
            description: `Completion rate has been below 60% for ${maxStreak} consecutive days. Current rate: ${agent.rate}%.`,
            timestamp: new Date().toISOString(),
            link: `/dashboard/analytics?agent=${agent.agentId}`,
            linkText: "View Analytics",
            dismissible: true,
          });
        }
      }

      // 2. Stalled / pending transactions (older than 3 days)
      const todayDate = today();
      const stalledTransactions = transactions.filter((tx) => {
        if (tx.status !== "PENDING" && tx.status !== "HOLD") return false;
        const txDate = new Date(tx.date);
        const nowDate = new Date(todayDate);
        const diffDays = Math.floor(
          (nowDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 2;
      });

      const pendingCount = stalledTransactions.filter((tx) => tx.status === "PENDING").length;
      const holdCount = stalledTransactions.filter((tx) => tx.status === "HOLD").length;

      if (pendingCount > 0) {
        newNotifications.push({
          id: `stalled-pending-${todayDate}`,
          type: "warning",
          title: `${pendingCount} pending transaction${pendingCount > 1 ? "s" : ""} needs attention`,
          description: `These transactions have been pending for 2+ days. Review and take action.`,
          timestamp: new Date().toISOString(),
          link: `/dashboard/tx-log?status=PENDING`,
          linkText: "Review Pending",
          dismissible: true,
        });
      }

      if (holdCount > 0) {
        newNotifications.push({
          id: `stalled-hold-${todayDate}`,
          type: "info",
          title: `${holdCount} transaction${holdCount > 1 ? "s are" : " is"} on hold`,
          description: `Resume these held items to complete them.`,
          timestamp: new Date().toISOString(),
          link: `/dashboard/tx-log?status=HOLD`,
          linkText: "View Held Items",
          dismissible: true,
        });
      }

      // 3. Low completion rate for the day (< 50%)
      if (agentStats.length > 0) {
        const lowPerformers = agentStats.filter((a) => a.rate < 50 && a.total > 0);
        if (lowPerformers.length > 0) {
          newNotifications.push({
            id: `low-daily-rate-${todayDate}`,
            type: "warning",
            title: `${lowPerformers.length} agent${lowPerformers.length > 1 ? "s have" : " has"} low completion rate today`,
            description: lowPerformers
              .map((a) => `${a.name} (${a.rate}%)`)
              .join(", "),
            timestamp: new Date().toISOString(),
            link: `/dashboard/analytics`,
            linkText: "View All Agents",
            dismissible: true,
          });
        }
      }

      // 4. Productivity timer not started today
      if (!timerRecord || (timerRecord.productiveSeconds === 0 && !timerRecord.timerStartEpoch)) {
        newNotifications.push({
          id: `timer-not-started-${todayDate}`,
          type: "info",
          title: "Productivity timer not started",
          description: "Click 'Start Session' and begin tracking your productive hours for today.",
          timestamp: new Date().toISOString(),
          link: `/dashboard/tx-log`,
          linkText: "Go to TX Log",
          dismissible: true,
        });
      }

      // 5. High escalation count (> 3)
      const totalEscalated = analytics.summary?.escalated ?? 0;
      if (totalEscalated > 3) {
        newNotifications.push({
          id: `high-escalation-${todayDate}`,
          type: "critical",
          title: `${totalEscalated} escalated transaction${totalEscalated > 1 ? "s" : ""} require immediate attention`,
          description: "Escalated items need supervisory review.",
          timestamp: new Date().toISOString(),
          link: `/dashboard/tx-log?status=ESCALATION`,
          linkText: "View Escalations",
          dismissible: true,
        });
      }

      // 6. No transactions logged today
      const todaysTransactions = transactions.filter((tx) => tx.date === todayDate);
      if (todaysTransactions.length === 0 && timerRecord?.productiveSeconds === 0) {
        newNotifications.push({
          id: `no-transactions-${todayDate}`,
          type: "info",
          title: "No transactions logged today",
          description: "Start logging your tasks to track productivity.",
          timestamp: new Date().toISOString(),
          link: `/dashboard/tx-log`,
          linkText: "Log Transaction",
          dismissible: true,
        });
      }

      // Sort by priority: critical > warning > info > success, then by timestamp
      const priorityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
      newNotifications.sort((a, b) => {
        const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotifications(newNotifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
      case "info":
        return <Bell className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getBgClass = (type: Notification["type"]) => {
    switch (type) {
      case "critical":
        return "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800";
      case "warning":
        return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
      case "info":
        return "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800";
      case "success":
        return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <Bell size={18} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
                Notifications
              </h1>
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                {visibleNotifications.length} notification{visibleNotifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-100 dark:bg-zinc-800 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-50 dark:bg-zinc-800/50 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && visibleNotifications.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-slate-300 dark:text-zinc-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-700 dark:text-zinc-200 mb-1">
              All caught up!
            </h2>
            <p className="text-sm text-slate-400 dark:text-zinc-500 max-w-sm mx-auto">
              No pending alerts or notifications at this time. Your productivity is on track.
            </p>
          </div>
        )}

        {/* Notifications list */}
        {!loading && visibleNotifications.length > 0 && (
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative rounded-2xl border ${getBgClass(notification.type)} p-4 transition-all hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                      {notification.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {notification.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {notification.link && (
                        <Link
                          href={notification.link}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        >
                          {notification.linkText || "View Details"}
                          <ExternalLink size={10} />
                        </Link>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {formatRelativeTime(notification.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Dismiss button (only if dismissible) */}
                  {notification.dismissible && (
                    <button
                      onClick={() => handleDismiss(notification.id)}
                      className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dismissed notifications footer */}
        {dismissedIds.size > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setDismissedIds(new Set())}
              className="text-xs text-slate-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 transition-colors"
            >
              Reset dismissed notifications
            </button>
          </div>
        )}

        {/* Productivity tip */}
        {!loading && visibleNotifications.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/30 dark:to-sky-950/30 border border-indigo-100 dark:border-indigo-800/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <TrendingUp size={11} className="text-indigo-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                Productivity Tip
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1.5 leading-relaxed">
              Address high-priority notifications first. Resolving stalled transactions and escalations
              will help improve your team's completion rate and reduce turnaround time.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}