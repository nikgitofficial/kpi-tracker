import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { SignOutButton } from "@/components/SignOutButton"; // not needed here, see below

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-white dark:bg-surface-950">
      <Sidebar user={session.user} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar user={session.user} notificationCount={3} />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}