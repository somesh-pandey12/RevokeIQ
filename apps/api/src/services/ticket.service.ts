import { Types } from "mongoose";
import { Ticket, TicketStatus } from "../models/ticket.model";
import { TicketMessage } from "../models/ticketMessage.model";
import { TicketActivity, ActivityType } from "../models/ticketActivity.model";
import { CompanyMember, Role } from "../models/companyMember.model";
import { User } from "../models/user.model";
import { nextSequence } from "../models/counter.model";
import { AppError } from "../utils/AppError";
import { AuthPayload } from "../utils/token";
import { canTransition } from "../utils/ticketWorkflow";

type Loose = { _id: unknown } & Record<string, any>;
type PublicUser = { id: string; name: string; email: string };

const isStaff = (role: Role) => role !== "CUSTOMER";
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function logActivity(
  tenantId: string,
  ticketId: unknown,
  actorId: string,
  type: ActivityType,
  meta: Record<string, unknown> = {}
) {
  await TicketActivity.create({ tenantId, ticketId, actorId, type, meta });
}

async function loadTicket(auth: AuthPayload, id: string) {
  const filter: Record<string, unknown> = { _id: id, tenantId: auth.tenantId };
  if (!isStaff(auth.role)) filter.customerId = auth.userId;
  const ticket = await Ticket.findOne(filter);
  if (!ticket) throw new AppError(404, "Ticket not found", "NOT_FOUND");
  return ticket;
}

async function usersById(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: unique } }).select("name email").lean();
  return new Map<string, PublicUser>(
    users.map((u) => [u._id.toString(), { id: u._id.toString(), name: u.name, email: u.email }])
  );
}

function serializeTicket(t: Loose, users: Map<string, PublicUser>, staff: boolean) {
  const customer = users.get(String(t.customerId));
  const agent = t.assignedAgentId ? users.get(String(t.assignedAgentId)) : undefined;
  return {
    id: String(t._id),
    number: t.number as number,
    ticketNumber: `TCK-${1000 + t.number}`,
    subject: t.subject,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    customer: customer && {
      id: customer.id,
      name: customer.name,
      ...(staff ? { email: customer.email } : {}), 
    },
    assignedAgent: agent ? { id: agent.id, name: agent.name } : null,
    firstResponseAt: t.firstResponseAt ?? null,
    resolvedAt: t.resolvedAt ?? null,
    closedAt: t.closedAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export async function getTicketDetail(auth: AuthPayload, id: string) {
  const staff = isStaff(auth.role);
  const ticket = await loadTicket(auth, id);

  const messageFilter: Record<string, unknown> = { tenantId: auth.tenantId, ticketId: ticket._id };
  if (!staff) messageFilter.isInternal = false; 

  const [messages, activity] = await Promise.all([
    TicketMessage.find(messageFilter).sort({ createdAt: 1 }).lean(),
    staff
      ? TicketActivity.find({ tenantId: auth.tenantId, ticketId: ticket._id })
          .sort({ createdAt: 1 })
          .lean()
      : Promise.resolve(null),
  ]);

  const users = await usersById([
    ticket.customerId,
    ticket.assignedAgentId,
    ...messages.map((m) => m.senderId),
    ...(activity ?? []).map((a) => a.actorId),
  ]);

  return {
    ticket: serializeTicket(ticket.toObject(), users, staff),
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderType: m.senderType,
      sender: { id: m.senderId.toString(), name: users.get(m.senderId.toString())?.name },
      message: m.message,
      isInternal: m.isInternal,
      createdAt: m.createdAt,
    })),
    ...(activity
      ? {
          activity: activity.map((a) => ({
            id: a._id.toString(),
            type: a.type,
            actor: { id: a.actorId.toString(), name: users.get(a.actorId.toString())?.name },
            meta: a.meta,
            createdAt: a.createdAt,
          })),
        }
      : {}),
  };
}

export async function createTicket(
  auth: AuthPayload,
  input: { subject: string; description: string; category: string }
) {
  if (auth.role !== "CUSTOMER") {
    throw new AppError(403, "Only customers can submit tickets", "FORBIDDEN");
  }
  const number = await nextSequence(auth.tenantId, "ticket");
  const ticket = await Ticket.create({
    tenantId: auth.tenantId,
    number,
    customerId: auth.userId,
    subject: input.subject,
    description: input.description,
    category: input.category,
  });
  await TicketMessage.create({
    tenantId: auth.tenantId,
    ticketId: ticket._id,
    senderId: auth.userId,
    senderType: "CUSTOMER",
    message: input.description,
  });
  await logActivity(auth.tenantId, ticket._id, auth.userId, "CREATED");
  return getTicketDetail(auth, ticket.id);
}

export async function listTickets(
  auth: AuthPayload,
  q: {
    status?: string; priority?: string; category?: string;
    assigned?: string; q?: string; page: number; limit: number;
  }
) {
  const staff = isStaff(auth.role);
  const filter: Record<string, unknown> = { tenantId: auth.tenantId };
  if (!staff) filter.customerId = auth.userId;
  if (q.status) filter.status = q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.category) filter.category = q.category;
  if (staff && q.assigned) {
    filter.assignedAgentId =
      q.assigned === "me" ? auth.userId : q.assigned === "unassigned" ? null : q.assigned;
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ subject: rx }, { description: rx }];
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  const users = await usersById(tickets.flatMap((t) => [t.customerId, t.assignedAgentId]));

  return {
    items: tickets.map((t) => serializeTicket(t, users, staff)),
    page: q.page,
    limit: q.limit,
    total,
    totalPages: Math.ceil(total / q.limit),
  };
}

export async function addMessage(
  auth: AuthPayload,
  id: string,
  input: { message: string; isInternal: boolean }
) {
  const staff = isStaff(auth.role);
  if (input.isInternal && !staff) {
    throw new AppError(403, "Customers cannot add internal notes", "FORBIDDEN");
  }
  const ticket = await loadTicket(auth, id);
  if (ticket.status === "CLOSED") {
    throw new AppError(409, "Ticket is closed. Reopen it first.", "TICKET_CLOSED");
  }

  const message = await TicketMessage.create({
    tenantId: auth.tenantId,
    ticketId: ticket._id,
    senderId: auth.userId,
    senderType: auth.role,
    message: input.message,
    isInternal: input.isInternal,
  });

  const set: Record<string, unknown> = {};
  let newStatus: TicketStatus | undefined;

  if (!staff) {
    if (ticket.status === "RESOLVED") newStatus = "OPEN";
    else if (ticket.status === "WAITING_FOR_CUSTOMER") newStatus = "IN_PROGRESS";
  } else if (!input.isInternal) {
    if (!ticket.firstResponseAt) set.firstResponseAt = new Date();
    if (ticket.status === "OPEN") newStatus = "IN_PROGRESS";
    if (!ticket.assignedAgentId) set.assignedAgentId = auth.userId;
  }
  if (newStatus) {
    set.status = newStatus;
    if (newStatus === "OPEN") set.resolvedAt = null;
  }
  if (Object.keys(set).length > 0) {
    await Ticket.updateOne({ _id: ticket._id, tenantId: auth.tenantId }, { $set: set });
  }

  await logActivity(auth.tenantId, ticket._id, auth.userId, input.isInternal ? "NOTE_ADDED" : "MESSAGE_ADDED");
  if (newStatus) {
    await logActivity(auth.tenantId, ticket._id, auth.userId, "STATUS_CHANGED", {
      from: ticket.status, to: newStatus, auto: true,
    });
  }

  return {
    message: {
      id: message.id,
      senderType: message.senderType,
      message: message.message,
      isInternal: message.isInternal,
      createdAt: message.createdAt,
    },
  };
}

export async function updateTicket(
  auth: AuthPayload,
  id: string,
  input: { status?: TicketStatus; priority?: string; category?: string }
) {
  if (!isStaff(auth.role)) throw new AppError(403, "You do not have permission", "FORBIDDEN");
  const ticket = await loadTicket(auth, id);

  const set: Record<string, unknown> = {};
  const logs: Array<[ActivityType, Record<string, unknown>]> = [];

  if (input.status && input.status !== ticket.status) {
    const from = ticket.status as TicketStatus;
    if (!canTransition(from, input.status, auth.role)) {
      throw new AppError(409, `Cannot move ticket from ${from} to ${input.status}`, "INVALID_TRANSITION");
    }
    set.status = input.status;
    if (input.status === "RESOLVED") set.resolvedAt = new Date();
    if (input.status === "CLOSED") {
      set.closedAt = new Date();
      if (!ticket.resolvedAt) set.resolvedAt = new Date();
    }
    if (input.status !== "RESOLVED" && input.status !== "CLOSED") {
      set.resolvedAt = null;
      set.closedAt = null;
    }
    logs.push(["STATUS_CHANGED", { from, to: input.status }]);
  }
  if (input.priority && input.priority !== ticket.priority) {
    set.priority = input.priority;
    logs.push(["PRIORITY_CHANGED", { from: ticket.priority, to: input.priority }]);
  }
  if (input.category && input.category !== ticket.category) {
    set.category = input.category;
    logs.push(["CATEGORY_CHANGED", { from: ticket.category, to: input.category }]);
  }

  if (Object.keys(set).length > 0) {

    const result = await Ticket.updateOne(
      { _id: ticket._id, tenantId: auth.tenantId, status: ticket.status },
      { $set: set }
    );
    if (result.matchedCount === 0) {
      throw new AppError(409, "Ticket was modified by someone else. Refresh and retry.", "CONFLICT");
    }
    for (const [type, meta] of logs) await logActivity(auth.tenantId, ticket._id, auth.userId, type, meta);
  }
  return getTicketDetail(auth, id);
}

export async function assignTicket(auth: AuthPayload, id: string, agentId: string | null) {
  if (!isStaff(auth.role)) throw new AppError(403, "You do not have permission", "FORBIDDEN");
  if (auth.role === "AGENT" && agentId !== auth.userId) {
    throw new AppError(403, "Agents can only assign tickets to themselves", "FORBIDDEN");
  }
  const ticket = await loadTicket(auth, id);
  if (ticket.status === "CLOSED") throw new AppError(409, "Ticket is closed", "TICKET_CLOSED");

  if (agentId) {
    const member = await CompanyMember.findOne({
      tenantId: auth.tenantId,
      userId: agentId,
      role: { $in: ["AGENT", "ADMIN"] },
      status: "ACTIVE",
    });
    if (!member) throw new AppError(400, "Agent not found in this company", "INVALID_AGENT");
  }

  await Ticket.updateOne(
    { _id: ticket._id, tenantId: auth.tenantId },
    { $set: { assignedAgentId: agentId } }
  );
  await logActivity(auth.tenantId, ticket._id, auth.userId, "ASSIGNED", {
    from: ticket.assignedAgentId ? String(ticket.assignedAgentId) : null,
    to: agentId,
  });
  return getTicketDetail(auth, id);
}

export async function escalateTicket(auth: AuthPayload, id: string, reason: string) {
  if (!isStaff(auth.role)) throw new AppError(403, "You do not have permission", "FORBIDDEN");
  const ticket = await loadTicket(auth, id);
  const from = ticket.status as TicketStatus;
  if (!canTransition(from, "ESCALATED", auth.role)) {
    throw new AppError(409, `Cannot escalate a ticket that is ${from}`, "INVALID_TRANSITION");
  }
  const result = await Ticket.updateOne(
    { _id: ticket._id, tenantId: auth.tenantId, status: ticket.status },
    { $set: { status: "ESCALATED", resolvedAt: null, closedAt: null } }
  );
  if (result.matchedCount === 0) {
    throw new AppError(409, "Ticket was modified by someone else. Refresh and retry.", "CONFLICT");
  }
  await TicketMessage.create({
    tenantId: auth.tenantId,
    ticketId: ticket._id,
    senderId: auth.userId,
    senderType: auth.role,
    message: `Escalated: ${reason}`,
    isInternal: true,
  });
  await logActivity(auth.tenantId, ticket._id, auth.userId, "ESCALATED", { reason, from });
  return getTicketDetail(auth, id);
}