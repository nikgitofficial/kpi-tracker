import mongoose, { Schema, Document, model, models } from "mongoose";

/**
 * ProductivityTimer
 * -----------------
 * One document per (ownerEmail, agentId, date) triple.
 * Separated from Transaction so that a timer lookup never
 * competes with potentially thousands of TX documents.
 *
 * Indexes:
 *   • { ownerEmail, agentId, date } — unique, primary lookup
 *   • { ownerEmail, date }          — list all agents for a date
 */

export interface IProductivityTimer extends Document {
  /** Owning user's email (from NextAuth session) */
  ownerEmail: string;
  /** References Agent._id (string) */
  agentId: string;
  /** Display name — denormalized for quick reads */
  agentName: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /**
   * Accumulated productive seconds already persisted.
   * When the timer is running, the true elapsed seconds =
   *   productiveSeconds + floor((now - timerStartEpoch) / 1000)
   */
  productiveSeconds: number;
  /**
   * Epoch ms when the timer was last started / resumed.
   * null  → timer is paused or has never been started.
   */
  timerStartEpoch: number | null;
  /** true while the timer is in a user-initiated pause */
  timerPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductivityTimerSchema = new Schema<IProductivityTimer>(
  {
    ownerEmail:        { type: String, required: true, lowercase: true, trim: true },
    agentId:           { type: String, required: true },
    agentName:         { type: String, required: true, trim: true },
    date:              { type: String, required: true },      // "YYYY-MM-DD"
    productiveSeconds: { type: Number, default: 0, min: 0 },
    timerStartEpoch:   { type: Number, default: null },
    timerPaused:       { type: Boolean, default: false },
  },
  {
    timestamps: true,   // createdAt, updatedAt
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────── */

// Primary lookup + uniqueness guarantee
ProductivityTimerSchema.index(
  { ownerEmail: 1, agentId: 1, date: 1 },
  { unique: true, name: "owner_agent_date_unique" }
);

// Secondary: list timers for a given owner + date
ProductivityTimerSchema.index(
  { ownerEmail: 1, date: 1 },
  { name: "owner_date" }
);

/* ── Singleton guard (Next.js hot-reload safe) ───────── */
export default models.ProductivityTimer
  ? (models.ProductivityTimer as mongoose.Model<IProductivityTimer>)
  : model<IProductivityTimer>("ProductivityTimer", ProductivityTimerSchema);