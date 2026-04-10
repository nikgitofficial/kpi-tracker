import mongoose, { Schema, Document, model, models } from "mongoose";

export type BreakType = "BIO" | "BREAK";

export interface IBreak {
  _id: string;
  type: BreakType;
  startEpoch: number;
  endEpoch?: number;
  durationSeconds?: number;
}

export interface IAgentSession extends Document {
  agentId: string;
  agentName: string;
  date: string;
  ownerEmail: string;
  sessionStartEpoch: number;
  sessionEndEpoch?: number;
  breaks: IBreak[];
  totalBreakSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const BreakSchema = new Schema<IBreak>(
  {
    type:            { type: String, enum: ["BIO", "BREAK"], required: true },
    startEpoch:      { type: Number, required: true },
    endEpoch:        { type: Number },
    durationSeconds: { type: Number },
  },
  { _id: true }
);

const AgentSessionSchema = new Schema<IAgentSession>(
  {
    agentId:           { type: String, required: true },
    agentName:         { type: String, required: true },
    date:              { type: String, required: true },
    ownerEmail:        { type: String, required: true, lowercase: true },
    sessionStartEpoch: { type: Number, required: true },
    sessionEndEpoch:   { type: Number },
    breaks:            { type: [BreakSchema], default: [] },
    totalBreakSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AgentSessionSchema.index({ ownerEmail: 1, agentId: 1, date: 1 }, { unique: true });

export default models.AgentSession ||
  model<IAgentSession>("AgentSession", AgentSessionSchema);