"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import {
  LayoutDashboard,
  User,
  Shield,
  Bell,
  Settings,
  Activity,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ClipboardList,
  FileText,
  BarChart2,
  TrendingUp,
  Server, 
  UserCog,
  Database, 
  LifeBuoy,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard/homedashboard" },
      { icon: Activity,        label: "Activity",  href: "/dashboard/activity" },
    ],
  },
  {
    label: "KPI",
    items: [
      { icon: ClipboardList, label: "TX Log",       href: "/dashboard/tx-log" },
      { icon: TrendingUp,    label: "Productivity", href: "/dashboard/productivity" },
      { icon: FileText,      label: "EOD Report",   href: "/dashboard/eod-report" },
      { icon: BarChart2,     label: "Analytics",    href: "/dashboard/analytics" },
      { icon: UserCog,       label: "Manage Setup", href: "/dashboard/manage-setup" },
     
    ],
  },
  {
    label: "Account",
    items: [
      { icon: User, label: "Profile",       href: "/dashboard/profile" },
      { icon: Bell, label: "Notifications", href: "/dashboard/notifications", badge: 3 },
      { icon: LifeBuoy, label: "Help Center", href: "/dashboard/help-center" },
    ],
  },
  {
    label: "Security",
    items: [
      { icon: Shield, label: "Security", href: "/dashboard/security" },
      { icon: Server,  label: "System Logs", href: "/dashboard/system-logs" },
      { icon: Database,      label: "Data Export",  href: "/dashboard/data-export" },
    ],
  },
];

/* ─── Top progress bar ─── */
function ProgressBar({ active }: { active: boolean }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px]">
      <div
        className={`h-full bg-indigo-500 transition-all duration-700 ease-in-out ${
          active ? "w-[85%] opacity-100" : "w-0 opacity-0"
        }`}
      />
    </div>
  );
}

/* ─── Full overlay ─── */
function NavigationOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[9998] bg-slate-50/60 dark:bg-zinc-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none">
      <div className="relative flex items-center justify-center">
        <div className="animate-spin rounded-full h-24 w-24 border-4 border-indigo-500 border-t-transparent" />
        <div className="absolute">
          <Image src="/logo.png" alt="Logo" width={64} height={64} className="object-contain" />
        </div>
      </div>
    </div>
  );
}
/* ─── Nav Item ─── */
function NavItem({
  icon: Icon,
  label,
  href,
  badge,
  active,
  pending,
  collapsed,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  active: boolean;
  pending: boolean;
  collapsed: boolean;
  onClick: (href: string) => void;
}) {
  const isPending = pending && !active;

  return (
    <button
      onClick={() => !active && onClick(href)}
      disabled={isPending}
      className={`
        w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-150 outline-none text-left
        ${active
          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-[inset_0_1px_0_rgba(99,102,241,0.1)]"
          : isPending
          ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-wait"
          : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-[0.98]"
        }
      `}
      title={collapsed ? label : undefined}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-indigo-500" />
      )}

      {/* Icon or mini spinner */}
      {isPending ? (
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent" />
        </div>
      ) : (
        <Icon
          size={16}
          className={`flex-shrink-0 transition-colors duration-150 ${
            active
              ? "text-indigo-500 dark:text-indigo-400"
              : "text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300"
          }`}
        />
      )}

      {!collapsed && (
        <>
          <span className={`flex-1 truncate transition-opacity duration-150 ${isPending ? "opacity-50" : ""}`}>
            {label}
          </span>
          {badge !== undefined && !isPending && (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-1.5 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
              {badge}
            </span>
          )}
        </>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-200 shadow-lg opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
          {label}
          {badge !== undefined && (
            <span className="ml-1.5 inline-flex h-4 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-1 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
              {badge}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/* ─── Sidebar ─── */
export function Sidebar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [navigating, setNavigating]   = useState(false);

  /* Clear loading once the new route mounts */
  useEffect(() => {
    setPendingHref(null);
    setNavigating(false);
    setMobileOpen(false);
  }, [pathname]);

  const handleNavClick = useCallback((href: string) => {
    if (href === pathname) return;
    setPendingHref(href);
    setNavigating(true);
    router.push(href);
  }, [pathname, router]);

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 transition-all duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-64"}`}>

      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex-shrink-0 w-7 h-7 relative">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          {!collapsed && (
            <span className="inline-flex flex-col leading-none select-none">
              <span className="flex items-baseline gap-[1px]">
                <span className="font-black text-lg tracking-tight" style={{ color: "#2EA8FF" }}>HERB</span>
                <span className="font-black text-lg tracking-tight" style={{ color: "#FF4D4D" }}>JOY</span>
              </span>
              <span className="font-medium text-[9px] tracking-[0.15em] uppercase" style={{ color: "#F4C542" }}>
                Productivity Tracker
              </span>
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-6 h-6 items-center justify-center rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight size={14} className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mx-3 mb-1.5 h-px bg-slate-200 dark:bg-zinc-800" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname === item.href}
                  pending={pendingHref === item.href}
                  collapsed={collapsed}
                  onClick={handleNavClick}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings shortcut */}
      <div className="px-2 pb-2">
        <NavItem
          icon={Settings}
          label="Settings"
          href="/dashboard/settings"
          active={pathname === "/dashboard/settings"}
          pending={pendingHref === "/dashboard/settings"}
          collapsed={collapsed}
          onClick={handleNavClick}
        />
      </div>

      {/* User footer */}
      <div className="border-t border-slate-200 dark:border-zinc-800 p-3 flex-shrink-0">
        <div className={`flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors group ${collapsed ? "justify-center" : ""}`}>
          <UserAvatar image={user?.image} name={user?.name} size="md" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate leading-tight">{user?.name ?? "Unknown"}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 truncate leading-tight">{user?.email ?? ""}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Global navigation feedback */}
      <ProgressBar active={navigating} />
      <NavigationOverlay active={navigating} />

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors shadow-sm"
        aria-label="Open menu"
      >
        <Menu size={16} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative h-full w-64">
          {sidebarContent}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3.5 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 flex-shrink-0 overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}