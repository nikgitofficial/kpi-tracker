"use client";

import { useEffect, useState } from "react";
import { Trophy, RefreshCw } from "lucide-react";

/* ─── Types ─── */
export interface AgentStatus {
  agent: {
    _id: string;
    name: string;
    group?: string;
  };
  transactions: {
    _id: string;
    status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
    docType: string;
    subtasks?: { _id: string; docType: string; status: string }[];
  }[];
  productiveSeconds: number;
  timerPaused: boolean;
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

function useTick(ms = 1000) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

/* ─── Props ─── */
export interface AgentLeaderboardProps {
  /** Pre-fetched agent statuses. Pass these if the parent already has the data. */
  statuses?: AgentStatus[];
  /**
   * If `statuses` is not provided, the component will self-fetch using this date (YYYY-MM-DD).
   * Defaults to today.
   */
  date?: string;
  /** Optional CSS class applied to the root element. */
  className?: string;
  /** Show the sticky "Live" indicator and auto-refresh every N seconds (default: 10). Set to 0 to disable. */
  refreshIntervalSeconds?: number;
}

/* ═══════════════════════════════════
   AgentLeaderboard
   ─ Can be used in two ways:
     1. Pass `statuses` directly (controlled/parent-managed data).
     2. Omit `statuses` and the component fetches its own data.
═══════════════════════════════════ */
export function AgentLeaderboard({
  statuses: externalStatuses,
  date,
  className = "",
  refreshIntervalSeconds = 10,
}: AgentLeaderboardProps) {
  // Live tick for productive-seconds display
  useTick(1000);

  // Internal state — only used when `statuses` prop is NOT provided
  const [internalStatuses, setInternalStatuses] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(!externalStatuses);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const today = () => new Date().toISOString().split("T")[0];
  const targetDate = date ?? today();

  // Self-fetch logic
  const fetchStatuses = async () => {
    if (externalStatuses) return; // controlled mode — skip
    setLoading(true);
    try {
      const [agentRes] = await Promise.all([
        fetch("/api/kpi/agents").then((r) => r.json()),
      ]);
      const agents: AgentStatus["agent"][] = agentRes.agents ?? [];

      const results = await Promise.all(
        agents.map(async (agent) => {
          const [txRes, timerRes, sessionRes] = await Promise.all([
            fetch(`/api/kpi/transactions?date=${targetDate}&agentId=${agent._id}`).then((r) => r.json()),
            fetch(`/api/kpi/productivity-timer?agentId=${agent._id}&date=${targetDate}`).then((r) => r.json()),
            fetch(`/api/kpi/session?agentId=${agent._id}&date=${targetDate}`).then((r) => r.json()),
          ]);

          const timerRecord = timerRes.record ?? null;
          const session = sessionRes.session ?? null;
          const transactions = txRes.transactions ?? [];

          const isOnBreak = !!(session?.breaks?.find((b: { endEpoch?: number }) => !b.endEpoch));
          const timerExists = !!timerRecord;
          const timerPaused = timerRecord?.timerPaused ?? false;
          const timerIsRunning = !!(timerRecord?.timerStartEpoch && !timerPaused);
          const isActive = timerIsRunning;

          let productiveSeconds = timerRecord?.productiveSeconds ?? 0;
          if (timerRecord?.timerStartEpoch && !timerPaused) {
            productiveSeconds += Math.floor((Date.now() - timerRecord.timerStartEpoch) / 1000);
          }

          return {
            agent,
            transactions,
            productiveSeconds,
            timerPaused,
            timerExists,
            isOnBreak,
            isActive,
          } as AgentStatus;
        })
      );

      setInternalStatuses(results);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("AgentLeaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + polling (only in self-fetch mode)
  useEffect(() => {
    if (externalStatuses) return;
    fetchStatuses();
    if (refreshIntervalSeconds > 0) {
      const id = setInterval(fetchStatuses, refreshIntervalSeconds * 1000);
      return () => clearInterval(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalStatuses, targetDate, refreshIntervalSeconds]);

  const statuses = externalStatuses ?? internalStatuses;
  const MEDALS = ["🥇", "🥈", "🥉"];

  const scored = [...statuses]
  .map((s) => {
    const realTx = s.transactions.filter(t => t.docType !== "__PROD_TIMER__");
    const subtaskItems = realTx.flatMap(t =>
      (t.subtasks ?? []).map(st => ({ ...st, parentStatus: t.status }))
    );

    const done = realTx.filter(t => t.status === "COMPLETION").length
                 + subtaskItems.filter(st => st.parentStatus === "COMPLETION").length;
    const totalTx = realTx.length + subtaskItems.length;
    const esc = realTx.filter(t => t.status === "ESCALATION").length
                + subtaskItems.filter(st => st.parentStatus === "ESCALATION").length;
    const pts = (done * 10) + (totalTx * 2) - (esc * 3);

    return { ...s, txDone: done, totalTx, pts };
  })
  .sort((a, b) => b.pts - a.pts);

  const maxPts = scored[0]?.pts || 1;

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden ${className}`}>
      {/* Top accent bar */}
      <div className="h-1 w-full bg-amber-400" />

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
          <Trophy size={14} className="text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Leaderboard</p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Today's rankings"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={11} className="text-slate-400 dark:text-zinc-500 animate-spin" />}
          {!externalStatuses && !loading && (
            <button
              onClick={fetchStatuses}
              className="text-[10px] text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={11} />
            </button>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Rows */}
      {loading && statuses.length === 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-5 h-4 rounded bg-slate-100 dark:bg-zinc-800" />
              <div className="w-4 h-4 rounded bg-slate-100 dark:bg-zinc-800" />
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-slate-100 dark:bg-zinc-800" />
                <div className="h-2 w-32 rounded bg-slate-100 dark:bg-zinc-800" />
                <div className="h-1 w-full rounded bg-slate-100 dark:bg-zinc-800" />
              </div>
              <div className="w-10 h-5 rounded bg-slate-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : scored.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Trophy size={24} className="text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-slate-400 dark:text-zinc-500">No agents yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {scored.map((s, i) => {
            const av = avatarColor(s.agent.name);
            const pct = Math.round((s.pts / maxPts) * 100);
            const isTop = i < 3;
            const barColor =
              i === 0 ? "bg-amber-400" :
              i === 1 ? "bg-slate-400 dark:bg-zinc-500" :
              i === 2 ? "bg-orange-400" :
                        "bg-slate-200 dark:bg-zinc-700";
            const rowBg =
              i === 0 ? "bg-amber-50/60 dark:bg-amber-950/20" :
              i === 1 ? "bg-slate-50/60 dark:bg-zinc-800/20" :
              i === 2 ? "bg-orange-50/60 dark:bg-orange-950/20" : "";
            const scoreColor =
              i === 0 ? "text-amber-600 dark:text-amber-400" :
              i === 1 ? "text-slate-500 dark:text-zinc-400" :
              i === 2 ? "text-orange-600 dark:text-orange-400" :
                        "text-slate-400 dark:text-zinc-500";

            return (
              <div key={s.agent._id} className={`px-4 py-3 flex items-center gap-3 ${rowBg}`}>
                {/* Medal */}
                <span className="text-base w-5 text-center leading-none">
                  {isTop ? MEDALS[i] : ""}
                </span>
                {/* Rank */}
                <span className={`text-xs font-semibold w-4 text-center ${scoreColor}`}>
                  {i + 1}
                </span>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
                  {s.agent.name.slice(0, 2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">
                      {s.agent.name}
                    </p>
                    {s.isOnBreak ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-semibold">
                        break
                      </span>
                    ) : s.timerPaused && s.timerExists ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 font-semibold">
                        paused
                      </span>
                    ) : s.isActive ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-semibold">
                        working
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
  {s.txDone} done · {s.totalTx} total · {formatHms(s.productiveSeconds)}
</p>
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-zinc-800 mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold font-mono ${scoreColor}`}>
                    {s.pts.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800">
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center">
          pts = (done × 10) + (tx × 2) − (escalations × 3)
        </p>
      </div>
    </div>
  );
}

export default AgentLeaderboard;