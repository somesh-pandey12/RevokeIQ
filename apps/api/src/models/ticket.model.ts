import { Schema, model } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

export const TICKET_STATUSES = [
  "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED",
] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_CATEGORIES = [
  "DELIVERY", "REFUND", "RETURN", "PAYMENT", "PRODUCT", "TECHNICAL", "GENERAL",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const ticketSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    number: { type: Number, required: true }, // per-company sequence
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, enum: TICKET_CATEGORIES, default: "GENERAL" },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: TICKET_STATUSES, default: "OPEN" },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    firstResponseAt: { type: Date, default: null }, // analytics
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ tenantId: 1, number: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
ticketSchema.index({ tenantId: 1, assignedAgentId: 1, status: 1 });
ticketSchema.plugin(tenantGuard);

export const Ticket = model("Ticket", ticketSchema);