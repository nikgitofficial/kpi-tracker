import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicyPage() {
  const lastUpdated = "April 7, 2026";

  const sections = [
    {
      title: "1. Information We Collect",
      content: `We collect information you provide directly to us, such as when you create an account, including your full name, email address, and password. If you sign in with Google, we receive your name, email address, and profile picture from Google. We also collect usage data such as transaction logs, performance metrics, and activity timestamps generated through your use of the Service.`,
    },
    {
      title: "2. How We Use Your Information",
      content: `We use the information we collect to provide, maintain, and improve the Service; to process and record KPI transactions; to generate performance analytics and reports; to send you technical notices and support messages; to respond to your comments and questions; and to monitor and analyze usage patterns to improve the user experience.`,
    },
    {
      title: "3. Information Sharing",
      content: `We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating the Service (such as hosting and database providers), when required by law or legal process, or to protect the rights, property, or safety of KPI, our users, or others. All third-party providers are bound by confidentiality agreements.`,
    },
    {
      title: "4. Data Storage and Security",
      content: `Your data is stored securely in MongoDB. We implement industry-standard security measures including encrypted connections (HTTPS/TLS), hashed passwords, and access controls. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security. We encourage you to use a strong, unique password for your account.`,
    },
    {
      title: "5. Cookies and Tracking",
      content: `We use session cookies to keep you logged in and to maintain your preferences. We do not use third-party advertising cookies or tracking pixels. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent, though some features of the Service may not function properly without cookies.`,
    },
    {
      title: "6. Google OAuth",
      content: `If you choose to sign in with Google, we access only your basic profile information (name, email, profile picture) as authorized by Google's OAuth 2.0 protocol. We do not access your Google Drive, Gmail, contacts, or any other Google services. You can revoke this access at any time through your Google account settings.`,
    },
    {
      title: "7. Data Retention",
      content: `We retain your account information for as long as your account is active or as needed to provide the Service. Transaction and performance data is retained to support historical analytics and reporting. You may request deletion of your account and associated data by contacting us at support@kpi.app.`,
    },
    {
      title: "8. Your Rights",
      content: `You have the right to access the personal information we hold about you, to correct inaccurate data, to request deletion of your data, and to export your data in a portable format. To exercise any of these rights, please contact us at support@kpi.app. We will respond to your request within 30 days.`,
    },
    {
      title: "9. Children's Privacy",
      content: `The Service is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information.`,
    },
    {
      title: "10. Changes to This Policy",
      content: `We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the date at the top of this page. Your continued use of the Service after changes are posted constitutes your acceptance of the updated policy.`,
    },
    {
      title: "11. Contact Us",
      content: `If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at support@kpi.app or through our Support page. We take privacy seriously and will respond promptly to your inquiry.`,
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
            <Link href="/terms" className="hover:text-indigo-600 transition-colors font-medium">Terms of Service</Link>
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Last updated: <span className="font-medium text-slate-700">{lastUpdated}</span></p>
          <p className="text-slate-500 text-sm mt-3 max-w-2xl">
            Your privacy is important to us. This policy explains what data we collect, how we use it, and the choices you have regarding your information.
          </p>

          {/* Quick trust badges */}
          <div className="flex flex-wrap gap-3 mt-6">
            {[
              { icon: "🔒", label: "No data selling" },
              { icon: "🛡️", label: "Encrypted storage" },
              { icon: "👤", label: "You own your data" },
              { icon: "🚫", label: "No ad tracking" },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5 text-xs text-slate-600 font-medium">
                <span>{b.icon}</span> {b.label}
              </div>
            ))}
          </div>
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
          <main className="lg:col-span-3 space-y-6">
            {sections.map((s, i) => (
              <div key={i} id={`section-${i}`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-200 transition-colors">
                <h2 className="text-base font-bold text-slate-800 mb-3">{s.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{s.content}</p>
              </div>
            ))}

            {/* Footer note */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <p className="text-sm text-indigo-700 leading-relaxed">
                We are committed to protecting your privacy and handling your data responsibly.
                For questions, visit our{" "}
                <Link href="/support" className="font-semibold underline underline-offset-2 hover:text-indigo-900">Support page</Link> or review our{" "}
                <Link href="/terms" className="font-semibold underline underline-offset-2 hover:text-indigo-900">Terms of Service</Link>.
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
            <Link href="/privacy" className="hover:text-slate-600 transition-colors font-medium text-slate-600">Privacy Policy</Link>
            <span className="w-px h-3 bg-slate-300" />
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
            <span className="w-px h-3 bg-slate-300" />
            <Link href="/support" className="hover:text-slate-600 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}