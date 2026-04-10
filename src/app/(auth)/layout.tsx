import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Authentication",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{
        backgroundImage: "url('/5.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50 z-0" />

      {/* Top border accent */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60 z-20" />

      {/* Logo */}
      <header className="relative z-10 flex items-center justify-between pt-6 px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-opacity hover:opacity-70"
        >
          <div className="flex-shrink-0 w-8 h-8 relative">
            <Image
              src="/logo.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
       <span className="inline-flex flex-col leading-none select-none">
  <span className="flex items-baseline gap-[1px]">
    <span className="font-black text-lg tracking-tight" style={{ color: "#2EA8FF" }}>HERB</span>
    <span className="font-black text-lg tracking-tight" style={{ color: "#FF4D4D" }}>JOY</span>
  </span>
  <span className="font-medium text-[9px] tracking-[0.15em] uppercase" style={{ color: "#F4C542" }}>
    Productivity Tracker
  </span>
</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1 shadow-sm backdrop-blur-sm">
          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          Secure login
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-4 text-xs text-white/50">
          <Link href="/privacy" className="hover:text-white transition-colors">Key</Link>
          <span className="w-px h-3 bg-white/30" />
          <Link href="/terms" className="hover:text-white transition-colors">Performance</Link>
          <span className="w-px h-3 bg-white/30" />
          <Link href="/support" className="hover:text-white transition-colors">Indicator</Link>
        </div>
       <p className="text-white/50 text-xs tracking-wide font-medium">
  © {new Date().getFullYear()} KPI Dashboard · Crafted by{" "}
  <span className="text-white/80 font-semibold">NikPacs</span>
</p>
      </footer>
    </div>
  );
}