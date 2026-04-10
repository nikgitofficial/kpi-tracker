// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { auth } from "@/lib/auth";
import { ThemeProvider } from "@/providers/ThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "KPI Tracker",
    template: "%s | KPI Tracker",
  },
  description:
    "Modern, secure authentication system built with Next.js 15, MongoDB, and NextAuth v5.",
  keywords: ["authentication", "nextjs", "mongodb", "security"],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 const session = await auth().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}