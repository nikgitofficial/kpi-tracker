import mongoose, { Schema, Document, model, models } from "mongoose";

export type TaskCategory = "Production" | "Non-Production";

export interface IDocType extends Document {
  name: string;
  email: string; // owner
  taskCategory: TaskCategory;
  createdAt: Date;
  updatedAt: Date;
}

const DocTypeSchema = new Schema<IDocType>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, lowercase: true, trim: true },
    taskCategory: { type: String, enum: ["Production", "Non-Production"], default: "Production" },
  },
  { timestamps: true }
);

DocTypeSchema.index({ email: 1 });

export default models.DocType || model<IDocType>("DocType", DocTypeSchema);