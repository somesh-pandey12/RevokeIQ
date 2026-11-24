import { z } from "zod";

export const objectIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const createInvitationSchema = z.object({
  email: z.email(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(200),
  name: z.string().min(2).max(80).optional(),
  password: z.string().min(8).max(100),
});

export const updateMemberSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const listMembersQuery = z.object({
  role: z.enum(["ADMIN", "AGENT", "CUSTOMER"]).optional(),
});