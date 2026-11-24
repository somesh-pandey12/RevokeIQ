import { describe, it, expect } from "vitest";
import { canTransition } from "../src/utils/ticketWorkflow";

describe("ticket workflow", () => {
  it("agent can start work on an open ticket", () => {
    expect(canTransition("OPEN", "IN_PROGRESS", "AGENT")).toBe(true);
  });
  it("customer can never change status directly", () => {
    expect(canTransition("OPEN", "CLOSED", "CUSTOMER")).toBe(false);
    expect(canTransition("RESOLVED", "OPEN", "CUSTOMER")).toBe(false);
  });
  it("resolved tickets cannot jump back to in progress", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS", "ADMIN")).toBe(false);
  });
  it("only admin can move a ticket out of ESCALATED", () => {
    expect(canTransition("ESCALATED", "RESOLVED", "AGENT")).toBe(false);
    expect(canTransition("ESCALATED", "RESOLVED", "ADMIN")).toBe(true);
  });
  it("only admin can reopen a closed ticket", () => {
    expect(canTransition("CLOSED", "OPEN", "AGENT")).toBe(false);
    expect(canTransition("CLOSED", "OPEN", "ADMIN")).toBe(true);
  });
});