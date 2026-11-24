import { Request, Response, CookieOptions } from "express";
import { env } from "../config/env";
import * as authService from "../services/auth.service";
import { registerCompanySchema, registerCustomerSchema, loginSchema } from "../validators/auth.validators";
import { User } from "../models/user.model";
import { Company } from "../models/company.model";
import * as invitationService from "../services/invitation.service";
import { acceptInvitationSchema } from "../validators/team.validators";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function respond(res: Response, status: number, result: Awaited<ReturnType<typeof authService.login>>) {
  const { token, ...data } = result;
  res.cookie(env.COOKIE_NAME, token, cookieOptions);
  res.status(status).json(data);
}

export async function registerCompany(req: Request, res: Response) {
  const input = registerCompanySchema.parse(req.body);
  respond(res, 201, await authService.registerCompany(input));
}

export async function registerCustomer(req: Request, res: Response) {
  const input = registerCustomerSchema.parse(req.body);
  respond(res, 201, await authService.registerCustomer(input));
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  respond(res, 200, await authService.login(input));
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(env.COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const auth = req.auth!;
  const [user, company] = await Promise.all([
    User.findById(auth.userId),
    Company.findById(auth.tenantId),
  ]);
  res.json({
    user: user && { id: user.id, name: user.name, email: user.email },
    company: company && { id: company.id, name: company.name, slug: company.slug },
    role: auth.role,
  });
}
export async function acceptInvitation(req: Request, res: Response) {
  const input = acceptInvitationSchema.parse(req.body);
  respond(res, 201, await invitationService.acceptInvitation(input));
}