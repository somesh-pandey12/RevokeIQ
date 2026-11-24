import { Schema, model, Types } from "mongoose";
import { tenantGuard } from "./plugins/tenantGuard";

export const ROLES = ["ADMIN", "AGENT", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

const memberSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
  },
  { timestamps: true }
);
memberSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
memberSchema.plugin(tenantGuard);

export type MemberDoc = {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
};
export const CompanyMember = model("CompanyMember", memberSchema);