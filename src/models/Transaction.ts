import mongoose, { Schema, Document, model, models } from "mongoose";

export type TxStatus = "PENDING" | "COMPLETION" | "ESCALATION";
export type TaskCategory = "Production" | "Non-Production";

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
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    txId:           { type: String, required: true },
    agentId:        { type: String, required: true },
    agentName:      { type: String, required: true },
    docType:        { type: String, required: true },
    companyName:    { type: String, required: true },
    volume:         { type: Number, required: true, min: 1 },
    startTime:      { type: String, required: true },
    startEpoch:     { type: Number },
    endTime:        { type: String },
    endEpoch:       { type: Number },
    tat:            { type: Number },
    status:         { type: String, enum: ["PENDING", "COMPLETION", "ESCALATION"], default: "PENDING" },
    notes:          { type: String },
    date:           { type: String, required: true },
    ownerEmail:     { type: String, required: true, lowercase: true },
    elapsedSeconds: { type: Number, default: 0 },
    pausedAt:       { type: Number, default: null },
    taskCategory:   { type: String, enum: ["Production", "Non-Production"], default: "Production" },
  },
  { timestamps: true }
);

TransactionSchema.index({ ownerEmail: 1, date: 1 });
TransactionSchema.index({ agentId: 1, date: 1 });

export default models.Transaction || model<ITransaction>("Transaction", TransactionSchema);