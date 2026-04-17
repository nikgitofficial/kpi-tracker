"use client";

import { useState } from "react";
import {
  Shield, Smartphone, Monitor, Globe, LogOut,
  CheckCircle2, AlertTriangle, Lock, Eye, EyeOff,
  ChevronRight, Clock,
} from "lucide-react";

const SESSIONS = [
  {
    id: "1", device: "Chrome on macOS", location: "Manila, Philippines",
    ip: "103.22.45.12", lastActive: "Just now", current: true, icon: Monitor,
  },
  {
    id: "2", device: "Safari on iPhone", location: "Manila, Philippines",
    ip: "103.22.45.13", lastActive: "2 hours ago", current: false, icon: Smartphone,
  },
  {
    id: "3", device: "Firefox on Windows", location: "Quezon City, Philippines",
    ip: "112.198.77.21", lastActive: "Yesterday", current: false, icon: Globe,
  },
];

export default function SecurityPage() {
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [sessions, setSessions] = useState(SESSIONS);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handlePwSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw || newPw !== confirmPw) return;
    setPwSaved(true);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setTimeout(() => setPwSaved(false), 3000);
  };

  const revokeSession = (id: string) => {
    setRevokingId(id);
    setTimeout(() => {
      setSessions(prev => prev.filter(s => s.id !== id));
      setRevokingId(null);
    }, 800);
  };

  const inputCls = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all pr-10";

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Account</p>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Security</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">Manage your password, 2FA, and active sessions.</p>
        </div>

        {/* ── Password ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
              <Lock size={14} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Change Password</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">Use a strong, unique password.</p>
            </div>
          </div>
          <form onSubmit={handlePwSave} className="px-5 py-4 space-y-3">
            {[
              { label: "Current Password", value: currentPw, set: setCurrentPw, show: showCurrent, toggle: setShowCurrent },
              { label: "New Password",     value: newPw,     set: setNewPw,     show: showNew,     toggle: setShowNew     },
              { label: "Confirm Password", value: confirmPw, set: setConfirmPw, show: showConfirm, toggle: setShowConfirm },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">{f.label}</label>
                <div className="relative">
                  <input
                    type={f.show ? "text" : "password"}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => f.toggle(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
                    {f.show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}

            {newPw && confirmPw && newPw !== confirmPw && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle size={11} /> Passwords do not match
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              {pwSaved && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 size={13} /> Password updated
                </span>
              )}
              <button
                type="submit"
                disabled={!currentPw || !newPw || newPw !== confirmPw}
                className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* ── 2FA ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center">
              <Smartphone size={14} className="text-violet-500 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Two-Factor Authentication</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">Add an extra layer of security with an authenticator app.</p>
            </div>
            {/* Toggle */}
            <button
              onClick={() => { setTwoFaEnabled(e => !e); setShowQr(false); }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${twoFaEnabled ? "bg-indigo-500" : "bg-slate-200 dark:bg-zinc-700"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${twoFaEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} style={{ transform: twoFaEnabled ? "translateX(18px)" : "translateX(2px)" }} />
            </button>
          </div>

          <div className="px-5 py-4">
            {!twoFaEnabled ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">2FA is disabled</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Enable two-factor authentication to better protect your account.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">2FA is enabled</p>
                    <p className="text-[11px] text-green-600 dark:text-green-500 mt-0.5">Your account is protected with an authenticator app.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQr(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
                >
                  {showQr ? "Hide" : "Show"} setup QR code <ChevronRight size={12} className={`transition-transform ${showQr ? "rotate-90" : ""}`} />
                </button>
                {showQr && (
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    {/* Fake QR code pattern */}
                    <div className="w-28 h-28 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg grid grid-cols-7 gap-px p-1.5">
                      {Array.from({ length: 49 }).map((_, i) => (
                        <div key={i} className={`rounded-sm ${[0,1,2,3,4,5,7,12,14,19,21,22,23,24,25,26,28,33,35,40,42,43,44,45,46,47,48].includes(i) ? "bg-slate-800 dark:bg-zinc-200" : "bg-white dark:bg-zinc-900"}`} />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-center">Scan with Google Authenticator or Authy</p>
                    <code className="text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono tracking-wider">JBSWY3DPEHPK3PXP</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Active Sessions ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
              <Globe size={14} className="text-slate-500 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Active Sessions</h2>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">{sessions.length} device{sessions.length !== 1 ? "s" : ""} signed in</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {sessions.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-slate-500 dark:text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">{s.device}</p>
                      {s.current && (
                        <span className="px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-[9px] font-bold">CURRENT</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{s.location} · {s.ip}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={9} className="text-slate-300 dark:text-zinc-600" />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">{s.lastActive}</span>
                    </div>
                  </div>
                  {!s.current && (
                    <button
                      onClick={() => revokeSession(s.id)}
                      disabled={revokingId === s.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      <LogOut size={10} />
                      {revokingId === s.id ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {sessions.filter(s => !s.current).length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/30">
              <button
                onClick={() => setSessions(prev => prev.filter(s => s.current))}
                className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors"
              >
                Revoke all other sessions
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}