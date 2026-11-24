import { CompanyMember, Role } from "../models/companyMember.model";
import { User } from "../models/user.model";
import { AppError } from "../utils/AppError";

export async function listMembers(tenantId: string, role?: Role) {
  const filter: Record<string, unknown> = { tenantId };
  if (role) filter.role = role;

  const members = await CompanyMember.find(filter).sort({ createdAt: -1 }).lean();
  const users = await User.find({ _id: { $in: members.map((m) => m.userId) } })
    .select("name email")
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return members.map((m) => {
    const u = byId.get(m.userId.toString());
    return {
      id: m._id.toString(),
      role: m.role,
      status: m.status,
      user: { id: m.userId.toString(), name: u?.name, email: u?.email },
    };
  });
}

export async function updateMemberStatus(
  tenantId: string,
  actingMemberId: string,
  targetId: string,
  status: "ACTIVE" | "SUSPENDED"
) {
  const target = await CompanyMember.findOne({ _id: targetId, tenantId });
  if (!target) throw new AppError(404, "Member not found", "NOT_FOUND");
  if (target.id === actingMemberId) {
    throw new AppError(400, "You cannot change your own status", "INVALID_OPERATION");
  }
  if (target.role === "ADMIN") {
    throw new AppError(403, "Admin members cannot be suspended here", "FORBIDDEN");
  }
  await CompanyMember.updateOne({ _id: target._id, tenantId }, { status });
  return { id: target.id, status };
}