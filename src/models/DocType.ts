import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IDocType extends Document {
  name: string;
  email: string; // owner
  createdAt: Date;
  updatedAt: Date;
}

const DocTypeSchema = new Schema<IDocType>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

DocTypeSchema.index({ email: 1 });

export default models.DocType || model<IDocType>("DocType", DocTypeSchema);