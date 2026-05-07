"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Timer,
  ClipboardList,
  BarChart2,
  Users,
  Tag,
  FileSpreadsheet,
  FileText,
  Bell,
  Trophy,
  Keyboard,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Play,
  Pause,
  Square,
  ListPlus,
  Plus,
  PauseCircle,
  Settings,
  Zap,
  HelpCircle,
  MessageSquare,
  ChevronUp,
  Info,
  Download,
  Upload,
  Mail,
Phone,
User,
ShieldCheck,
} from "lucide-react";

/* ─── Types ─── */
interface FaqItem {
  question: string;
  answer: string;
  tags?: string[];
}

interface FaqSection {
  id: string;
  icon: React.ElementType;
  title: string;
  color: string;
  bg: string;
  border: string;
  items: FaqItem[];
}

/* ─── Data ─── */
const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "getting-started",
    icon: Zap,
    title: "Getting Started",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    items: [
      {
        question: "How do I begin logging transactions for the day?",
        answer:
          "Start by selecting your name from the agent dropdown at the top of the TX Log page. This is critical — every transaction you log will be saved under the selected agent. Once your name is selected, pick a date (defaults to today), then either click 'Log Transaction' in the left panel or click any task type from the sidebar to pre-fill the form.",
        tags: ["first steps", "agent", "log"],
      },
      {
        question: "Why must I select my name before logging?",
        answer:
          "All transactions are tied to a specific agent record. If you log under the wrong name, those entries cannot be automatically reassigned — a supervisor or team leader must manually correct them. Always double-check the agent dropdown before you start your shift.",
        tags: ["agent", "important"],
      },
      {
        question: "Can I log transactions for a past or future date?",
        answer:
          "Yes. Use the date picker in the top header to select any date. Click 'Today' to quickly jump back to the current date. Note that productivity timer data is also date-scoped, so the timer will reflect whatever date is selected.",
        tags: ["date", "history"],
      },
    ],
  },
  {
    id: "productivity-timer",
    icon: Timer,
    title: "Productivity Timer",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    items: [
      {
        question: "How does the Productivity Timer work?",
        answer:
          "The timer tracks your total working time for the day and is stored in the database — so it survives page refreshes and browser closures. Click 'Start' at the beginning of your shift. You can 'Pause' it during breaks, then 'Resume' to continue. When your shift ends, click 'End' to finalize your productive hours. The system will subtract any Bio Break time automatically.",
        tags: ["timer", "productivity"],
      },
      {
        question: "What happens if I forget to end the timer?",
        answer:
          "If you close the browser or navigate away while the timer is running, it will send a beacon request to pause the timer automatically. However, you should always click 'End' manually before leaving your shift to ensure the final calculation (including bio break deduction) is applied correctly.",
        tags: ["timer", "important"],
      },
      {
        question: "What is the 'End' button vs 'Pause'?",
        answer:
          "'Pause' temporarily stops the timer — you can resume it later without any data loss. 'End' finalizes the session: it shows you Total Timer time, Bio Break time to deduct, and the resulting Net Productive Time. Once you confirm End, the productive seconds are saved and the timer resets to a 'Done' state. You can still use 'Continue' afterward if needed.",
        tags: ["timer", "end", "pause"],
      },
      {
        question: "Can I edit my productive time if it's incorrect?",
        answer:
          "Yes, but it requires your account password as verification. When the timer is not running (paused or done), an 'Edit' link appears in the timer header. Click it, enter your password, and you'll be able to type in the correct HH:MM:SS value. Quick-select buttons (7h, 7h 30m, 8h, etc.) are provided for convenience.",
        tags: ["timer", "edit", "password"],
      },
      {
        question: "Why is there a clock-skew offset?",
        answer:
          "The timer calculates server time vs. client time on load to correct for minor differences between your computer's clock and the server. This ensures the displayed elapsed time is accurate even if your system clock is slightly off. You don't need to do anything — it's handled automatically.",
        tags: ["timer", "technical"],
      },
    ],
  },
  {
    id: "bio-breaks",
    icon: PauseCircle,
    title: "Bio Break Tracker",
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    items: [
      {
        question: "How do I track a bio break?",
        answer:
          "In the left panel, click 'Start Session' first if you haven't already (this records your session start time). Then click the '🚻 Bio Break' button whenever you step away. When you return, click 'Return' to end the break. Each break is logged with start/end time and duration.",
        tags: ["bio break", "session"],
      },
      {
        question: "Does bio break time affect my productivity hours?",
        answer:
          "Yes. When you click 'End' on the Productivity Timer, the total bio break time accumulated for the day is automatically deducted from your gross timer value to produce your Net Productive Time. This is the value that gets saved.",
        tags: ["bio break", "productivity", "deduction"],
      },
      {
        question: "What if I forgot to start a session before logging bio breaks?",
        answer:
          "Clicking 'Bio Break' will automatically create a session if one doesn't exist yet. However, best practice is to click 'Start Session' at the beginning of your shift so your session start time is accurate.",
        tags: ["bio break", "session"],
      },
    ],
  },
  {
    id: "transactions",
    icon: ClipboardList,
    title: "Logging Transactions",
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    items: [
      {
        question: "What is the difference between Production and Non-Production tasks?",
        answer:
          "Production tasks (marked with ⚙) are core operational tasks that count toward KPIs — things like processing documents, handling client files, etc. Non-Production tasks (marked with ✉) are supporting activities like emails, meetings, or admin work. The category is set on each task type in Manage Setup and cannot be changed per-transaction.",
        tags: ["category", "production"],
      },
      {
        question: "What does TX vs VOL mean on task types?",
        answer:
          "TX (Transaction) means each log entry counts as 1 unit regardless of volume — useful when you're tracking the number of tasks done. VOL (Volume) means the count uses the 'No. of Employees / Volume' field value — useful when the quantity processed matters (e.g., 50 payslips in one batch = 50 VOL). This is configured per task type in Manage Setup.",
        tags: ["count type", "volume", "tx"],
      },
      {
        question: "What are the four statuses?",
        answer:
          "COMPLETION — task is fully done. PENDING — task is started but not yet complete (e.g. waiting on a response). ESCALATION — task has been escalated to another team or requires special handling. HOLD — task is paused and will be resumed later. Hold transactions show a 'Resume' button in the log.",
        tags: ["status", "completion", "pending", "escalation", "hold"],
      },
      {
        question: "How do I put a transaction on Hold and resume it?",
        answer:
          "When logging or editing a transaction, click the 'Hold' button (the blue pause-circle button in the modal footer). The transaction will be saved with HOLD status. To resume, find it in the table — it will show a green 'Resume' button under its status badge. Clicking Resume opens the edit form pre-filled with the original data.",
        tags: ["hold", "resume"],
      },
      {
        question: "Can I add notes to a transaction?",
        answer:
          "Yes. The 'Notes' field in the log form is optional and supports free-form text. Notes appear in the table, can be searched in the filter bar, and are included in Excel/PDF exports. Use notes for things like ticket numbers, client-specific instructions, or escalation reasons.",
        tags: ["notes"],
      },
    ],
  },
  {
    id: "subtasks",
    icon: ListPlus,
    title: "Subtasks",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    items: [
      {
        question: "What are subtasks?",
        answer:
          "Subtasks let you attach additional work items to a parent transaction. For example, if you processed a payroll batch and also handled a termination document as part of the same workflow, you can log the main task and add the termination as a subtask. Subtasks have their own type, status, number/volume, and notes.",
        tags: ["subtasks"],
      },
      {
        question: "How do I add a subtask to an existing transaction?",
        answer:
          "In the transaction table, expand a row by clicking the chevron (▶) on the left, or hover over the row and press keyboard shortcut '1'. You can also click the ListPlus icon in the Actions column. This reveals the subtask rows and an '+ Add subtask' button at the bottom.",
        tags: ["subtasks", "add"],
      },
      {
        question: "Can I add subtasks while logging a new transaction?",
        answer:
          "Yes. At the bottom of the Log Transaction modal, there's a 'Subtasks' section with an 'Add' button. Each subtask row lets you pick a task type, enter a number, set a status, and add notes. These subtasks are saved together with the parent transaction in one operation.",
        tags: ["subtasks", "log form"],
      },
      {
        question: "How do I edit or delete a subtask?",
        answer:
          "Expand the parent transaction row in the table. Each subtask row has an Edit (pencil) and Delete (trash) button. Hover over a subtask to see keyboard shortcuts: press '1' to edit, '2' to delete. You can also click directly on the subtask row to open the inline edit form.",
        tags: ["subtasks", "edit", "delete"],
      },
    ],
  },
  {
    id: "keyboard-shortcuts",
    icon: Keyboard,
    title: "Keyboard Shortcuts",
    color: "text-slate-600 dark:text-zinc-300",
    bg: "bg-slate-100 dark:bg-zinc-800",
    border: "border-slate-200 dark:border-zinc-700",
    items: [
      {
        question: "What keyboard shortcuts are available on transaction rows?",
        answer:
          "Hover over any transaction row to activate shortcuts for that row: Press '1' to add a subtask, '2' to edit the transaction, '3' to delete it. A tooltip appears with these hints when hovering.",
        tags: ["keyboard", "shortcuts"],
      },
      {
        question: "What keyboard shortcuts are available on subtask rows?",
        answer:
          "Hover over any subtask row to activate: Press '1' to edit the subtask, '2' to delete it. The tooltip on hover shows these shortcuts.",
        tags: ["keyboard", "shortcuts", "subtasks"],
      },
    ],
  },
  {
    id: "export-import",
    icon: FileSpreadsheet,
    title: "Export & Import",
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-800",
    items: [
      {
        question: "How do I export my transaction log?",
        answer:
          "Use the 'Excel' or 'PDF' buttons in the top header. Excel exports both a Transactions sheet (all rows + subtasks) and a Summary sheet (stats, task type breakdown). PDF exports a styled landscape report with summary stats and the full table. Both require at least one transaction logged for the selected agent and date.",
        tags: ["export", "excel", "pdf"],
      },
      {
        question: "How do I import transactions from an Excel file?",
        answer:
          "Click the 'Import' button in the top header. Drag-and-drop or browse for a .xlsx file (use a previously exported tx-log file for best results). The importer reads the 'Transactions' sheet, detects main rows by the 'Type of Task' column, and groups subtask rows (identified by 'Subtask Task') under their parent. Review the preview table, then click 'Import' to save all rows.",
        tags: ["import", "excel"],
      },
      {
        question: "What happens to company names during import?",
        answer:
          "Imported transactions will have their company name set to 'Imported' as a placeholder. You can edit each row after import to add the correct company name by clicking the row or using the Edit action.",
        tags: ["import", "company name"],
      },
    ],
  },
  {
    id: "manage-setup",
    icon: Settings,
    title: "Manage Setup",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    items: [
      {
        question: "How do I add a new agent (team member)?",
        answer:
          "Click the '+' icon in the task types sidebar header, or go to the Manage Setup page from the sidebar. In the Agents section, enter the agent's name and optionally a group label, then click 'Add'. The agent will immediately appear in the dropdown on the TX Log page.",
        tags: ["agent", "setup"],
      },
      {
        question: "How do I add or edit task types?",
        answer:
          "In the Manage Setup / Settings modal, go to the Task Types section. Enter a name, choose Production or Non-Production category, and choose TX or VOL count type. Click 'Add'. To edit an existing task type, click the pencil icon on its row — you can change name, category, and count type inline.",
        tags: ["task type", "setup", "edit"],
      },
      {
        question: "Can I assign agents to groups?",
        answer:
          "Yes. Each agent can have an optional group label (e.g. 'Team A', 'Night Shift'). You can set it when creating the agent or edit it inline in the agent list. Groups appear in the agent dropdown alongside the name for easy identification.",
        tags: ["agent", "group", "setup"],
      },
    ],
  },
  {
    id: "leaderboard-announcements",
    icon: Trophy,
    title: "Leaderboard & Announcements",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    items: [
      {
        question: "How is the Leaderboard score calculated?",
        answer:
          "Each agent's score combines productive minutes and completed transactions. The formula is: (productive seconds ÷ 60) + (completion transactions × 12). The leaderboard refreshes every 15 seconds and also polls for changes every 30–90 seconds in the background to auto-show when rankings shift.",
        tags: ["leaderboard", "score"],
      },
      {
        question: "What are the Reminders & Holidays announcements?",
        answer:
          "The announcements bell shows pinned operational reminders (like 'select your name first') and live public holiday data fetched from the Nager.Date API for PH, US, and Canada. Holiday data is cached locally for 24 hours. Unread items are tracked per-browser — clicking an item marks it as read.",
        tags: ["announcements", "holidays"],
      },
    ],
  },
];

/* ─── Keyboard Shortcut Reference Table ─── */
const SHORTCUT_TABLE = [
  { key: "1", context: "Transaction row (hovered)", action: "Add a subtask to this transaction" },
  { key: "2", context: "Transaction row (hovered)", action: "Edit the transaction" },
  { key: "3", context: "Transaction row (hovered)", action: "Delete the transaction" },
  { key: "1", context: "Subtask row (hovered)", action: "Edit the subtask" },
  { key: "2", context: "Subtask row (hovered)", action: "Delete the subtask" },
];

/* ─── Quick Tips ─── */
const QUICK_TIPS = [
  {
    icon: Users,
    color: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-200",
    tip: "Always select your name first before logging any transactions.",
  },
  {
    icon: Timer,
    color: "text-emerald-500",
    bg: "bg-emerald-50 border-emerald-200",
    tip: "Click 'End' on the timer before leaving your shift — pausing alone doesn't finalize your hours.",
  },
  {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50 border-green-200",
    tip: "Double-check task types, volumes, and statuses before submitting for the day.",
  },
  {
    icon: PauseCircle,
    color: "text-sky-500",
    bg: "bg-sky-50 border-sky-200",
    tip: "Use Hold for tasks you'll return to — they stay in your log with a Resume button.",
  },
  {
    icon: Keyboard,
    color: "text-slate-500",
    bg: "bg-slate-100 border-slate-200",
    tip: "Hover over any row and use keyboard shortcuts 1/2/3 to act without clicking.",
  },
  {
    icon: FileSpreadsheet,
    color: "text-teal-500",
    bg: "bg-teal-50 border-teal-200",
    tip: "Export to Excel at the end of each day as a backup before major changes.",
  },
];

/* ─── FAQ Accordion Item ─── */
function AccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        open
          ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900"
          : "border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-200 dark:hover:border-zinc-700"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-500 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <span
            className={`text-sm font-medium leading-snug ${
              open
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-700 dark:text-zinc-200"
            }`}
          >
            {item.question}
          </span>
        </div>
        <div
          className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
            open
              ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-500"
              : "text-slate-300 dark:text-zinc-600"
          }`}
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-slate-100 dark:border-zinc-800">
          <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed pt-3 pl-8">
            {item.answer}
          </p>
          {item.tags && (
            <div className="flex flex-wrap gap-1.5 mt-3 pl-8">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 text-[10px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── FAQ Section ─── */
function FaqSectionBlock({ section }: { section: FaqSection }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = section.icon;

  return (
    <div className="mb-8" id={section.id}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 mb-4 group"
      >
        <div
          className={`w-8 h-8 rounded-xl ${section.bg} border ${section.border} flex items-center justify-center flex-shrink-0`}
        >
          <Icon size={14} className={section.color} />
        </div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wide flex-1 text-left">
          {section.title}
        </h2>
        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
          {section.items.length} article{section.items.length !== 1 ? "s" : ""}
        </span>
        <div
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-400`}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 pl-0">
          {section.items.map((item, i) => (
            <AccordionItem key={i} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function HelpSupportPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<
    { section: FaqSection; item: FaqItem; itemIndex: number }[]
  >([]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results: { section: FaqSection; item: FaqItem; itemIndex: number }[] = [];
    FAQ_SECTIONS.forEach((section) => {
      section.items.forEach((item, itemIndex) => {
        if (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          (item.tags ?? []).some((t) => t.toLowerCase().includes(q))
        ) {
          results.push({ section, item, itemIndex });
        }
      });
    });
    setSearchResults(results);
  }, [searchQuery]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  const filteredSections = activeSection
    ? FAQ_SECTIONS.filter((s) => s.id === activeSection)
    : FAQ_SECTIONS;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* ── Page Header ── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <HelpCircle size={15} className="text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                  Help & Support
                </h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xl">
                Everything you need to know about using the HERBJOY Productivity
                Tracker — from logging your first transaction to reading your
                analytics.
              </p>
            </div>
            <div className="flex-shrink-0 hidden md:flex flex-col items-end gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 dark:text-zinc-600">
                Version
              </span>
              <span className="text-sm font-bold text-indigo-500">
                TX Log v2.0
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 relative max-w-xl">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles… (e.g. timer, subtask, hold)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-700 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search results count */}
          {searchQuery && (
            <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">
              {searchResults.length === 0
                ? "No results found. Try a different keyword."
                : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8">
        {/* ── Sidebar Navigation ── */}
        <aside className="hidden lg:flex flex-col w-52 flex-shrink-0">
          <div className="sticky top-6 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3 px-2">
              Jump to
            </p>
            <button
              onClick={() => { setActiveSection(null); setSearchQuery(""); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                !activeSection && !searchQuery
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              All Topics
            </button>
            {FAQ_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => { scrollToSection(section.id); setSearchQuery(""); setActiveSection(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                    activeSection === section.id
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                      : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon size={12} className="flex-shrink-0 opacity-60" />
                  <span className="truncate">{section.title}</span>
                </button>
              );
            })}

            <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 mt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2 px-2">
                Resources
              </p>
              <a
                href="/dashboard/manage-setup"
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
              >
                <Settings size={12} className="opacity-60" />
                Manage Setup
              </a>
              <a
                href="/dashboard/analytics"
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-2"
              >
                <BarChart2 size={12} className="opacity-60" />
                Analytics
              </a>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          {/* Quick Tips Strip */}
          {!searchQuery && (
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3">
                Quick Reminders
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_TIPS.map((tip, i) => {
                  const Icon = tip.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border ${tip.bg} dark:bg-zinc-800/50 dark:border-zinc-700`}
                    >
                      <Icon size={13} className={`${tip.color} flex-shrink-0 mt-0.5`} />
                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                        {tip.tip}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3">
                Search Results
              </p>
              <div className="space-y-2">
                {searchResults.map(({ section, item, itemIndex }, i) => {
                  const Icon = section.icon;
                  return (
                    <div
                      key={i}
                      className="border border-slate-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden"
                    >
                      <div
                        className={`flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-zinc-800 ${section.bg} dark:bg-zinc-800/50`}
                      >
                        <Icon size={11} className={section.color} />
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                          {section.title}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 mb-1.5">
                          {item.question}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-3">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                <Search size={20} className="text-slate-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                No results for "{searchQuery}"
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Try searching for: timer, hold, subtask, export, bio break
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* FAQ Sections */}
          {!searchQuery && (
            <>
              {filteredSections.map((section) => (
                <FaqSectionBlock key={section.id} section={section} />
              ))}

              {/* Keyboard Shortcuts Reference */}
              <div className="mb-8" id="shortcuts-reference">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Keyboard size={14} className="text-slate-500 dark:text-zinc-400" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wide">
                    Keyboard Shortcut Reference
                  </h2>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 w-16">
                          Key
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          Context
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SHORTCUT_TABLE.map((row, i) => (
                        <tr
                          key={i}
                          className={
                            i < SHORTCUT_TABLE.length - 1
                              ? "border-b border-slate-100 dark:border-zinc-800"
                              : ""
                          }
                        >
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 dark:bg-zinc-700 text-white text-xs font-bold shadow-sm">
                              {row.key}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                            {row.context}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 dark:text-zinc-200 font-medium">
                            {row.action}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-800/30">
                    <Info size={11} className="text-indigo-400 flex-shrink-0" />
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      Shortcuts only activate when hovering over the target row — they won't
                      fire if a text input, select, or textarea is focused.
                    </p>
                  </div>
                </div>
              </div>

              {/* Workflow Overview */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={14} className="text-indigo-500" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wide">
                    Recommended Daily Workflow
                  </h2>
                </div>
                <div className="relative">
                  {[
                    {
                      step: 1,
                      icon: Users,
                      color: "text-indigo-500",
                      bg: "bg-indigo-50 border-indigo-200",
                      title: "Select your agent name",
                      desc: "Choose your name from the dropdown at the top of TX Log. Do this before anything else.",
                    },
                    {
                      step: 2,
                      icon: Play,
                      color: "text-emerald-500",
                      bg: "bg-emerald-50 border-emerald-200",
                      title: "Start the Productivity Timer",
                      desc: "Click 'Start Session' in the Bio Break panel, then 'Start' in the Productivity Timer.",
                    },
                    {
                      step: 3,
                      icon: ClipboardList,
                      color: "text-amber-500",
                      bg: "bg-amber-50 border-amber-200",
                      title: "Log transactions throughout the day",
                      desc: "Use the task type sidebar or 'Log Transaction' button. Add subtasks where applicable.",
                    },
                    {
                      step: 4,
                      icon: PauseCircle,
                      color: "text-sky-500",
                      bg: "bg-sky-50 border-sky-200",
                      title: "Track bio breaks",
                      desc: "Click '🚻 Bio Break' when stepping away and 'Return' when you're back.",
                    },
                    {
                      step: 5,
                      icon: CheckCircle2,
                      color: "text-green-500",
                      bg: "bg-green-50 border-green-200",
                      title: "Review your log before end of shift",
                      desc: "Check all statuses, volumes, and task types. Fix anything incorrect.",
                    },
                    {
                      step: 6,
                      icon: Square,
                      color: "text-indigo-500",
                      bg: "bg-indigo-50 border-indigo-200",
                      title: "End the Productivity Timer",
                      desc: "Click 'End', review the net productive time summary, then confirm.",
                    },
                    {
                      step: 7,
                      icon: Download,
                      color: "text-teal-500",
                      bg: "bg-teal-50 border-teal-200",
                      title: "Export if needed",
                      desc: "Export to Excel or PDF for your records or to share with your team leader.",
                    },
                  ].map((s, i, arr) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.step} className="flex gap-4 mb-0">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-xl ${s.bg} border flex items-center justify-center flex-shrink-0 z-10`}
                          >
                            <Icon size={14} className={s.color} />
                          </div>
                          {i < arr.length - 1 && (
                            <div className="w-px flex-1 bg-slate-200 dark:bg-zinc-800 my-1" />
                          )}
                        </div>
                        <div className={`pb-5 ${i === arr.length - 1 ? "pb-0" : ""}`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 dark:text-zinc-600">
                              Step {s.step}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200 leading-tight mb-1">
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                            {s.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Contact / Footer card */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-1">
                      Still have questions?
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed mb-3">
                      If something isn't covered here or you've found a bug, reach out to your
                      team leader or the DevOps team. For access issues, incorrect data, or
                      feature requests, include the specific agent name, date, and a description
                      of the problem.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {/* Team Leader */}
  <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 p-3">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <User size={15} className="text-amber-600" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          Team Leader
        </p>

        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200 mt-0.5">
          Cris Arandilla
        </p>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Mail size={12} className="text-indigo-500 flex-shrink-0" />
            <a
              href="mailto:carandilla@sixelevencenter.com"
              className="hover:text-indigo-600 transition-colors truncate"
            >
              carandilla@sixelevencenter.com
            </a>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Phone size={12} className="text-emerald-500 flex-shrink-0" />
            <a
              href="tel:+639123456789"
              className="hover:text-emerald-600 transition-colors"
            >
              +63 912 345 6789
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* DevOps */}
  <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 p-3">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
        <ShieldCheck size={15} className="text-indigo-600" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          DevOps Support
        </p>

        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200 mt-0.5">
          System Support Team
        </p>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Mail size={12} className="text-indigo-500 flex-shrink-0" />
            <a
              href="mailto:nickforjobacc@mgail.com"
              className="hover:text-indigo-600 transition-colors truncate"
            >
              nickforjobacc@mgail.com
            </a>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Phone size={12} className="text-emerald-500 flex-shrink-0" />
            <a
              href="tel:+639987654321"
              className="hover:text-emerald-600 transition-colors"
            >
              +63 951 419 0949
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}