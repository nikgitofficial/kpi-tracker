import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { Shield, Mail, Calendar, User } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { user } = session;

  const joinedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10 animate-fade-up">
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Account</p>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Profile</h1>
          <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">
            Manage your personal information and profile picture.
          </p>
        </div>

        <div className="space-y-4 animate-fade-up delay-75">

          {/* ── Profile picture card ── */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <User size={14} className="text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Profile Picture</h2>
            </div>
            <AvatarUpload
              currentImage={user?.image}
              name={user?.name}
              email={user?.email}
            />
          </div>

          {/* ── Personal info card ── */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <User size={14} className="text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Full name</p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                  <User size={13} className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-zinc-300 truncate">{user?.name ?? "—"}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Email address</p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                  <Mail size={13} className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-zinc-300 truncate">{user?.email ?? "—"}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Member since</p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                  <Calendar size={13} className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-zinc-300">{joinedDate}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Account status</p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Badges card ── */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={14} className="text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Account Badges</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                <Shield size={10} />
                Verified
              </span>
              {user?.image && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-xs font-medium">
                  <User size={10} />
                  Photo set
                </span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}