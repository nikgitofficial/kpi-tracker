import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Shield, Mail, Calendar } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { DashboardKpi } from "@/components/dashboard/DashboardKpi";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { user } = session;
  const joinedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-dvh bg-slate-50 relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(79,70,229,0.04) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/4 w-[600px] h-[400px] opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Top border accent */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60 z-20" />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <p className="text-sm text-indigo-500 font-medium mb-1">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Welcome back, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Here&apos;s what&apos;s happening with your team today.
          </p>
        </div>

        {/* ── KPI live section (client component) ── */}
        <DashboardKpi />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Profile card */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-slate-200/60">
            <div className="flex items-start gap-4">
              <UserAvatar image={user?.image} name={user?.name} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="text-slate-900 font-semibold text-base truncate">{user?.name}</h2>
                <p className="text-slate-500 text-sm truncate">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-600 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Active
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-500 text-xs font-medium">
                    <Shield size={10} />
                    Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</p>
                <div className="flex items-center gap-2 text-slate-700 text-sm">
                  <Mail size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{user?.email}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Member since</p>
                <div className="flex items-center gap-2 text-slate-700 text-sm">
                  <Calendar size={13} className="text-slate-400 flex-shrink-0" />
                  {joinedDate}
                </div>
              </div>
            </div>
          </div>

          {/* Security card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm shadow-slate-200/60">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900">Security</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Password", status: "Set", ok: true },
                { label: "Session", status: "Active", ok: true },
                { label: "2FA", status: "Off", ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className={`text-xs font-medium ${item.ok ? "text-green-500" : "text-slate-400"}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield size={14} className="text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-0.5">Your session is protected</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                You&apos;re authenticated with JWT — your session will expire after 30 days of inactivity.
                Use the sign out button to end your session immediately.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}