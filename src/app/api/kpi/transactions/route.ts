import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import DocType from "@/models/DocType";

/* ─────────────────────────────────────────────────────────────
   GET /api/kpi/transactions?date=YYYY-MM-DD&agentId=xxx
───────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date    = searchParams.get("date");
    const agentId = searchParams.get("agentId");

    await connectDB();

    const query: Record<string, string> = { ownerEmail: session.user.email };
    if (date)    query.date    = date;
    if (agentId) query.agentId = agentId;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[GET /api/kpi/transactions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/kpi/transactions — create a new transaction
───────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      agentId,
      agentName,
      docType,
      companyName,
      volume,
      date,
      status,
      notes,
      startEpoch,
      elapsedSeconds,
      taskCategory,
      subtasks,
      countType,
    } = body;

    if (!agentId || !agentName || !docType || !date || !companyName || !volume) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    // Resolve countType from the DocType record if not explicitly provided
    let resolvedCountType = countType;
    if (!resolvedCountType) {
      const docTypeRecord = await DocType.findOne({
        name:  docType,
        email: session.user.email,
      });
      resolvedCountType = docTypeRecord?.countType ?? "transaction";
    }

    const VALID_STATUSES = new Set(["PENDING", "COMPLETION", "ESCALATION", "HOLD"]);
    const resolvedStatus = VALID_STATUSES.has(status) ? status : "PENDING";

    const startTime = new Date(startEpoch ?? Date.now()).toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });

    // Normalize subtasks with countType resolution
    const normalizedSubtasks = await Promise.all(
      (subtasks ?? []).map(async (st: {
        docType:      string;
        number?:      number;
        notes?:       string;
        status?:      string;
        taskCategory?: string;
        countType?:   string;
      }) => {
        let subtaskCountType = st.countType;
        if (!subtaskCountType) {
          const dtRecord = await DocType.findOne({
            name:  st.docType,
            email: session.user.email,
          });
          subtaskCountType = dtRecord?.countType ?? "transaction";
        }
        return {
          docType:      st.docType,
          number:       st.number   ?? undefined,
          notes:        st.notes    || undefined,
          status:       VALID_STATUSES.has(st.status ?? "") ? st.status : "PENDING",
          taskCategory: st.taskCategory ?? "Production",
          countType:    subtaskCountType,
          createdAt:    Date.now(),
        };
      })
    );

    const tx = await Transaction.create({
      txId:           `TX${Date.now()}`,
      agentId,
      agentName,
      docType,
      companyName:    companyName.trim(),
      volume:         Number(volume),
      startTime,
      startEpoch:     startEpoch ?? Date.now(),
      date,
      status:         resolvedStatus,
      notes:          notes || undefined,
      ownerEmail:     session.user.email,
      elapsedSeconds: elapsedSeconds ?? 0,
      pausedAt:       null,
      taskCategory:   taskCategory ?? "Production",
      countType:      resolvedCountType,
      subtasks:       normalizedSubtasks,
    });

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/kpi/transactions]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────
   PATCH /api/kpi/transactions — update fields or subtasks
───────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      id,
      elapsedSeconds,
      pausedAt,
      tat,
      endEpoch,
      endTime,
      status,
      notes,
      docType,
      companyName,
      volume,
      startTime,
      taskCategory,
      subtaskAction,
      subtask,
      subtaskId,
    } = body;

    if (!id)
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

    await connectDB();

    const VALID_STATUSES = new Set(["PENDING", "COMPLETION", "ESCALATION", "HOLD"]);

    /* ── Subtask: ADD ── */
    if (subtaskAction === "ADD") {
      if (!subtask?.docType)
        return NextResponse.json({ error: "Missing subtask docType" }, { status: 400 });

      const dtRecord = await DocType.findOne({
        name:  subtask.docType,
        email: session.user.email,
      });
      const countType = dtRecord?.countType ?? "transaction";

      // Inherit parent category if not explicitly set
      const parent = await Transaction.findOne({
        _id:        id,
        ownerEmail: session.user.email,
      });
      const inheritedCategory = subtask.taskCategory ?? parent?.taskCategory ?? "Production";

      const tx = await Transaction.findOneAndUpdate(
        { _id: id, ownerEmail: session.user.email },
        {
          $push: {
            subtasks: {
              docType:      subtask.docType,
              number:       subtask.number   ?? undefined,
              notes:        subtask.notes    || undefined,
              status:       VALID_STATUSES.has(subtask.status) ? subtask.status : "PENDING",
              taskCategory: inheritedCategory,
              countType,
              createdAt:    Date.now(),
            },
          },
        },
        { new: true }
      );

      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: tx });
    }

    /* ── Subtask: UPDATE ── */
    if (subtaskAction === "UPDATE") {
      if (!subtaskId)
        return NextResponse.json({ error: "subtaskId required" }, { status: 400 });

      const updateFields: Record<string, unknown> = {};
      if (subtask?.docType)             updateFields["subtasks.$.docType"]      = subtask.docType;
      if (subtask?.number !== undefined) updateFields["subtasks.$.number"]       = subtask.number;
      if (subtask?.notes  !== undefined) updateFields["subtasks.$.notes"]        = subtask.notes;
      if (subtask?.status)              updateFields["subtasks.$.status"]        = subtask.status;
      if (subtask?.taskCategory)        updateFields["subtasks.$.taskCategory"]  = subtask.taskCategory;
      if (subtask?.countType)           updateFields["subtasks.$.countType"]     = subtask.countType;

      const tx = await Transaction.findOneAndUpdate(
        { _id: id, ownerEmail: session.user.email, "subtasks._id": subtaskId },
        { $set: updateFields },
        { new: true }
      );

      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: tx });
    }

    /* ── Subtask: DELETE ── */
    if (subtaskAction === "DELETE") {
      if (!subtaskId)
        return NextResponse.json({ error: "subtaskId required" }, { status: 400 });

      const tx = await Transaction.findOneAndUpdate(
        { _id: id, ownerEmail: session.user.email },
        { $pull: { subtasks: { _id: subtaskId } } },
        { new: true }
      );

      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: tx });
    }

    /* ── Standard field update ── */
    const updateData: Record<string, unknown> = {};
    if (elapsedSeconds !== undefined) updateData.elapsedSeconds = Number(elapsedSeconds);
    if (pausedAt       !== undefined) updateData.pausedAt       = pausedAt;
    if (tat            !== undefined) updateData.tat            = Number(tat);
    if (endEpoch       !== undefined) updateData.endEpoch       = endEpoch;
    if (endTime)                      updateData.endTime        = endTime;
    if (status && VALID_STATUSES.has(status)) updateData.status = status;
    if (notes          !== undefined) updateData.notes          = notes;
    if (docType)                      updateData.docType        = docType;
    if (companyName)                  updateData.companyName    = companyName;
    if (volume         !== undefined) updateData.volume         = Number(volume);
    if (startTime)                    updateData.startTime      = startTime;
    if (taskCategory)                 updateData.taskCategory   = taskCategory;

    const tx = await Transaction.findOneAndUpdate(
      { _id: id, ownerEmail: session.user.email },
      { $set: updateData },
      { new: true }
    );

    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ transaction: tx });
  } catch (err) {
    console.error("[PATCH /api/kpi/transactions]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────────────────────
   DELETE /api/kpi/transactions { id }
───────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, agentId, date, deleteAll } = body;

    await connectDB();

    // Bulk delete: all transactions for an agent on a date
    if (deleteAll && agentId && date) {
      const result = await Transaction.deleteMany({
        ownerEmail: session.user.email,
        agentId,
        date,
      });
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    }

    // Single delete (existing behavior)
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await Transaction.deleteOne({ _id: id, ownerEmail: session.user.email });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/kpi/transactions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}