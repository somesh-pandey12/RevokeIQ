import { Schema, model } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

const invitationSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["AGENT"], default: "AGENT" },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "REVOKED"], default: "PENDING" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

invitationSchema.plugin(tenantGuard);

export const Invitation = model("Invitation", invitationSchema);