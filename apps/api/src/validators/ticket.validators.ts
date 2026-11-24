import { z } from "zod";
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from "../models/ticket.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(TICKET_CATEGORIES).default("GENERAL"),
});

export const listTicketsQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  assigned: z.union([z.literal("me"), z.literal("unassigned"), objectId]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const addMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export const assignSchema = z.object({
  agentId: objectId.nullable(), // null = unassign
});

export const escalateSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});