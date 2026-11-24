import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { Invitation } from "../models/invitation.model";
import { CompanyMember, Role } from "../models/companyMember.model";
import { Company } from "../models/company.model";
import { User } from "../models/user.model";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/token";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createInvitation(tenantId: string, invitedBy: string, rawEmail: string) {
  const email = rawEmail.toLowerCase();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const already = await CompanyMember.findOne({ tenantId, userId: existingUser._id });
    if (already) throw new AppError(409, "User is already a member of this company", "ALREADY_MEMBER");
  }

  await Invitation.updateMany({ tenantId, email, status: "PENDING" }, { status: "REVOKED" });

  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await Invitation.create({
    tenantId,
    email,
    role: "AGENT",
    tokenHash: hashToken(token),
    invitedBy,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    },

    inviteLink: `${env.WEB_URL}/accept-invite?token=${token}`,
  };
}

export async function listInvitations(tenantId: string) {
  const items = await Invitation.find({
    tenantId,
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  return items.map((i) => ({
    id: i._id.toString(),
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt,
  }));
}

export async function revokeInvitation(tenantId: string, id: string) {
  const revoked = await Invitation.findOneAndUpdate(
    { _id: id, tenantId, status: "PENDING" },
    { status: "REVOKED" }
  );
  if (!revoked) throw new AppError(404, "Invitation not found", "NOT_FOUND");
}

export async function acceptInvitation(input: { token: string; name?: string; password: string }) {
  const invitation = await Invitation.findOne({
    tokenHash: hashToken(input.token),
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  }).setOptions({ skipTenantGuard: true });
  if (!invitation) throw new AppError(400, "Invitation is invalid or expired", "INVALID_INVITATION");

  const existing = await User.findOne({ email: invitation.email }).select("+passwordHash");
  if (existing && !(await bcrypt.compare(input.password, existing.passwordHash))) {
    throw new AppError(401, "Invalid password for existing account", "INVALID_CREDENTIALS");
  }
  if (!existing && !input.name) {
    throw new AppError(400, "Name is required for new accounts", "NAME_REQUIRED");
  }
  const user =
    existing ??
    (await User.create({
      name: input.name,
      email: invitation.email,
      passwordHash: await bcrypt.hash(input.password, 12),
    }));

  const already = await CompanyMember.findOne({
    tenantId: invitation.tenantId,
    userId: user._id,
  });
  if (already) throw new AppError(409, "Already a member of this company", "ALREADY_MEMBER");

  const claimed = await Invitation.findOneAndUpdate(
    { _id: invitation._id, tenantId: invitation.tenantId, status: "PENDING" },
    { status: "ACCEPTED", acceptedAt: new Date() }
  );
  if (!claimed) throw new AppError(400, "Invitation is invalid or expired", "INVALID_INVITATION");

  const member = await CompanyMember.create({
    tenantId: invitation.tenantId,
    userId: user._id,
    role: invitation.role,
  });
  const company = await Company.findById(invitation.tenantId);
  if (!company) throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");

  const token = signToken({
    userId: user.id,
    tenantId: company.id,
    memberId: member.id,
    role: member.role as Role,
  });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email },
    company: { id: company.id, name: company.name, slug: company.slug },
    role: member.role as Role,
  };
}