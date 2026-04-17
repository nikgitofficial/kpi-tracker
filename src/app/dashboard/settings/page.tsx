"use client";

import { useState } from "react";
import {
  Settings, User, Palette, Bell, Trash2,
  CheckCircle2, AlertTriangle, Monitor, Moon, Sun,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

const TIMEZONES = [
  "Asia/Manila", "Asia/Singapore", "Asia/Tokyo",
  "America/New_York", "America/Los_Angeles", "Europe/London", "UTC",
];
const LANGUAGES = ["English", "Filipino", "Spanish", "Japanese"];

type Theme = "system" | "light" | "dark";
type SidebarBehavior = "expanded" | "collapsed" | "auto";

export default function SettingsPage() {
  /* ── Theme ── */
  const { theme, setTheme } = useTheme();

  /* ── General ── */
  const [displayName, setDisplayName]   = useState("Herb Joy");
  const [timezone, setTimezone]         = useState("Asia/Manila");
  const [language, setLanguage]         = useState("English");
  const [generalSaved, setGeneralSaved] = useState(false);

  /* ── Appearance ── */
  const [sidebarBehavior, setSidebarBehavior] = useState<SidebarBehavior>("expanded");
  const [compactMode, setCompactMode]         = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  /* ── Notifications ── */
  const [notifEmail,      setNotifEmail]      = useState(true);
  const [notifBrowser,    setNotifBrowser]    = useState(false);
  const [notifEscalation, setNotifEscalation] = useState(true);
  const [notifDigest,     setNotifDigest]     = useState(false);
  const [notifSaved,      setNotifSaved]      = useState(false);

  /* ── Danger ── */
  const [deleteInput,       setDeleteInput]       = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const save = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2500);
  };

  const inputCls =
    "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";

  const selectCls =
    "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none";

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
          value ? "bg-indigo-500" : "bg-slate-200 dark:bg-zinc-700"
        }`}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
    );
  }

  function SelectWrapper({ children }: { children: React.ReactNode }) {
    return (
      <div className="relative">
        {children}
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
      </div>
    );
  }

  function SaveBar({ saved, onSave, label = "Save Changes" }: { saved: boolean; onSave: () => void; label?: string }) {
    return (
      <div className="flex items-center justify-between pt-2">
        {saved ? (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 size={13} /> Saved successfully
          </span>
        ) : <span />}
        <button
          type="button"
          onClick={onSave}
          className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
        >
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Account</p>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Settings</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">Manage your preferences and account settings.</p>
        </div>

        {/* ── General ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
              <User size={14} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">General</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">Name, timezone, and language preferences.</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Timezone</label>
                <SelectWrapper>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
                    {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </SelectWrapper>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Language</label>
                <SelectWrapper>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className={selectCls}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </SelectWrapper>
              </div>
            </div>
            <SaveBar saved={generalSaved} onSave={() => save(setGeneralSaved)} />
          </div>
        </div>

        {/* ── Appearance ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center">
              <Palette size={14} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Appearance</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">Theme and layout preferences.</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">

            {/* Theme selector */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "system", label: "System", icon: Monitor },
                  { key: "light",  label: "Light",  icon: Sun     },
                  { key: "dark",   label: "Dark",   icon: Moon    },
                ] as const).map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTheme(t.key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                        theme === t.key
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <Icon size={16} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar behavior */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Sidebar Default</label>
              <SelectWrapper>
                <select
                  value={sidebarBehavior}
                  onChange={e => setSidebarBehavior(e.target.value as SidebarBehavior)}
                  className={selectCls}
                >
                  <option value="expanded">Always expanded</option>
                  <option value="collapsed">Always collapsed</option>
                  <option value="auto">Auto (remember last state)</option>
                </select>
              </SelectWrapper>
            </div>

            {/* Compact mode */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">Compact Mode</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Reduce spacing and padding in tables and lists.</p>
              </div>
              <Toggle value={compactMode} onChange={setCompactMode} />
            </div>

            <SaveBar saved={appearanceSaved} onSave={() => save(setAppearanceSaved)} />
          </div>
        </div>

        {/* ── Notifications ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
              <Bell size={14} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Notifications</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">Choose how and when you get notified.</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-1">
            {[
              { label: "Email Notifications",   sub: "Receive updates and alerts via email.",               value: notifEmail,      set: setNotifEmail      },
              { label: "Browser Notifications", sub: "Show desktop push notifications in your browser.",    value: notifBrowser,    set: setNotifBrowser    },
              { label: "Escalation Alerts",     sub: "Notify immediately when a transaction is escalated.", value: notifEscalation, set: setNotifEscalation },
              { label: "Daily Digest",          sub: "Get a daily summary email of team production.",       value: notifDigest,     set: setNotifDigest     },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-zinc-800 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{n.label}</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{n.sub}</p>
                </div>
                <Toggle value={n.value} onChange={n.set} />
              </div>
            ))}
            <div className="pt-2">
              <SaveBar saved={notifSaved} onSave={() => save(setNotifSaved)} />
            </div>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-red-100 dark:border-red-900/40">
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
              <p className="text-[11px] text-red-400 dark:text-red-500">Irreversible account actions.</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">Delete Account</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(s => !s)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-500 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors flex-shrink-0"
              >
                <Trash2 size={12} /> Delete Account
              </button>
            </div>

            {showDeleteConfirm && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-3">
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                  Type <strong>DELETE</strong> to confirm you want to permanently delete your account.
                </p>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                    className="flex-1 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteInput !== "DELETE"}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}