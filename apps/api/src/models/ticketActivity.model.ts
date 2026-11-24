import { Schema, model } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

export const ACTIVITY_TYPES = [
  "CREATED", "STATUS_CHANGED", "PRIORITY_CHANGED", "CATEGORY_CHANGED",
  "ASSIGNED", "ESCALATED", "MESSAGE_ADDED", "NOTE_ADDED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const activitySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ tenantId: 1, ticketId: 1, createdAt: 1 });
activitySchema.plugin(tenantGuard);

export const TicketActivity = model("TicketActivity", activitySchema);