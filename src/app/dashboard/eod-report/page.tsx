import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EodReportClient } from "@/components/kpi/EodReportClient";

export default async function EodReportPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <EodReportClient />;
}