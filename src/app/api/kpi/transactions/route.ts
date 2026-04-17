import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Transaction from "@/models/Transaction";
import DocType from "@/models/DocType";

// GET /api/kpi/transactions?date=YYYY-MM-DD&agentId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date    = searchParams.get("date");
    const agentId = searchParams.get("agentId");

    await connectDB();

    const query: Record<string, string> = { ownerEmail: session.user.email };
    if (date)    query.date    = date;
    if (agentId) query.agentId = agentId;

    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[GET /api/kpi/transactions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/kpi/transactions — create a new transaction
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      agentId, agentName, docType, companyName, volume,
      date, status, notes,
      startEpoch,
      elapsedSeconds,
      taskCategory,
      subtasks,
      productiveSeconds,
      timerStartEpoch,
      countType,
    } = body;

    // Allow __PROD_TIMER__ sentinel to skip companyName check
    const isTimerRecord = docType === "__PROD_TIMER__";

    if (!agentId || !agentName || !docType || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isTimerRecord && (!companyName || !volume)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    // Look up countType from DocType if not provided
    let resolvedCountType = countType;
    if (!resolvedCountType && docType !== "__PROD_TIMER__") {
      const docTypeRecord = await DocType.findOne({ 
        name: docType, 
        email: session.user.email 
      });
      resolvedCountType = docTypeRecord?.countType ?? "transaction";
    }

    const txId = `TX${Date.now()}`;

    const startTime = new Date(startEpoch ?? Date.now()).toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });

    const VALID_STATUSES = ["PENDING", "COMPLETION", "ESCALATION", "HOLD"];
    const resolvedStatus = VALID_STATUSES.includes(status) ? status : "PENDING";

    // Normalize subtasks — ensure each has a valid status and taskCategory
    const normalizedSubtasks = await Promise.all((subtasks ?? []).map(async (st: {
      docType: string;
      number?: number;
      notes?: string;
      status?: string;
      taskCategory?: string;
      countType?: string;
    }) => {
      // Look up countType if not provided
      let subtaskCountType = st.countType;
      if (!subtaskCountType) {
        const docTypeRecord = await DocType.findOne({ 
          name: st.docType, 
          email: session.user.email 
        });
        subtaskCountType = docTypeRecord?.countType ?? "transaction";
      }
      
      return {
        docType:      st.docType,
        number:       st.number ?? undefined,
        notes:        st.notes  || undefined,
        status:       VALID_STATUSES.includes(st.status ?? "") ? st.status : "PENDING",
        taskCategory: st.taskCategory ?? "Production",
        countType:    subtaskCountType,
        createdAt:    Date.now(),
      };
    }));

    const tx = await Transaction.create({
      txId,
      agentId,
      agentName,
      docType,
      companyName:       companyName ?? "__timer__",
      volume:            Number(volume ?? 1),
      startTime,
      startEpoch:        startEpoch ?? Date.now(),
      date,
      status:            resolvedStatus,
      notes:             notes || undefined,
      ownerEmail:        session.user.email,
      elapsedSeconds:    elapsedSeconds ?? 0,
      pausedAt:          null,
      taskCategory:      taskCategory ?? "Production",
      countType:         resolvedCountType,
      subtasks:          normalizedSubtasks,
      productiveSeconds: productiveSeconds ?? 0,
      timerStartEpoch:   timerStartEpoch ?? null,
      timerPaused:       false,
    });

    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/kpi/transactions]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/kpi/transactions — update fields, subtasks, or productive seconds
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      productiveSeconds,
      subtaskAction,
      subtask,
      subtaskId,
    } = body;

    if (!id) return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

    await connectDB();

    const VALID_STATUSES = ["PENDING", "COMPLETION", "ESCALATION", "HOLD"];

    /* ── Subtask mutations ── */
    if (subtaskAction === "ADD") {
      if (!subtask?.docType) {
        return NextResponse.json({ error: "Missing subtask docType" }, { status: 400 });
      }
      
      // Look up countType for this subtask
      const docTypeRecord = await DocType.findOne({ 
        name: subtask.docType, 
        email: session.user.email 
      });
      const countType = docTypeRecord?.countType ?? "transaction";
      
      const tx = await Transaction.findOneAndUpdate(
        { _id: id, ownerEmail: session.user.email },
        {
          $push: {
            subtasks: {
              docType:      subtask.docType,
              number:       subtask.number ?? undefined,
              notes:        subtask.notes || undefined,
              status:       VALID_STATUSES.includes(subtask.status) ? subtask.status : "PENDING",
              taskCategory: subtask.taskCategory ?? "Production",
              countType:    countType,
              createdAt:    Date.now(),
            },
          },
        },
        { new: true }
      );
      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: tx });
    }

    if (subtaskAction === "UPDATE") {
      if (!subtaskId) return NextResponse.json({ error: "subtaskId required" }, { status: 400 });
      const updateFields: Record<string, unknown> = {};
      if (subtask?.docType)              updateFields["subtasks.$.docType"]      = subtask.docType;
      if (subtask?.number !== undefined)  updateFields["subtasks.$.number"]      = subtask.number;
      if (subtask?.notes  !== undefined)  updateFields["subtasks.$.notes"]       = subtask.notes;
      if (subtask?.status)                updateFields["subtasks.$.status"]      = subtask.status;
      if (subtask?.taskCategory)          updateFields["subtasks.$.taskCategory"] = subtask.taskCategory;
      if (subtask?.countType)             updateFields["subtasks.$.countType"]    = subtask.countType;

      const tx = await Transaction.findOneAndUpdate(
        { _id: id, ownerEmail: session.user.email, "subtasks._id": subtaskId },
        { $set: updateFields },
        { new: true }
      );
      if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: tx });
    }

    if (subtaskAction === "DELETE") {
      if (!subtaskId) return NextResponse.json({ error: "subtaskId required" }, { status: 400 });
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
    if (elapsedSeconds    !== undefined) updateData.elapsedSeconds    = Number(elapsedSeconds);
    if (pausedAt          !== undefined) updateData.pausedAt          = pausedAt;
    if (tat               !== undefined) updateData.tat               = Number(tat);
    if (endEpoch          !== undefined) updateData.endEpoch          = endEpoch;
    if (endTime)                         updateData.endTime           = endTime;
    if (status)                          updateData.status            = status;
    if (notes             !== undefined) updateData.notes             = notes;
    if (docType)                         updateData.docType           = docType;
    if (companyName)                     updateData.companyName       = companyName;
    if (volume            !== undefined) updateData.volume            = Number(volume);
    if (startTime)                       updateData.startTime         = startTime;
    if (taskCategory)                    updateData.taskCategory      = taskCategory;
    if (productiveSeconds !== undefined) updateData.productiveSeconds = Number(productiveSeconds);
    if ("timerStartEpoch" in body)       updateData.timerStartEpoch   = body.timerStartEpoch ?? null;
    if ("timerPaused"     in body)       updateData.timerPaused       = body.timerPaused ?? false;

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

// DELETE /api/kpi/transactions { id }
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await connectDB();
    await Transaction.deleteOne({ _id: id, ownerEmail: session.user.email });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/kpi/transactions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}