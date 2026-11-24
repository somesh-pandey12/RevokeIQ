import { Request, Response } from "express";
import * as invitations from "../services/invitation.service";
import * as members from "../services/member.service";
import {
  createInvitationSchema,
  objectIdParam,
  updateMemberSchema,
  listMembersQuery,
} from "../validators/team.validators";
import { Company } from "../models/company.model";
import { AppError } from "../utils/AppError";

export async function createInvitation(req: Request, res: Response) {
  const { email } = createInvitationSchema.parse(req.body);
  const result = await invitations.createInvitation(req.auth!.tenantId, req.auth!.userId, email);
  res.status(201).json(result);
}

export async function listInvitations(req: Request, res: Response) {
  res.json({ items: await invitations.listInvitations(req.auth!.tenantId) });
}

export async function revokeInvitation(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  await invitations.revokeInvitation(req.auth!.tenantId, id);
  res.status(204).send();
}

export async function listMembers(req: Request, res: Response) {
  const { role } = listMembersQuery.parse(req.query);
  res.json({ items: await members.listMembers(req.auth!.tenantId, role) });
}

export async function updateMember(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  const { status } = updateMemberSchema.parse(req.body);
  res.json(await members.updateMemberStatus(req.auth!.tenantId, req.auth!.memberId, id, status));
}

export async function currentCompany(req: Request, res: Response) {
  const company = await Company.findById(req.auth!.tenantId);
  if (!company) throw new AppError(404, "Company not found", "NOT_FOUND");
  res.json({ id: company.id, name: company.name, slug: company.slug });
}