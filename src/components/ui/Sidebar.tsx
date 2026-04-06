"use client";

import { useState,useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import {
  LayoutDashboard,
  User,
  Shield,
  Bell,
  Settings,
  Activity,
  Key,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ClipboardList,
  FileText,
  BarChart2,
  TrendingUp,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Activity,        label: "Activity",  href: "/dashboard/activity" },
    ],
  },
  {
    label: "KPI",
    items: [
      { icon: ClipboardList, label: "TX Log",      href: "/dashboard/tx-log" },
      { icon: TrendingUp,    label: "Productivity", href: "/dashboard/productivity" },
      { icon: FileText,      label: "EOD Report",  href: "/dashboard/eod-report" },
      { icon: BarChart2,     label: "Analytics",   href: "/dashboard/analytics" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: User, label: "Profile",       href: "/dashboard/profile" },
      { icon: Bell, label: "Notifications", href: "/dashboard/notifications", badge: 3 },
    ],
  },
  {
    label: "Security",
    items: [
      { icon: Shield, label: "Security", href: "/dashboard/security" },
      { icon: Key,    label: "API Keys", href: "/dashboard/api-keys" },
    ],
  },
];

function NavItem({
  icon: Icon,
  label,
  href,
  badge,
  active,
  collapsed,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 outline-none
        ${active
          ? "bg-indigo-50 text-indigo-600 shadow-[inset_0_1px_0_rgba(99,102,241,0.1)]"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        }
      `}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-indigo-500" />
      )}

      <Icon
        size={16}
        className={`flex-shrink-0 transition-colors duration-200 ${
          active ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-600"
        }`}
      />

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-500">
              {badge}
            </span>
          )}
        </>
      )}

      {collapsed && (
        <span
          className="
            pointer-events-none absolute left-full ml-3 z-50
            whitespace-nowrap rounded-lg bg-white border border-slate-200
            px-2.5 py-1.5 text-xs text-slate-700 shadow-lg
            opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-150
          "
        >
          {label}
          {badge !== undefined && (
            <span className="ml-1.5 inline-flex h-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-500">
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}) {

  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  const sidebarContent = (
    <div
      className={`
        flex flex-col h-full bg-white
        border-r border-slate-200
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[68px]" : "w-64"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex-shrink-0 w-7 h-7 relative">
            <Image
              src="/logo.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <span className="text-slate-800 font-semibold text-sm tracking-tight whitespace-nowrap">
              KPI
            </span>
          )}
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex w-6 h-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight
            size={14}
            className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
            )}
            {collapsed && (
              <div className="mx-3 mb-1.5 h-px bg-slate-200" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname === item.href}
                  collapsed={collapsed}
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
          collapsed={collapsed}
        />
      </div>

      {/* User footer */}
      <div className="border-t border-slate-200 p-3 flex-shrink-0">
        <div
          className={`flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50 transition-colors group ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <UserAvatar image={user?.image} name={user?.name} size="md" />

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                  {user?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-slate-400 truncate leading-tight">
                  {user?.email ?? ""}
                </p>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
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
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
        aria-label="Open menu"
      >
        <Menu size={16} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`
          md:hidden fixed inset-y-0 left-0 z-50
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="relative h-full w-64">
          {sidebarContent}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3.5 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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