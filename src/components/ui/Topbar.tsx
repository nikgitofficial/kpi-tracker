"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, HelpCircle, ChevronRight, LogOut, User, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/dashboard":               { title: "Dashboard",     crumb: "Overview"  },
  "/dashboard/activity":      { title: "Activity",      crumb: "Overview"  },
  "/dashboard/profile":       { title: "Profile",       crumb: "Account"   },
  "/dashboard/security":      { title: "Security",      crumb: "Security"  },
  "/dashboard/api-keys":      { title: "API Keys",      crumb: "Security"  },
  "/dashboard/settings":      { title: "Settings",      crumb: "Settings"  },
  "/dashboard/tx-log":        { title: "TX Log",        crumb: "KPI"       },
  "/dashboard/eod-report":    { title: "EOD Report",    crumb: "KPI"       },
  "/dashboard/analytics":     { title: "Analytics",     crumb: "KPI"       },
};

export function Topbar({
  user,
  notificationCount = 3,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  notificationCount?: number;
}) {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: "Dashboard", crumb: "Overview" };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
   <header className="sticky top-0 z-30 h-14 flex items-center border-b border-slate-200 bg-white px-6 gap-4">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        <span className="text-slate-400 hidden sm:block">{meta.crumb}</span>
        <ChevronRight size={13} className="text-slate-300 hidden sm:block flex-shrink-0" />
        <span className="text-slate-900 font-semibold truncate">{meta.title}</span>
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          className="
            w-48 lg:w-64 h-8 pl-8 pr-10 rounded-lg
            bg-slate-50 border border-slate-200
            text-sm text-slate-700 placeholder:text-slate-400
            focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white
            transition-all duration-200
          "
        />
        <kbd className="absolute right-2.5 hidden lg:inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 bg-white">
          ⌘K
        </kbd>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">

        {/* Help */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <HelpCircle size={15} />
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <Bell size={15} />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 border border-white" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-1.5" />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`
              flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl
              border transition-all duration-200
              ${dropdownOpen
                ? "bg-slate-100 border-slate-200"
                : "border-transparent hover:bg-slate-100 hover:border-slate-200"
              }
            `}
          >
            <UserAvatar image={user?.image} name={user?.name} size="sm" />

            <div className="hidden lg:block text-left">
              <p className="text-xs font-medium text-slate-700 leading-tight truncate max-w-[100px]">
                {user?.name ?? "User"}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[100px]">
                {user?.email ?? ""}
              </p>
            </div>

            <ChevronRight
              size={12}
              className="text-slate-400 hidden lg:block transition-transform duration-200"
              style={{ transform: dropdownOpen ? "rotate(-90deg)" : "rotate(90deg)" }}
            />
          </button>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden z-50">

              {/* User info header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                <UserAvatar image={user?.image} name={user?.name} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name ?? "User"}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email ?? ""}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1.5">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <User size={14} className="text-slate-400" />
                  Profile
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={14} className="text-slate-400" />
                  Settings
                </Link>
              </div>

              {/* Sign out */}
              <div className="p-1.5 border-t border-slate-100">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}