"use client";

import { useEffect, useRef } from "react";
import {
  X, Keyboard, Search, FileText, BarChart2, ClipboardList,
  Play, Square, Pause, Download, ChevronRight, HelpCircle,
  ExternalLink, Zap,
} from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["⌘", "K"],   label: "Open search" },
  { keys: ["↑", "↓"],   label: "Navigate results" },
  { keys: ["↵"],         label: "Open selected result" },
  { keys: ["Esc"],       label: "Close overlay / modal" },
];

const FEATURES = [
  {
    icon: ClipboardList,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    title: "TX Log",
    desc: "Start, pause, and end transactions with live TAT timers per agent.",
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
];

const TIPS = [
  { icon: Play,     text: "Start a transaction first, then fill in details when you end it." },
  { icon: Pause,    text: "Pause a TX to log another simultaneously — resume anytime from the table." },
  { icon: Download, text: "Export any report to PDF or Excel using the buttons in the top-right." },
  { icon: Zap,      text: "Use the Tasks breakdown button per agent in EOD to see doc-type splits." },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[8vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={overlayRef}
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <HelpCircle size={15} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Help & Reference</h2>
              <p className="text-[11px] text-slate-400">KPI-HERBJOY quick guide</p>
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
          {/* Features */}
          <div className="px-5 pt-4 pb-3">
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

          {/* Tips */}
          <div className="px-5 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tips</p>
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

          {/* Keyboard shortcuts */}
          <div className="px-5 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Keyboard size={11} /> Keyboard Shortcuts
            </p>
            <div className="space-y-1.5">
              {SHORTCUTS.map((s, i) => (
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