import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { verifyToken, AuthPayload } from "../utils/token";
import { Role, CompanyMember } from "../models/companyMember.model";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");
  let payload: AuthPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, "Session expired or invalid", "INVALID_SESSION");
  }
  const member = await CompanyMember.findOne({
    _id: payload.memberId,
    tenantId: payload.tenantId,
    status: "ACTIVE",
  });
  if (!member) throw new AppError(401, "Membership no longer active", "INVALID_SESSION");
  req.auth = { ...payload, role: member.role as Role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new AppError(403, "You do not have permission", "FORBIDDEN");
    }
    next();
  };
}