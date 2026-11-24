import { Request, Response } from "express";
import * as svc from "../services/ticket.service";
import { objectIdParam } from "../validators/team.validators";
import {
  createTicketSchema, listTicketsQuery, updateTicketSchema,
  addMessageSchema, assignSchema, escalateSchema,
} from "../validators/ticket.validators";

export async function create(req: Request, res: Response) {
  const input = createTicketSchema.parse(req.body);
  res.status(201).json(await svc.createTicket(req.auth!, input));
}

export async function list(req: Request, res: Response) {
  const query = listTicketsQuery.parse(req.query);
  res.json(await svc.listTickets(req.auth!, query));
}

export async function detail(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  res.json(await svc.getTicketDetail(req.auth!, id));
}

export async function update(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  res.json(await svc.updateTicket(req.auth!, id, updateTicketSchema.parse(req.body)));
}

export async function addMessage(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  res.status(201).json(await svc.addMessage(req.auth!, id, addMessageSchema.parse(req.body)));
}

export async function assign(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  const { agentId } = assignSchema.parse(req.body);
  res.json(await svc.assignTicket(req.auth!, id, agentId));
}

export async function escalate(req: Request, res: Response) {
  const { id } = objectIdParam.parse(req.params);
  const { reason } = escalateSchema.parse(req.body);
  res.json(await svc.escalateTicket(req.auth!, id, reason));
}