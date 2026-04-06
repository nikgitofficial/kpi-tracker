// models/Agent.ts
import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IAgent extends Document {
  name: string;
  email: string;
  group?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    group: { type: String, trim: true },
  },
  { timestamps: true }
);

AgentSchema.index({ email: 1 });

export default models.Agent || model<IAgent>("Agent", AgentSchema);