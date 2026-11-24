import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { Company } from "../models/company.model";
import { CompanyMember, Role } from "../models/companyMember.model";
import { AppError } from "../utils/AppError";
import { makeSlug } from "../utils/slug";
import { signToken } from "../utils/token";

async function createUser(name: string, email: string, password: string) {
  const exists = await User.findOne({ email });
  if (exists) throw new AppError(409, "Email already registered", "EMAIL_TAKEN");
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email, passwordHash });
}

function issueSession(userId: string, tenantId: string, memberId: string, role: Role) {
  return signToken({ userId, tenantId, memberId, role });
}

export async function registerCompany(input: {
  name: string;
  email: string;
  password: string;
  companyName: string;
}) {
  const user = await createUser(input.name, input.email, input.password);
  const company = await Company.create({
    name: input.companyName,
    slug: makeSlug(input.companyName),
  });
  const member = await CompanyMember.create({
    tenantId: company._id,
    userId: user._id,
    role: "ADMIN", 
  });
  const token = issueSession(user.id, company.id, member.id, "ADMIN");
  return { token, user: { id: user.id, name: user.name, email: user.email }, company: { id: company.id, name: company.name, slug: company.slug }, role: "ADMIN" as Role };
}

export async function registerCustomer(input: {
  name: string;
  email: string;
  password: string;
  companySlug: string;
}) {
  const company = await Company.findOne({ slug: input.companySlug.toLowerCase() });
  if (!company) throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
  const user = await createUser(input.name, input.email, input.password);
  const member = await CompanyMember.create({
    tenantId: company._id,
    userId: user._id,
    role: "CUSTOMER", 
  });
  const token = issueSession(user.id, company.id, member.id, "CUSTOMER");
  return { token, user: { id: user.id, name: user.name, email: user.email }, company: { id: company.id, name: company.name, slug: company.slug }, role: "CUSTOMER" as Role };
}

export async function login(input: { email: string; password: string; companySlug?: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
  const ok = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !ok) throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");

  const filter: Record<string, unknown> = { userId: user._id, status: "ACTIVE" };
  if (input.companySlug) {
    const company = await Company.findOne({ slug: input.companySlug.toLowerCase() });
    if (!company) throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    filter.tenantId = company._id;
  }
  const member = await CompanyMember.findOne(filter).setOptions({ skipTenantGuard: true });
  if (!member) throw new AppError(403, "No active company membership", "NO_MEMBERSHIP");

  const company = await Company.findById(member.tenantId);
  const token = issueSession(user.id, member.tenantId.toString(), member.id, member.role as Role);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email },
    company: company && { id: company.id, name: company.name, slug: company.slug },
    role: member.role as Role,
  };
}