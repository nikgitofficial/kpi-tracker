import Link from "next/link";
import Image from "next/image";

export default function TermsOfServicePage() {
  const lastUpdated = "April 7, 2026";

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By accessing or using KPI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms apply to all users, including visitors, registered users, and administrators.`,
    },
    {
      title: "2. Use of the Service",
      content: `You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service in any way that violates applicable laws or regulations, to transmit unauthorized advertising or spam, to impersonate any person or entity, or to interfere with the proper functioning of the Service.`,
    },
    {
      title: "3. Account Registration",
      content: `To access certain features, you must register for an account. You agree to provide accurate and complete information during registration and to keep your account credentials secure. You are responsible for all activities that occur under your account. Notify us immediately of any unauthorized use of your account.`,
    },
    {
      title: "4. Intellectual Property",
      content: `The Service and its original content, features, and functionality are and will remain the exclusive property of KPI and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of KPI.`,
    },
    {
      title: "5. Data and Privacy",
      content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of information as described in our Privacy Policy.`,
    },
    {
      title: "6. Termination",
      content: `We may terminate or suspend your account and access to the Service at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason. Upon termination, your right to use the Service will immediately cease.`,
    },
    {
      title: "7. Disclaimer of Warranties",
      content: `The Service is provided on an "AS IS" and "AS AVAILABLE" basis without any warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.`,
    },
    {
      title: "8. Limitation of Liability",
      content: `To the fullest extent permitted by law, KPI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, even if we have been advised of the possibility of such damages.`,
    },
    {
      title: "9. Changes to Terms",
      content: `We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the date at the top of this page. Your continued use of the Service after such changes constitutes your acceptance of the new Terms.`,
    },
    {
      title: "10. Contact Us",
      content: `If you have any questions about these Terms of Service, please contact us at support@kpi.app or through the Support page.`,
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Top accent line */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60 z-20" />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
            <div className="w-7 h-7 relative flex-shrink-0">
              <Image src="/logo.png" alt="KPI" fill className="object-contain" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">KPI</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors font-medium">Privacy Policy</Link>
            <Link href="/login" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Legal</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: <span className="font-medium text-slate-700">{lastUpdated}</span></p>
          <p className="text-slate-500 text-sm mt-3 max-w-2xl">
            Please read these Terms of Service carefully before using KPI. By using our service, you agree to be bound by these terms.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar TOC */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contents</p>
              <nav className="space-y-1">
                {sections.map((s, i) => (
                  <a key={i} href={`#section-${i}`}
                    className="block text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors leading-tight">
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-8">
            {sections.map((s, i) => (
              <div key={i} id={`section-${i}`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-200 transition-colors">
                <h2 className="text-base font-bold text-slate-800 mb-3">{s.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{s.content}</p>
              </div>
            ))}

            {/* Footer note */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <p className="text-sm text-indigo-700 leading-relaxed">
                By using KPI, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                If you have questions, visit our{" "}
                <Link href="/support" className="font-semibold underline underline-offset-2 hover:text-indigo-900">Support page</Link> or review our{" "}
                <Link href="/privacy" className="font-semibold underline underline-offset-2 hover:text-indigo-900">Privacy Policy</Link>.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} KPI · Built with Next.js & MongoDB</p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
            <span className="w-px h-3 bg-slate-300" />
            <Link href="/terms" className="hover:text-slate-600 transition-colors font-medium text-slate-600">Terms of Service</Link>
            <span className="w-px h-3 bg-slate-300" />
            <Link href="/support" className="hover:text-slate-600 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}