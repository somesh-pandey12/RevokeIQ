import { Schema, model } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

const messageSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderType: { type: String, enum: ["CUSTOMER", "AGENT", "ADMIN"], required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    isInternal: { type: Boolean, default: false }, // true = private note
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ tenantId: 1, ticketId: 1, createdAt: 1 });
messageSchema.plugin(tenantGuard);

export const TicketMessage = model("TicketMessage", messageSchema);