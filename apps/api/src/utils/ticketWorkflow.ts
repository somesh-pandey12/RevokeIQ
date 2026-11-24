import { TicketStatus } from "../models/ticket.model";
import { Role } from "../models/companyMember.model";

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_CUSTOMER", "ESCALATED", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

export function canTransition(from: TicketStatus, to: TicketStatus, role: Role): boolean {
  if (role === "CUSTOMER") return false; 
  if (!TRANSITIONS[from].includes(to)) return false;
  if (from === "ESCALATED" && role !== "ADMIN") return false;
  if (from === "CLOSED" && role !== "ADMIN") return false;
  return true;
}