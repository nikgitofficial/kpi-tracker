"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Search, HelpCircle, ChevronRight, LogOut, User, Settings,
  X, Users, Tag, Building2, Hash, Activity, SlidersHorizontal,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Loader2,
  Monitor, Moon, Sun,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { HelpModal } from "@/components/ui/HelpModal";
import { useTheme } from "@/providers/ThemeProvider";

/* ─── Types ─── */
interface SearchResult {
  type: "agent" | "company" | "doctype" | "transaction";
  id: string;
  label: string;
  sub?: string;
  badge?: string;
  badgeColor?: string;
  meta?: string;
  href?: string;
}

interface FilterState {
  status: "" | "COMPLETION" | "PENDING" | "ESCALATION";
  docType: string;
  agentName: string;
  minVolume: string;
  maxVolume: string;
}

/* ─── Page meta ─── */
const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/dashboard":            { title: "Dashboard",  crumb: "Overview" },
  "/dashboard/activity":   { title: "Activity",   crumb: "Overview" },
  "/dashboard/profile":    { title: "Profile",    crumb: "Account"  },
  "/dashboard/security":   { title: "Security",   crumb: "Security" },
  "/dashboard/api-keys":   { title: "API Keys",   crumb: "Security" },
  "/dashboard/settings":   { title: "Settings",   crumb: "Settings" },
  "/dashboard/tx-log":     { title: "TX Log",     crumb: "KPI"      },
  "/dashboard/eod-report": { title: "EOD Report", crumb: "KPI"      },
  "/dashboard/analytics":  { title: "Analytics",  crumb: "KPI"      },
};

const STATUS_CONFIG = {
  COMPLETION: { label: "Completion", color: "text-green-600",  bg: "bg-green-50 border-green-200",   icon: CheckCircle2  },
  PENDING:    { label: "Pending",    color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   icon: Clock         },
  ESCALATION: { label: "Escalation", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: AlertTriangle },
};

const TYPE_ICON = {
  agent:       { icon: Users,     label: "Agent",     color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/50"  },
  company:     { icon: Building2, label: "Company",   color: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-950/50"        },
  doctype:     { icon: Tag,       label: "Task Type", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/50"  },
  transaction: { icon: Activity,  label: "TX",        color: "text-slate-500 dark:text-zinc-400",  bg: "bg-slate-50 dark:bg-zinc-800" },
};

/* ─── Topbar ─── */
export function Topbar({
  user,
  notificationCount = 3,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  notificationCount?: number;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const meta     = PAGE_META[pathname] ?? { title: "Dashboard", crumb: "Overview" };
  const { theme, setTheme } = useTheme();

  /* Help modal */
  const [helpOpen, setHelpOpen] = useState(false);

  /* Dropdown */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* Search / filter overlay */
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [query,       setQuery]       = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    status: "", docType: "", agentName: "", minVolume: "", maxVolume: "",
  });
  const [knownAgents,   setKnownAgents]   = useState<string[]>([]);
  const [knownDocTypes, setKnownDocTypes] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef     = useRef<HTMLDivElement>(null);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setQuery("");
    setResults([]);
    setActiveIdx(0);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setShowFilters(false);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openSearch(); }
      if (e.key === "Escape" && searchOpen) closeSearch();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [searchOpen, openSearch, closeSearch]);

  useEffect(() => {
    if (!searchOpen) return;
    const h = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) closeSearch();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    if (!searchOpen) return;
    Promise.all([
      fetch("/api/kpi/agents").then(r => r.json()).catch(() => ({ agents: [] })),
      fetch("/api/kpi/doc-types").then(r => r.json()).catch(() => ({ docTypes: [] })),
    ]).then(([aData, dData]) => {
      setKnownAgents((aData.agents ?? []).map((a: { name: string }) => a.name));
      setKnownDocTypes((dData.docTypes ?? []).map((d: { name: string }) => d.name));
    });
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    const hasFilters = filters.status || filters.docType || filters.agentName || filters.minVolume || filters.maxVolume;
    if (!q && !hasFilters) { setResults([]); return; }

    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (filters.status)    params.set("status",    filters.status);
        if (filters.docType)   params.set("docType",   filters.docType);
        if (filters.agentName) params.set("agentName", filters.agentName);
        if (filters.minVolume) params.set("minVolume", filters.minVolume);
        if (filters.maxVolume) params.set("maxVolume", filters.maxVolume);

        const res  = await fetch(`/api/kpi/search?${params}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setActiveIdx(0);
      } catch { /* aborted */ }
      finally { setLoading(false); }
    })();

    return () => controller.abort();
  }, [query, filters, searchOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) {
      const r = results[activeIdx];
      if (r.href) { router.push(r.href); closeSearch(); }
    }
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const groupedResults: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!groupedResults[r.type]) groupedResults[r.type] = [];
    groupedResults[r.type].push(r);
  }
  const groupOrder: Array<SearchResult["type"]> = ["agent", "company", "doctype", "transaction"];

  // Cycle theme: light -> dark -> system -> light
  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 h-14 flex items-center border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 gap-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span className="text-slate-400 dark:text-zinc-500 hidden sm:block">{meta.crumb}</span>
          <ChevronRight size={13} className="text-slate-300 dark:text-zinc-600 hidden sm:block flex-shrink-0" />
          <span className="text-slate-900 dark:text-zinc-100 font-semibold truncate">{meta.title}</span>
        </div>

        {/* Search trigger */}
        <div className="relative hidden md:flex items-center">
          <button
            onClick={openSearch}
            className="w-48 lg:w-64 h-8 flex items-center gap-2 pl-3 pr-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all duration-200 text-sm"
          >
            <Search size={13} className="flex-shrink-0" />
            <span className="flex-1 text-left text-sm truncate">Search…</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Search size={15} />
          </button>

          {/* Theme toggle button */}
          <button
            onClick={cycleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            title="Change theme"
          >
            {theme === "light" && <Sun size={15} />}
            {theme === "dark" && <Moon size={15} />}
            {theme === "system" && <Monitor size={15} />}
          </button>

          <button
            onClick={() => setHelpOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            title="Help & shortcuts"
          >
            <HelpCircle size={15} />
          </button>

          <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <Bell size={15} />
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 border border-white dark:border-zinc-900" />
            )}
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 mx-1.5" />

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className={`flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl border transition-all duration-200 ${
                dropdownOpen
                  ? "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                  : "border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700"
              }`}
            >
              <UserAvatar image={user?.image} name={user?.name} size="sm" />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-slate-700 dark:text-zinc-200 leading-tight truncate max-w-[100px]">{user?.name ?? "User"}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight truncate max-w-[100px]">{user?.email ?? ""}</p>
              </div>
              <ChevronRight
                size={12}
                className="text-slate-400 dark:text-zinc-500 hidden lg:block transition-transform duration-200"
                style={{ transform: dropdownOpen ? "rotate(-90deg)" : "rotate(90deg)" }}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-lg shadow-slate-200/60 dark:shadow-black/40 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
                  <UserAvatar image={user?.image} name={user?.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{user?.name ?? "User"}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">{user?.email ?? ""}</p>
                  </div>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <User size={14} className="text-slate-400 dark:text-zinc-500" />Profile
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Settings size={14} className="text-slate-400 dark:text-zinc-500" />Settings
                  </Link>
                </div>
                <div className="p-1.5 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut size={14} />Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Help Modal ── */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ── Search Overlay ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            ref={overlayRef}
            className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-slate-900/20 dark:shadow-black/60 border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col"
            style={{ maxHeight: "72vh" }}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800">
              {loading
                ? <Loader2 size={16} className="text-indigo-400 animate-spin flex-shrink-0" />
                : <Search size={16} className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
              }
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search agents, companies, transactions, task types…"
                className="flex-1 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 bg-transparent outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    hasActiveFilters || showFilters
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                      : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <SlidersHorizontal size={11} />
                  Filters
                  {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </button>
                <button
                  onClick={closeSearch}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/60">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">Status</label>
                    <div className="flex flex-wrap gap-1">
                      {(["", "COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                        const cfg = s ? STATUS_CONFIG[s] : null;
                        return (
                          <button
                            key={s || "all"}
                            onClick={() => setFilters(f => ({ ...f, status: s }))}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                              filters.status === s
                                ? cfg ? `${cfg.color} ${cfg.bg}` : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200"
                                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300"
                            }`}
                          >
                            {s ? STATUS_CONFIG[s].label : "All"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">Agent</label>
                    <select
                      value={filters.agentName}
                      onChange={e => setFilters(f => ({ ...f, agentName: e.target.value }))}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                      <option value="">All agents</option>
                      {knownAgents.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">Task Type</label>
                    <select
                      value={filters.docType}
                      onChange={e => setFilters(f => ({ ...f, docType: e.target.value }))}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                      <option value="">All types</option>
                      {knownDocTypes.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">Volume Range</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Hash size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="number" min="0" placeholder="Min" value={filters.minVolume}
                          onChange={e => setFilters(f => ({ ...f, minVolume: e.target.value }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>
                      <span className="text-slate-300 dark:text-zinc-600 text-xs">—</span>
                      <div className="relative flex-1">
                        <Hash size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="number" min="0" placeholder="Max" value={filters.maxVolume}
                          onChange={e => setFilters(f => ({ ...f, maxVolume: e.target.value }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>
                      {hasActiveFilters && (
                        <button
                          onClick={() => setFilters({ status: "", docType: "", agentName: "", minVolume: "", maxVolume: "" })}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {!query.trim() && !hasActiveFilters && (
                <div className="px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3">Quick Filters</p>
                  <div className="flex flex-wrap gap-2">
                    {(["COMPLETION", "PENDING", "ESCALATION"] as const).map(s => {
                      const cfg = STATUS_CONFIG[s];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={s}
                          onClick={() => { setFilters(f => ({ ...f, status: s })); setShowFilters(true); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${cfg.color} ${cfg.bg} hover:opacity-80`}
                        >
                          <Icon size={11} />{cfg.label}
                        </button>
                      );
                    })}
                    {knownDocTypes.slice(0, 4).map(dt => (
                      <button
                        key={dt}
                        onClick={() => { setFilters(f => ({ ...f, docType: dt })); setShowFilters(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 text-xs font-semibold hover:opacity-80 transition-all"
                      >
                        <Tag size={10} />{dt}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4 text-center">Type to search, or use filters above</p>
                </div>
              )}

              {(query.trim() || hasActiveFilters) && results.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Search size={28} className="text-slate-200 dark:text-zinc-700 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-zinc-400">No results found</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Try different keywords or adjust filters</p>
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {(() => {
                    let globalIdx = 0;
                    return groupOrder.map(type => {
                      const group = groupedResults[type];
                      if (!group?.length) return null;
                      const typeCfg = TYPE_ICON[type];
                      const TypeIcon = typeCfg.icon;
                      return (
                        <div key={type}>
                          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                            <TypeIcon size={11} className={typeCfg.color} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                              {typeCfg.label}{group.length > 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] text-slate-300 dark:text-zinc-600">{group.length}</span>
                          </div>
                          {group.map(result => {
                            const isActive = globalIdx === activeIdx;
                            const idx      = globalIdx++;
                            const StatusIcon = result.badgeColor && result.badge
                              ? (STATUS_CONFIG[result.badge as keyof typeof STATUS_CONFIG]?.icon ?? null)
                              : null;
                            return (
                              <button
                                key={result.id}
                                onClick={() => { if (result.href) { router.push(result.href); closeSearch(); } }}
                                onMouseEnter={() => setActiveIdx(idx)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? "bg-indigo-50 dark:bg-indigo-950/50"
                                    : "hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.bg}`}>
                                  <TypeIcon size={13} className={typeCfg.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-medium truncate ${isActive ? "text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-200"}`}>
                                      {result.label}
                                    </p>
                                    {result.badge && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold flex-shrink-0 ${
                                        result.badge in STATUS_CONFIG
                                          ? `${STATUS_CONFIG[result.badge as keyof typeof STATUS_CONFIG].color} ${STATUS_CONFIG[result.badge as keyof typeof STATUS_CONFIG].bg}`
                                          : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400"
                                      }`}>
                                        {StatusIcon && <StatusIcon size={9} />}
                                        {result.badge in STATUS_CONFIG ? STATUS_CONFIG[result.badge as keyof typeof STATUS_CONFIG].label : result.badge}
                                      </span>
                                    )}
                                  </div>
                                  {result.sub && <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">{result.sub}</p>}
                                </div>
                                {result.meta && <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono flex-shrink-0">{result.meta}</span>}
                                {isActive && <ArrowRight size={13} className="text-indigo-400 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Footer keyboard hints */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
              <div className="flex items-center gap-3">
                {[["↑↓", "Navigate"], ["↵", "Open"], ["Esc", "Close"]].map(([key, label]) => (
                  <span key={label} className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                    <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[10px]">{key}</kbd>
                    {label}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-slate-300 dark:text-zinc-600">
                {results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}