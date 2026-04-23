"use client";

import { useEffect, useRef } from "react";
import {
  X, Keyboard, Search, FileText, BarChart2, ClipboardList,
  Play, Square, Pause, Download, HelpCircle,
  ExternalLink, Zap, Timer, Users, Tag, PauseCircle,
  ListPlus, Pencil, Trash2, TrendingUp, LayoutDashboard,
  Activity, Bell, Shield, Key, Settings,
} from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["⌘", "K"],   label: "Open global search" },
  { keys: ["↑", "↓"],   label: "Navigate results" },
  { keys: ["↵"],         label: "Open selected result" },
  { keys: ["Esc"],       label: "Close overlay / modal" },
  // TX Log table row shortcuts (hover-activated)
  { keys: ["1"],         label: "TX row: add subtask (hover row first)" },
  { keys: ["2"],         label: "TX row: edit transaction (hover row first)" },
  { keys: ["3"],         label: "TX row: delete transaction (hover row first)" },
  // Subtask row shortcuts
  { keys: ["1"],         label: "Subtask row: edit subtask (hover subtask first)" },
  { keys: ["2"],         label: "Subtask row: delete subtask (hover subtask first)" },
];

const FEATURES = [
  {
    icon: LayoutDashboard,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "Dashboard",
    desc: "Overview of team KPIs, live stats, and daily summaries at a glance.",
  },
  {
    icon: Activity,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    title: "Activity",
    desc: "Monitor real-time agent activity status and live session data.",
  },
  {
    icon: ClipboardList,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "TX Log",
    desc: "Log transactions per agent with subtasks, statuses, hold/resume flow, bio breaks, and productivity timer.",
  },
  {
    icon: TrendingUp,
    color: "text-violet-500",
    bg: "bg-violet-50",
    title: "Productivity",
    desc: "Agent productivity metrics, timer breakdowns, and shift efficiency reports.",
  },
  {
    icon: FileText,
    color: "text-rose-500",
    bg: "bg-rose-50",
    title: "EOD Report",
    desc: "Daily production summary grouped by team. Export to PDF or Excel.",
  },
  {
    icon: BarChart2,
    color: "text-violet-500",
    bg: "bg-violet-50",
    title: "Analytics",
    desc: "Range-based performance stats, streak alerts, and agent rankings.",
  },
  {
    icon: Search,
    color: "text-sky-500",
    bg: "bg-sky-50",
    title: "Global Search",
    desc: "Search agents, companies, task types, and transactions with filters.",
  },
  {
    icon: Bell,
    color: "text-amber-500",
    bg: "bg-amber-50",
    title: "Notifications",
    desc: "System alerts, escalation flags, and important updates.",
  },
];

const TX_LOG_FEATURES = [
  {
    icon: Timer,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    title: "Productivity Timer",
    desc: "Start, pause, resume, or end your shift timer. Bio break time is automatically deducted on End. Requires password to manually edit.",
  },
  {
    icon: PauseCircle,
    color: "text-sky-500",
    bg: "bg-sky-50",
    title: "Bio Break Tracker",
    desc: "Track every bathroom break with timestamps. Completed breaks are listed with start → end times and durations.",
  },
  {
    icon: ListPlus,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "Subtasks",
    desc: "Expand any TX row to add subtasks with their own doc type, volume, status, and notes. Subtask counts roll up into the summary table.",
  },
  {
    icon: Tag,
    color: "text-violet-500",
    bg: "bg-violet-50",
    title: "Task Types",
    desc: "Each task type is tagged Production or Non-Production and counted as TX (per transaction) or Vol (total volume/employees).",
  },
];

const TX_STATUSES = [
  { label: "Completion", color: "text-green-600",  bg: "bg-green-50  border-green-200",  desc: "Transaction fully done." },
  { label: "Pending",    color: "text-amber-600",  bg: "bg-amber-50  border-amber-200",  desc: "In progress, not yet complete." },
  { label: "Escalation", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", desc: "Requires supervisor attention." },
  { label: "Hold",       color: "text-sky-600",    bg: "bg-sky-50    border-sky-200",    desc: "Paused — resume later from the table." },
];

const TIPS = [
  { icon: Users,     text: "Always select your name from the agent dropdown before starting any logs for the day." },
  { icon: Play,      text: "Start the Productivity Timer at the beginning of your shift and End it after — bio break time is deducted automatically." },
  { icon: Pause,     text: "Use Hold on a transaction to pause it and start another. Resume it anytime from the table row." },
  { icon: ListPlus,  text: "Hover any TX row and press 1 to instantly open the subtask form without touching the mouse." },
  { icon: Pencil,    text: "Hover a TX row and press 2 to edit it, or press 3 to delete. Same shortcut scheme applies to subtask rows (1 = edit, 2 = delete)." },
  { icon: Download,  text: "Export any report to PDF or Excel using the buttons in the top-right of the TX Log header." },
  { icon: Zap,       text: "The task type summary table at the top of the log splits Production vs Non-Production counts automatically, including subtasks." },
  { icon: Timer,     text: "If you forget to stop the timer, the beacon system auto-saves your progress when you close or switch tabs." },
];

const ROW_SHORTCUTS = [
  { key: "1", label: "Add Subtask", color: "bg-indigo-500",  scope: "TX row"      },
  { key: "2", label: "Edit TX",     color: "bg-slate-500",   scope: "TX row"      },
  { key: "3", label: "Delete TX",   color: "bg-red-500",     scope: "TX row"      },
  { key: "1", label: "Edit",        color: "bg-slate-500",   scope: "Subtask row" },
  { key: "2", label: "Delete",      color: "bg-red-500",     scope: "Subtask row" },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[6vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={overlayRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 overflow-hidden flex flex-col"
        style={{ maxHeight: "86vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <HelpCircle size={15} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Help & Reference</h2>
              <p className="text-[11px] text-slate-400">KPI-HERBJOY · TX Log & full system guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Pages ── */}
          <div className="px-5 pt-5 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Pages</p>
            <div className="grid grid-cols-2 gap-2">
              {FEATURES.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${f.bg}`}>
                      <Icon size={13} className={f.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{f.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── TX Log deep-dive ── */}
          <div className="px-5 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">TX Log — Key Features</p>
            <div className="grid grid-cols-2 gap-2">
              {TX_LOG_FEATURES.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${f.bg}`}>
                      <Icon size={13} className={f.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{f.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── TX Statuses ── */}
          <div className="px-5 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Transaction Statuses</p>
            <div className="grid grid-cols-2 gap-2">
              {TX_STATUSES.map(s => (
                <div key={s.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.bg}`}>
                  <span className={`text-xs font-bold ${s.color} whitespace-nowrap`}>{s.label}</span>
                  <span className="text-[11px] text-slate-500 leading-tight">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Hover keyboard shortcuts ── */}
          <div className="px-5 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Keyboard size={11} /> Hover Shortcuts (TX Log Table)
            </p>
            <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
              Hover over any transaction or subtask row — numbered badges appear on the action buttons. Press the corresponding key while hovering to trigger the action instantly.
            </p>
            <div className="space-y-1.5">
              {ROW_SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded ${s.color} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>{s.key}</span>
                    <span className="text-xs text-slate-600">{s.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.scope}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tips ── */}
          <div className="px-5 pb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tips & Best Practices</p>
            <div className="space-y-2">
              {TIPS.map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={10} className="text-indigo-500" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{tip.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Global keyboard shortcuts ── */}
          <div className="px-5 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Keyboard size={11} /> Global Keyboard Shortcuts
            </p>
            <div className="space-y-1.5">
              {[
                { keys: ["⌘", "K"], label: "Open global search" },
                { keys: ["↑", "↓"], label: "Navigate search results" },
                { keys: ["↵"],      label: "Open selected result" },
                { keys: ["Esc"],    label: "Close any overlay or modal" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 shadow-sm">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-[11px] text-slate-400">KPI-HERBJOY · Internal Tool</p>
          <a
            href="mailto:nickforjobacc@gmail.com"
            className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
          >
            Contact support <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}