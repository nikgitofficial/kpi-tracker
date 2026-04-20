/**
 * DROP-IN REPLACEMENT for the TxTableRow component in your tx-log page.tsx
 *
 * Changes vs original:
 *  1. Clicking the row opens the edit modal directly (calls onEdit(tx))
 *  2. A hover preview card floats near the row showing task type, status,
 *     company, volume, category, notes, and subtask count.
 *  3. Action buttons still work — clicks on them are stopped from bubbling
 *     so they don't also trigger the row-level edit.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronRight, ListPlus, Pencil, Trash2,
  Plus, X, Play, Building2, Package, Tag, FileText,
  AlertTriangle, CheckCircle2, Clock, PauseCircle,
} from "lucide-react";

/* ── Re-export the types your page already defines so this file is self-contained ── */
type CountType    = "transaction" | "volume";
type TaskCategory = "Production" | "Non-Production";

interface Subtask {
  _id: string;
  docType: string;
  number?: number;
  notes?: string;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  taskCategory: TaskCategory;
  countType?: CountType;
  createdAt: number;
}

interface Transaction {
  _id: string;
  agentName: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  endTime?: string;
  tat?: number;
  status: "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
  notes?: string;
  date: string;
  elapsedSeconds?: number;
  pausedAt?: number | null;
  taskCategory?: TaskCategory;
  subtasks?: Subtask[];
  productiveSeconds?: number;
  timerPaused?: boolean;
  countType?: CountType;
}

interface DocType { _id: string; name: string; taskCategory: TaskCategory; countType: CountType }

/* ─── Inline helpers (same as your page) ─── */
const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-400",   icon: Clock },
  COMPLETION: { label: "Completion", color: "text-green-600",  bg: "bg-green-50 border-green-200",   dot: "bg-green-500",   icon: CheckCircle2 },
  ESCALATION: { label: "Escalation", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500",  icon: AlertTriangle },
  HOLD:       { label: "Hold",       color: "text-sky-600",    bg: "bg-sky-50 border-sky-200",       dot: "bg-sky-400",     icon: PauseCircle },
};

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.color} ${cfg.bg}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category?: TaskCategory }) {
  const isProd = !category || category === "Production";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
      isProd ? "bg-indigo-50 border-indigo-200 text-indigo-600"
             : "bg-slate-100 border-slate-300 text-slate-500"
    }`}>
      {isProd ? "⚙" : "✉"} {isProd ? "Production" : "Non-Prod"}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   HOVER PREVIEW CARD
   ══════════════════════════════════════════════════════════ */
function TxPreviewCard({ tx }: { tx: Transaction }) {
  const cfg     = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG["PENDING"];
  const subtasks = tx.subtasks ?? [];

  return (
    /* Positioned by the row — see TxTableRow for placement logic */
    <div className="pointer-events-none w-72 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-left-1 duration-150">

      {/* Coloured status bar at top */}
      <div className={`h-1 w-full ${cfg.dot}`} />

      <div className="px-4 py-3 space-y-3">

        {/* Task name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Tag size={12} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{tx.docType}</p>
          </div>
          <StatusBadge status={tx.status} />
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-zinc-800" />

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Company */}
          <div className="flex items-start gap-1.5">
            <Building2 size={11} className="text-slate-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Company</p>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 truncate">{tx.companyName}</p>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-start gap-1.5">
            <Package size={11} className="text-slate-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Volume</p>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">{tx.volume}</p>
            </div>
          </div>

          {/* Category */}
          <div className="col-span-2">
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Category</p>
            <CategoryBadge category={tx.taskCategory} />
          </div>
        </div>

        {/* Notes */}
        {tx.notes && (
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
            <FileText size={10} className="text-slate-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{tx.notes}</p>
          </div>
        )}

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div>
            <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
              Subtasks ({subtasks.length})
            </p>
            <div className="space-y-1">
              {subtasks.slice(0, 3).map((st, i) => {
                const stCfg = STATUS_CONFIG[st.status] ?? STATUS_CONFIG["PENDING"];
                return (
                  <div key={st._id} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stCfg.dot}`} />
                    <span className="text-[10px] text-slate-600 dark:text-zinc-300 truncate flex-1">{st.docType}</span>
                    <span className={`text-[9px] font-semibold ${stCfg.color}`}>{stCfg.label}</span>
                  </div>
                );
              })}
              {subtasks.length > 3 && (
                <p className="text-[9px] text-slate-400 dark:text-zinc-500 pl-3.5">+{subtasks.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
          <Pencil size={9} className="text-indigo-400" />
          <p className="text-[9px] text-slate-400 dark:text-zinc-500">Click row to edit</p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUBTASK ROW  (unchanged from original, included for completeness)
   ══════════════════════════════════════════════════════════ */
const inputSmCls  = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all";
const selectSmCls = "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all";

interface SubtaskRowProps {
  subtask: Subtask;
  index: number;
  txId: string;
  docTypes: DocType[];
  parentCategory: TaskCategory;
  onUpdated: (updated: Transaction) => void;
  onDeleted: (updated: Transaction) => void;
}

function SubtaskRow({ subtask, index, txId, docTypes, parentCategory, onUpdated, onDeleted }: SubtaskRowProps) {
  const [editing,  setEditing]  = useState(false);
  const [stDocType, setStDocType] = useState(subtask.docType);
  const [stNumber,  setStNumber]  = useState(String(subtask.number ?? ""));
  const [stStatus,  setStStatus]  = useState(subtask.status);
  const [stNotes,   setStNotes]   = useState(subtask.notes ?? "");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const selectedDt      = docTypes.find(dt => dt.name === stDocType);
    const subtaskCategory = selectedDt?.taskCategory ?? parentCategory;
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: txId, subtaskAction: "UPDATE", subtaskId: subtask._id,
        subtask: { docType: stDocType, number: stNumber ? Number(stNumber) : undefined, notes: stNotes.trim() || undefined, status: stStatus, taskCategory: subtaskCategory },
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); onUpdated(d.transaction); setEditing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, subtaskAction: "DELETE", subtaskId: subtask._id }),
    });
    setDeleting(false);
    if (res.ok) { const d = await res.json(); onDeleted(d.transaction); }
  };

  if (editing) {
    return (
      <tr className="border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20">
        <td className="pl-10 pr-2 py-2 text-slate-400 text-xs">↳</td>
        <td className="px-2 py-2">
          <select value={stDocType} onChange={e => setStDocType(e.target.value)} className={selectSmCls}>
            {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
          </select>
        </td>
        <td className="px-2 py-2">
          <input type="number" min="1" value={stNumber} onChange={e => setStNumber(e.target.value)} placeholder="#" className={inputSmCls} />
        </td>
        <td className="px-2 py-2"><CategoryBadge category={subtask.taskCategory} /></td>
        <td className="px-2 py-2">
          <select value={stStatus} onChange={e => setStStatus(e.target.value as Subtask["status"])} className={selectSmCls}>
            <option value="COMPLETION">Completion</option>
            <option value="PENDING">Pending</option>
            <option value="ESCALATION">Escalation</option>
            <option value="HOLD">Hold</option>
          </select>
        </td>
        <td className="px-2 py-2">
          <input value={stNotes} onChange={e => setStNotes(e.target.value)} placeholder="Notes…" className={inputSmCls} />
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            <button onClick={handleSave} disabled={saving} className="px-2 py-1 rounded-md bg-indigo-600 text-white text-[10px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"><X size={12} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100/70 dark:border-zinc-800/50 bg-slate-50/30 dark:bg-zinc-900/20 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
      <td className="pl-10 pr-2 py-2 text-slate-300 dark:text-zinc-600 text-xs">↳ {index + 1}</td>
      <td className="px-4 py-2 text-slate-500 dark:text-zinc-400 text-xs">{subtask.docType}</td>
      <td className="px-4 py-2 text-slate-500 dark:text-zinc-400 text-xs font-mono">{subtask.number ?? "—"}</td>
      <td className="px-4 py-2"><CategoryBadge category={subtask.taskCategory} /></td>
      <td className="px-4 py-2"><StatusBadge status={subtask.status} /></td>
      <td className="px-4 py-2 text-slate-400 dark:text-zinc-500 text-xs max-w-[120px] truncate">{subtask.notes ?? "—"}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="text-slate-300 dark:text-zinc-600 hover:text-indigo-500 transition-colors"><Pencil size={12} /></button>
          <button onClick={handleDelete} disabled={deleting} className="text-slate-300 dark:text-zinc-600 hover:text-red-500 transition-colors disabled:opacity-50"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════
   ADD SUBTASK INLINE ROW  (unchanged)
   ══════════════════════════════════════════════════════════ */
interface AddSubtaskInlineRowProps {
  docTypes: DocType[];
  txId: string;
  parentCategory: TaskCategory;
  onAdded: (updated: Transaction) => void;
  onCancel: () => void;
}

function AddSubtaskInlineRow({ docTypes, txId, parentCategory, onAdded, onCancel }: AddSubtaskInlineRowProps) {
  const [stDocType, setStDocType] = useState(docTypes[0]?.name ?? "");
  const [stNumber,  setStNumber]  = useState("");
  const [stStatus,  setStStatus]  = useState<Subtask["status"]>("COMPLETION");
  const [stNotes,   setStNotes]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const handleSubmit = async () => {
    setErr("");
    if (!stDocType) { setErr("Select a task type"); return; }
    setSaving(true);
    const selectedDt      = docTypes.find(dt => dt.name === stDocType);
    const subtaskCategory = selectedDt?.taskCategory ?? parentCategory;
    const res = await fetch("/api/kpi/transactions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: txId, subtaskAction: "ADD",
        subtask: { docType: stDocType, number: stNumber ? Number(stNumber) : undefined, notes: stNotes.trim() || undefined, status: stStatus, taskCategory: subtaskCategory },
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); onAdded(d.transaction); }
    else setErr("Failed to add");
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-1 text-indigo-400 mb-0.5 w-full">
        <ListPlus size={11} /><span className="text-[10px] font-bold uppercase tracking-widest">New Subtask</span>
      </div>
      <div className="w-full flex flex-wrap gap-2">
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[9px] text-slate-400 mb-0.5">Task Type</label>
          <select value={stDocType} onChange={e => setStDocType(e.target.value)} className={selectSmCls}>
            <option value="">Select…</option>
            {docTypes.map(dt => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
          </select>
        </div>
        <div className="w-20">
          <label className="block text-[9px] text-slate-400 mb-0.5">Number</label>
          <input type="number" min="1" value={stNumber} onChange={e => setStNumber(e.target.value)} placeholder="e.g. 5" className={inputSmCls} />
        </div>
        <div className="w-28">
          <label className="block text-[9px] text-slate-400 mb-0.5">Status</label>
          <select value={stStatus} onChange={e => setStStatus(e.target.value as Subtask["status"])} className={selectSmCls}>
            <option value="COMPLETION">Completion</option>
            <option value="PENDING">Pending</option>
            <option value="ESCALATION">Escalation</option>
            <option value="HOLD">Hold</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[9px] text-slate-400 mb-0.5">Notes</label>
          <input value={stNotes} onChange={e => setStNotes(e.target.value)} placeholder="Optional…" className={inputSmCls} />
        </div>
      </div>
      {err && <p className="w-full text-[10px] text-red-500">{err}</p>}
      <div className="flex gap-2 ml-auto">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50">
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TX TABLE ROW  ← THE MAIN EXPORT
   ══════════════════════════════════════════════════════════ */
export interface TxTableRowProps {
  tx: Transaction;
  index: number;
  docTypeCount: number;
  subtaskDocTypeTotals: Record<string, number>;
  docTypes: DocType[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onTxUpdated: (updated: Transaction) => void;
  onResume: (tx: Transaction) => void;
}

export function TxTableRow({
  tx, index, docTypes, onEdit, onDelete, onTxUpdated, onResume,
}: TxTableRowProps) {
  const [expanded,        setExpanded]        = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [hovered,         setHovered]         = useState(false);

  /* ── Tooltip position ── */
  const rowRef      = useRef<HTMLTableRowElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!hovered || !rowRef.current) { setTipPos(null); return; }
    const rect = rowRef.current.getBoundingClientRect();
    // Try to show on the right; fall back to left if not enough room
    const tipW  = 288; // w-72
    const spaceRight = window.innerWidth - rect.right;
    const left = spaceRight >= tipW + 12
      ? rect.right + 8
      : rect.left - tipW - 8;
    const top  = Math.min(rect.top, window.innerHeight - 400);
    setTipPos({ top, left });
  }, [hovered]);

  const subtasks = tx.subtasks ?? [];

  /* Stop child button clicks from bubbling up to the row click handler */
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {/* ── Main row ── */}
      <tr
        ref={rowRef}
        onClick={() => onEdit(tx)}           /* ← click row → open edit */
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          border-b border-slate-100 dark:border-zinc-800
          cursor-pointer select-none
          transition-colors duration-100
          hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10
          ${tx.status === "HOLD" ? "bg-sky-50/30 dark:bg-sky-950/10" : ""}
          ${hovered ? "ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800" : ""}
        `}
      >
        {/* # + expand toggle */}
        <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs" onClick={stopBubble}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { stopBubble(e); setExpanded(v => !v); if (!expanded) setShowSubtaskForm(false); }}
              className={`transition-colors ${
                subtasks.length > 0
                  ? "text-indigo-400 hover:text-indigo-600"
                  : "text-slate-200 dark:text-zinc-700 hover:text-slate-400"
              }`}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <span>{index + 1}</span>
          </div>
        </td>

        {/* Task type */}
        <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">
          <span>{tx.docType}</span>
        </td>

        {/* Category */}
        <td className="px-4 py-3"><CategoryBadge category={tx.taskCategory} /></td>

        {/* Status */}
        <td className="px-4 py-3" onClick={stopBubble}>
          <div className="flex flex-col gap-1">
            <StatusBadge status={tx.status} />
            {tx.status === "HOLD" && (
              <button
                onClick={e => { stopBubble(e); onResume(tx); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
              >
                <Play size={9} /> Resume
              </button>
            )}
          </div>
        </td>

        {/* Notes */}
        <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs max-w-[160px] truncate" title={tx.notes}>
          {tx.notes ?? "—"}
        </td>

        {/* Actions — stop propagation so they don't trigger row edit */}
        <td className="px-4 py-3" onClick={stopBubble}>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { stopBubble(e); setExpanded(true); setShowSubtaskForm(true); }}
              className="text-slate-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              title="Add subtask"
            >
              <ListPlus size={13} />
            </button>
            <button
              onClick={e => { stopBubble(e); onEdit(tx); }}
              className="text-slate-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { stopBubble(e); onDelete(tx._id); }}
              className="text-slate-300 dark:text-zinc-600 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Subtask rows ── */}
      {expanded && (
        <>
          {subtasks.map((st, si) => (
            <SubtaskRow
              key={st._id}
              subtask={st}
              index={si}
              txId={tx._id}
              docTypes={docTypes}
              parentCategory={tx.taskCategory ?? "Production"}
              onUpdated={onTxUpdated}
              onDeleted={onTxUpdated}
            />
          ))}
          {showSubtaskForm ? (
            <tr className="border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10">
              <td colSpan={6} className="pl-10 pr-4 py-3">
                <div className="max-w-[580px]">
                  <AddSubtaskInlineRow
                    docTypes={docTypes}
                    txId={tx._id}
                    parentCategory={tx.taskCategory ?? "Production"}
                    onAdded={updated => { onTxUpdated(updated); setShowSubtaskForm(false); }}
                    onCancel={() => setShowSubtaskForm(false)}
                  />
                </div>
              </td>
            </tr>
          ) : (
            <tr className="border-b border-slate-100 dark:border-zinc-800/50">
              <td colSpan={6} className="pl-10 pr-4 py-2">
                <button
                  onClick={e => { stopBubble(e); setShowSubtaskForm(true); }}
                  className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-600 font-medium transition-colors"
                >
                  <Plus size={11} /> Add subtask
                </button>
              </td>
            </tr>
          )}
        </>
      )}

      {/* ── Floating hover preview card (portal-positioned) ── */}
      {hovered && tipPos && (
        <tr className="pointer-events-none">
          <td colSpan={6} className="p-0 border-0">
            <div
              className="fixed z-[80]"
              style={{ top: tipPos.top, left: tipPos.left }}
            >
              <TxPreviewCard tx={tx} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default TxTableRow;