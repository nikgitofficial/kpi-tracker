"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Tag,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronRight,
  Layers,
  Hash,
  BarChart2,
  UserCircle2,
  UserCog,
  Briefcase,
  Info,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { SnackbarProvider, useSnackbar } from "@/contexts/SnackbarContext";

/* ─── Types ─── */
interface Agent {
  _id: string;
  name: string;
  group?: string;
}

type TaskCategory = "Production" | "Non-Production";
type CountType = "transaction" | "volume";

interface DocType {
  _id: string;
  name: string;
  taskCategory: TaskCategory;
  countType: CountType;
}

/* ─── Shared input styles (matching TX Log) ─── */
const inputCls =
  "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";
const selectCls =
  "w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";

/* ─── Badge components ─── */
function CategoryBadge({ category }: { category?: TaskCategory }) {
  const isProd = !category || category === "Production";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
        isProd
          ? "bg-indigo-50 border-indigo-200 text-indigo-600"
          : "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-slate-500 dark:text-zinc-400"
      }`}
    >
      {isProd ? "⚙" : "✉"} {isProd ? "Production" : "Non-Prod"}
    </span>
  );
}

function CountTypeBadge({ countType }: { countType?: CountType }) {
  const isVol = countType === "volume";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
        isVol
          ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
          : "bg-indigo-50 border border-indigo-200 text-indigo-500"
      }`}
    >
      {isVol ? "VOL" : "TX"}
    </span>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} border rounded-2xl p-4 flex items-center gap-3`}>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}
      >
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}

/* ─── Toggle Pill ─── */
function TogglePill({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string; activeClass: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold flex-shrink-0 bg-slate-50 dark:bg-zinc-800">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 transition-colors ${
            value === opt.value
              ? opt.activeClass
              : "text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700"
          } ${i < options.length - 1 ? "border-r border-slate-200 dark:border-zinc-700" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Agents Panel
   ═══════════════════════════════════════════════════════ */
function AgentsPanel({
  agents,
  setAgents,
}: {
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
}) {
  const { showSnackbar } = useSnackbar();
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState("ALL");

  const groups = ["ALL", ...Array.from(new Set(agents.map((a) => a.group ?? "").filter(Boolean)))];

  const filtered =
    filterGroup === "ALL"
      ? agents
      : agents.filter((a) => (a.group ?? "") === filterGroup);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/kpi/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), group: newGroup.trim() || undefined }),
    });
    setAdding(false);
    if (res.ok) {
      const d = await res.json();
      setAgents((prev) => [...prev, d.agent]);
      setNewName("");
      setNewGroup("");
      showSnackbar("success", "Agent added", `${newName.trim()} has been added to the team`);
    } else {
      showSnackbar("error", "Failed to add agent", "Please try again");
    }
  };

  const openEdit = (a: Agent) => {
    setEditingId(a._id);
    setEditName(a.name);
    setEditGroup(a.group ?? "");
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim()) return;
    setEditSaving(true);
    const res = await fetch("/api/kpi/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, name: editName.trim(), group: editGroup.trim() || undefined }),
    });
    setEditSaving(false);
    if (res.ok) {
      const d = await res.json();
      setAgents((prev) => prev.map((a) => (a._id === editingId ? d.agent : a)));
      setEditingId(null);
      showSnackbar("success", "Agent updated", `Changes saved for ${editName.trim()}`);
    } else {
      showSnackbar("error", "Failed to update", "Could not save changes");
    }
  };

  const handleDelete = async (id: string) => {
    const agent = agents.find((a) => a._id === id);
    const res = await fetch("/api/kpi/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAgents((prev) => prev.filter((a) => a._id !== id));
      setDeletingId(null);
      showSnackbar("warning", "Agent removed", `${agent?.name} has been removed`);
    } else {
      showSnackbar("error", "Failed to delete", "Could not remove the agent");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={UserCircle2}
          label="Total Agents"
          value={agents.length}
          color="text-indigo-600"
          bg="bg-indigo-50 border-indigo-200"
        />
        <StatCard
          icon={Briefcase}
          label="Groups"
          value={groups.length - 1}
          color="text-violet-600"
          bg="bg-violet-50 border-violet-200"
        />
      </div>

      {/* Add agent form */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
            <Plus size={12} className="text-indigo-500" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
            Add New Agent
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Full name…"
            className={inputCls}
          />
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Group (optional)…"
            className="w-44 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
            Filter:
          </span>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                filterGroup === g
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700"
              }`}
            >
              {g === "ALL" ? "All" : g}
            </button>
          ))}
        </div>
      )}

      {/* Agents list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-center">
            <UserCog size={28} className="text-slate-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm text-slate-400 dark:text-zinc-500 font-medium">No agents yet</p>
            <p className="text-xs text-slate-300 dark:text-zinc-600 mt-0.5">
              Add your first agent using the form above
            </p>
          </div>
        )}
        {filtered.map((a) => (
          <div
            key={a._id}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden"
          >
            {editingId === a._id ? (
              /* Edit row */
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/20 border-b-0">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditSave();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 min-w-[140px] bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />
                <input
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditSave();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  placeholder="Group…"
                  className="w-36 bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Check size={11} />
                  {editSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              /* Display row */
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {a.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">
                    {a.name}
                  </p>
                  {a.group ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-500 text-[10px] font-semibold mt-0.5">
                      {a.group}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-zinc-600 mt-0.5">
                      No group
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(a)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title="Edit agent"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeletingId(a._id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Delete agent"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[340px] shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Trash2 size={15} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Remove Agent?
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Task Types Panel
   ═══════════════════════════════════════════════════════ */
function TaskTypesPanel({
  docTypes,
  setDocTypes,
}: {
  docTypes: DocType[];
  setDocTypes: React.Dispatch<React.SetStateAction<DocType[]>>;
}) {
  const { showSnackbar } = useSnackbar();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("Production");
  const [newCountType, setNewCountType] = useState<CountType>("transaction");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<TaskCategory>("Production");
  const [editCountType, setEditCountType] = useState<CountType>("transaction");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<TaskCategory | "ALL">("ALL");
  const [filterCount, setFilterCount] = useState<CountType | "ALL">("ALL");

  const filtered = docTypes.filter((dt) => {
    const catOk = filterCat === "ALL" || dt.taskCategory === filterCat;
    const countOk = filterCount === "ALL" || (dt.countType ?? "transaction") === filterCount;
    return catOk && countOk;
  });

  const prodCount = docTypes.filter((dt) => dt.taskCategory === "Production").length;
  const nonProdCount = docTypes.filter((dt) => dt.taskCategory === "Non-Production").length;
  const volCount = docTypes.filter((dt) => dt.countType === "volume").length;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/kpi/doc-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        taskCategory: newCategory,
        countType: newCountType,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const d = await res.json();
      setDocTypes((prev) => [...prev, d.docType]);
      setNewName("");
      showSnackbar("success", "Task type added", `${newName.trim()} is now available`);
    } else {
      showSnackbar("error", "Failed to add task type", "Please try again");
    }
  };

  const openEdit = (dt: DocType) => {
    setEditingId(dt._id);
    setEditName(dt.name);
    setEditCategory(dt.taskCategory ?? "Production");
    setEditCountType(dt.countType ?? "transaction");
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim()) return;
    setEditSaving(true);
    const res = await fetch("/api/kpi/doc-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: editName.trim(),
        taskCategory: editCategory,
        countType: editCountType,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      const d = await res.json();
      setDocTypes((prev) => prev.map((dt) => (dt._id === editingId ? d.docType : dt)));
      setEditingId(null);
      showSnackbar("success", "Task type updated", `Updated to "${editName.trim()}"`);
    } else {
      showSnackbar("error", "Failed to update", "Could not save changes");
    }
  };

  const handleDelete = async (id: string) => {
    const dt = docTypes.find((d) => d._id === id);
    const res = await fetch("/api/kpi/doc-types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setDocTypes((prev) => prev.filter((d) => d._id !== id));
      setDeletingId(null);
      showSnackbar("warning", "Task type removed", `${dt?.name} has been deleted`);
    } else {
      showSnackbar("error", "Failed to delete", "Could not remove the task type");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Layers}
          label="Total Types"
          value={docTypes.length}
          color="text-indigo-600"
          bg="bg-indigo-50 border-indigo-200"
        />
        <StatCard
          icon={BarChart2}
          label="Production"
          value={prodCount}
          color="text-violet-600"
          bg="bg-violet-50 border-violet-200"
        />
        <StatCard
          icon={Hash}
          label="Volume Types"
          value={volCount}
          color="text-emerald-600"
          bg="bg-emerald-50 border-emerald-200"
        />
      </div>

      {/* Add form */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
            <Plus size={12} className="text-indigo-500" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
            Add New Task Type
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Task type name…"
            className={`${inputCls} flex-1 min-w-[160px]`}
          />
          <TogglePill
            value={newCategory}
            onChange={(v) => setNewCategory(v as TaskCategory)}
            options={[
              {
                label: "⚙ Prod",
                value: "Production",
                activeClass: "bg-indigo-50 text-indigo-600",
              },
              {
                label: "✉ Non-Prod",
                value: "Non-Production",
                activeClass: "bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300",
              },
            ]}
          />
          <TogglePill
            value={newCountType}
            onChange={(v) => setNewCountType(v as CountType)}
            options={[
              {
                label: "# TX",
                value: "transaction",
                activeClass: "bg-indigo-50 text-indigo-600",
              },
              {
                label: "Vol",
                value: "volume",
                activeClass: "bg-emerald-50 text-emerald-600",
              },
            ]}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>

        {/* Hint */}
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
          <Info size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
            <span className="font-semibold">TX</span> counts each transaction as 1.{" "}
            <span className="font-semibold">Vol</span> uses the volume/employee count as the number.
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
          Filter:
        </span>
        {(["ALL", "Production", "Non-Production"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              filterCat === c
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-indigo-300"
            }`}
          >
            {c === "ALL" ? "All Categories" : c}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
        {(["ALL", "transaction", "volume"] as const).map((ct) => (
          <button
            key={ct}
            onClick={() => setFilterCount(ct)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              filterCount === ct
                ? ct === "volume"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-indigo-300"
            }`}
          >
            {ct === "ALL" ? "All Count Types" : ct === "transaction" ? "# TX" : "Volume"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-center">
            <Tag size={28} className="text-slate-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm text-slate-400 dark:text-zinc-500 font-medium">No task types</p>
            <p className="text-xs text-slate-300 dark:text-zinc-600 mt-0.5">
              Add your first task type using the form above
            </p>
          </div>
        )}

        {filtered.map((dt) => (
          <div
            key={dt._id}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden"
          >
            {editingId === dt._id ? (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/20">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditSave();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 min-w-[140px] bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />
                <TogglePill
                  value={editCategory}
                  onChange={(v) => setEditCategory(v as TaskCategory)}
                  options={[
                    {
                      label: "⚙ Prod",
                      value: "Production",
                      activeClass: "bg-indigo-100 text-indigo-600",
                    },
                    {
                      label: "✉ Non",
                      value: "Non-Production",
                      activeClass: "bg-slate-100 dark:bg-zinc-700 text-slate-600",
                    },
                  ]}
                />
                <TogglePill
                  value={editCountType}
                  onChange={(v) => setEditCountType(v as CountType)}
                  options={[
                    {
                      label: "# TX",
                      value: "transaction",
                      activeClass: "bg-indigo-100 text-indigo-600",
                    },
                    {
                      label: "Vol",
                      value: "volume",
                      activeClass: "bg-emerald-50 text-emerald-600",
                    },
                  ]}
                />
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Check size={11} />
                  {editSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    dt.taskCategory === "Production"
                      ? "bg-indigo-50 border border-indigo-200"
                      : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  <span className="text-base">
                    {dt.taskCategory === "Production" ? "⚙" : "✉"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">
                    {dt.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CategoryBadge category={dt.taskCategory} />
                    <CountTypeBadge countType={dt.countType ?? "transaction"} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(dt)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title="Edit task type"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeletingId(dt._id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Delete task type"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 w-[340px] shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Trash2 size={15} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Delete Task Type?
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ─── Main Page
   ═══════════════════════════════════════════════════════ */
type Tab = "agents" | "task-types";

function ManageSetupContent() {
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/kpi/agents").then((r) => r.json()),
      fetch("/api/kpi/doc-types").then((r) => r.json()),
    ])
      .then(([agentData, docTypeData]) => {
        setAgents(agentData.agents ?? []);
        setDocTypes(docTypeData.docTypes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "agents", label: "Agents", icon: Users, count: agents.length },
    { id: "task-types", label: "Task Types", icon: Tag, count: docTypes.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Page header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            {/* Breadcrumb */}
            <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <span>TX Log</span>
              <ChevronRight size={12} />
              <span className="text-slate-600 dark:text-zinc-300 font-medium">Manage Setup</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                Manage Setup
              </h1>
              <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5">
                Configure agents and task types used across TX Log
              </p>
            </div>
            <a
              href="/dashboard/tx-log"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition-colors"
            >
              <ChevronRight size={14} className="rotate-180" />
              Back to TX Log
            </a>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">Loading setup…</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "agents" && (
              <AgentsPanel agents={agents} setAgents={setAgents} />
            )}
            {activeTab === "task-types" && (
              <TaskTypesPanel docTypes={docTypes} setDocTypes={setDocTypes} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ManageSetupPage() {
  return (
    <SnackbarProvider>
      <ManageSetupContent />
    </SnackbarProvider>
  );
}