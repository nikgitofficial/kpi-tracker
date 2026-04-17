import mongoose, { Schema, Document, model, models } from "mongoose";

export type TxStatus = "PENDING" | "COMPLETION" | "ESCALATION" | "HOLD";
export type TaskCategory = "Production" | "Non-Production";
export type CountType = "transaction" | "volume";

/* ─── Subtask ─── */
export interface ISubtask {
  _id: string;
  docType: string;
  number?: number;
  notes?: string;
  status: TxStatus;
  taskCategory: TaskCategory;
  countType: CountType;
  createdAt: number;
}

const SubtaskSchema = new Schema<ISubtask>(
  {
    docType:      { type: String, required: true },
    number:       { type: Number, min: 1 },
    notes:        { type: String },
    status:       { type: String, enum: ["PENDING", "COMPLETION", "ESCALATION", "HOLD"], default: "PENDING" },
    taskCategory: { type: String, enum: ["Production", "Non-Production"], default: "Production" },
    countType:    { type: String, enum: ["transaction", "volume"], default: "transaction" },
    createdAt:    { type: Number, default: () => Date.now() },
  },
  { _id: true }
);

export interface ITransaction extends Document {
  txId: string;
  agentId: string;
  agentName: string;
  docType: string;
  companyName: string;
  volume: number;
  startTime: string;
  startEpoch?: number;
  endTime?: string;
  endEpoch?: number;
  tat?: number;
  status: TxStatus;
  notes?: string;
  date: string;
  ownerEmail: string;
  elapsedSeconds?: number;
  pausedAt?: number | null;
  taskCategory?: TaskCategory;
  subtasks: ISubtask[];
  /** Productivity timer seconds persisted here (replaces localStorage) */
  productiveSeconds?: number;
  timerStartEpoch?: number | null;
  timerPaused?: boolean;
  countType?: CountType;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    txId:             { type: String, required: true },
    agentId:          { type: String, required: true },
    agentName:        { type: String, required: true },
    docType:          { type: String, required: true },
    companyName:      { type: String, required: true },
    volume:           { type: Number, required: true, min: 1 },
    startTime:        { type: String, required: true },
    startEpoch:       { type: Number },
    endTime:          { type: String },
    endEpoch:         { type: Number },
    tat:              { type: Number },
    status:           { type: String, enum: ["PENDING", "COMPLETION", "ESCALATION", "HOLD"], default: "PENDING" },
    notes:            { type: String },
    date:             { type: String, required: true },
    ownerEmail:       { type: String, required: true, lowercase: true },
    elapsedSeconds:   { type: Number, default: 0 },
    pausedAt:         { type: Number, default: null },
    taskCategory:     { type: String, enum: ["Production", "Non-Production"], default: "Production" },
    subtasks:         { type: [SubtaskSchema], default: [] },
    productiveSeconds:{ type: Number, default: 0 },
    timerStartEpoch:  { type: Number, default: null },
    timerPaused:      { type: Boolean, default: false },
    countType:        { type: String, enum: ["transaction", "volume"], default: "transaction" },
  },
  { timestamps: true }
);

TransactionSchema.index({ ownerEmail: 1, date: 1 });
TransactionSchema.index({ agentId: 1, date: 1 });

if (models.Transaction) {
  delete (mongoose.connection.models as Record<string, unknown>)["Transaction"];
}

export default model<ITransaction>("Transaction", TransactionSchema);