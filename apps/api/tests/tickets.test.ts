import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  connectTestDb, resetDb, disconnectTestDb,
  createCompanyAdmin, inviteAndJoinAgent, createCustomer, submitTicket,
} from "./helpers";

beforeAll(connectTestDb);
beforeEach(resetDb);
afterAll(disconnectTestDb);

async function setup() {
  const admin = await createCompanyAdmin("Acme", "admin@acme.test");
  const agent = await inviteAndJoinAgent(admin, "agent@acme.test");
  const customer = await createCustomer(admin.slug, "riya@test.dev");
  const ticket = await submitTicket(customer);
  return { admin, agent, customer, ticket, agentUserId: agent.res.body.user.id as string };
}

const url = (id: string, suffix = "") => `/api/v1/tickets/${id}${suffix}`;

describe("ticket creation", () => {
  it("customer creates a ticket; numbers are sequential per company", async () => {
    const { admin, customer, ticket } = await setup();
    expect(ticket.status).toBe("OPEN");
    expect(ticket.number).toBe(1);
    expect((await submitTicket(customer, "Second issue")).number).toBe(2);

    const other = await createCompanyAdmin("Other Co", "admin@other.test");
    const otherCustomer = await createCustomer(other.slug, "c@other.test");
    expect((await submitTicket(otherCustomer)).number).toBe(1);
    expect(admin.slug).not.toBe(other.slug);
  });

  it("rejects invalid input", async () => {
    const { customer } = await setup();
    const res = await customer.agent.post("/api/v1/tickets").send({ subject: "Hi", description: "short" });
    expect(res.status).toBe(400);
  });

  it("agents cannot submit tickets as customers", async () => {
    const { agent } = await setup();
    const res = await agent.agent.post("/api/v1/tickets").send({
      subject: "Test ticket", description: "Some long enough description",
    });
    expect(res.status).toBe(403);
  });
});

describe("visibility", () => {
  it("a customer cannot read another customer's ticket", async () => {
    const { admin, ticket } = await setup();
    const other = await createCustomer(admin.slug, "sam@test.dev");
    expect((await other.agent.get(url(ticket.id))).status).toBe(404);
    const list = await other.agent.get("/api/v1/tickets");
    expect(list.body.total).toBe(0);
  });

  it("company B cannot see or touch company A tickets", async () => {
    const { ticket } = await setup();
    const b = await createCompanyAdmin("Company B", "admin@b.test");
    expect((await b.agent.get(url(ticket.id))).status).toBe(404);
    expect((await b.agent.patch(url(ticket.id)).send({ status: "RESOLVED" })).status).toBe(404);
    expect((await b.agent.get("/api/v1/tickets")).body.total).toBe(0);
  });

  it("internal notes and activity are hidden from the customer", async () => {
    const { agent, customer, ticket } = await setup();
    const note = await agent.agent
      .post(url(ticket.id, "/messages"))
      .send({ message: "Customer seems upset, check refund policy", isInternal: true });
    expect(note.status).toBe(201);

    const asCustomer = await customer.agent.get(url(ticket.id));
    const customerTexts = asCustomer.body.messages.map((m: { message: string }) => m.message).join(" ");
    expect(customerTexts).not.toContain("seems upset");
    expect(asCustomer.body.activity).toBeUndefined();
    expect(asCustomer.body.ticket.customer.email).toBeUndefined();

    const asAgent = await agent.agent.get(url(ticket.id));
    const agentTexts = asAgent.body.messages.map((m: { message: string }) => m.message).join(" ");
    expect(agentTexts).toContain("seems upset");
    expect(asAgent.body.activity.length).toBeGreaterThan(0);
  });

  it("customers cannot post internal notes or use staff actions", async () => {
    const { customer, ticket } = await setup();
    expect((await customer.agent.post(url(ticket.id, "/messages")).send({ message: "x", isInternal: true })).status).toBe(403);
    expect((await customer.agent.patch(url(ticket.id)).send({ status: "CLOSED" })).status).toBe(403);
    expect((await customer.agent.post(url(ticket.id, "/assign")).send({ agentId: null })).status).toBe(403);
    expect((await customer.agent.post(url(ticket.id, "/escalate")).send({ reason: "please escalate" })).status).toBe(403);
  });
});

describe("messages and workflow", () => {
  it("first agent reply sets firstResponseAt, moves to IN_PROGRESS and self-assigns", async () => {
    const { agent, agentUserId, ticket } = await setup();
    await agent.agent.post(url(ticket.id, "/messages")).send({ message: "Checking your order now." });
    const res = await agent.agent.get(url(ticket.id));
    expect(res.body.ticket.status).toBe("IN_PROGRESS");
    expect(res.body.ticket.firstResponseAt).toBeTruthy();
    expect(res.body.ticket.assignedAgent.id).toBe(agentUserId);
  });

  it("rejects invalid status transitions", async () => {
    const { agent, ticket } = await setup();
    expect((await agent.agent.patch(url(ticket.id)).send({ status: "RESOLVED" })).status).toBe(200);
    const bad = await agent.agent.patch(url(ticket.id)).send({ status: "IN_PROGRESS" });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("resolving sets resolvedAt and a customer reply reopens the ticket", async () => {
    const { agent, customer, ticket } = await setup();
    const resolved = await agent.agent.patch(url(ticket.id)).send({ status: "RESOLVED" });
    expect(resolved.body.ticket.resolvedAt).toBeTruthy();

    await customer.agent.post(url(ticket.id, "/messages")).send({ message: "Still not received!" });
    const after = await customer.agent.get(url(ticket.id));
    expect(after.body.ticket.status).toBe("OPEN");
    expect(after.body.ticket.resolvedAt).toBeNull();
  });

  it("closed tickets accept no new messages", async () => {
    const { admin, customer, ticket } = await setup();
    await admin.agent.patch(url(ticket.id)).send({ status: "CLOSED" });
    const res = await customer.agent.post(url(ticket.id, "/messages")).send({ message: "hello?" });
    expect(res.status).toBe(409);
  });
});

describe("escalation and assignment", () => {
  it("agent escalates; only admin can move it forward", async () => {
    const { admin, agent, customer, ticket } = await setup();
    const esc = await agent.agent.post(url(ticket.id, "/escalate")).send({ reason: "Refund above agent limit" });
    expect(esc.status).toBe(200);
    expect(esc.body.ticket.status).toBe("ESCALATED");

    expect((await agent.agent.patch(url(ticket.id)).send({ status: "RESOLVED" })).status).toBe(409);
    expect((await admin.agent.patch(url(ticket.id)).send({ status: "RESOLVED" })).status).toBe(200);

    const asCustomer = await customer.agent.get(url(ticket.id));
    const texts = asCustomer.body.messages.map((m: { message: string }) => m.message).join(" ");
    expect(texts).not.toContain("Refund above agent limit");
  });

  it("admin assigns an agent, but not an agent from another company", async () => {
    const { admin, agentUserId, ticket } = await setup();
    const ok = await admin.agent.post(url(ticket.id, "/assign")).send({ agentId: agentUserId });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.assignedAgent.id).toBe(agentUserId);

    const b = await createCompanyAdmin("Company B", "admin@b.test");
    const bAgent = await inviteAndJoinAgent(b, "agent@b.test");
    const bad = await admin.agent
      .post(url(ticket.id, "/assign"))
      .send({ agentId: bAgent.res.body.user.id });
    expect(bad.status).toBe(400);
  });

  it("an agent can only assign tickets to themselves", async () => {
    const { admin, agent, ticket } = await setup();
    const adminId = (await admin.agent.get("/api/v1/auth/me")).body.user.id;
    expect((await agent.agent.post(url(ticket.id, "/assign")).send({ agentId: adminId })).status).toBe(403);
  });
});

describe("list: pagination, filters, search", () => {
  it("paginates, filters by status and searches text", async () => {
    const { agent, customer, ticket } = await setup();
    await submitTicket(customer, "Refund for damaged phone", "REFUND");
    await submitTicket(customer, "Cannot login to app", "TECHNICAL");

    const page1 = await agent.agent.get("/api/v1/tickets?limit=2&page=1");
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBe(3);
    expect(page1.body.totalPages).toBe(2);

    await agent.agent.patch(url(ticket.id)).send({ status: "IN_PROGRESS" });
    const byStatus = await agent.agent.get("/api/v1/tickets?status=IN_PROGRESS");
    expect(byStatus.body.total).toBe(1);

    const search = await agent.agent.get("/api/v1/tickets?q=damaged");
    expect(search.body.total).toBe(1);
    expect(search.body.items[0].category).toBe("REFUND");

    const byCategory = await agent.agent.get("/api/v1/tickets?category=TECHNICAL");
    expect(byCategory.body.total).toBe(1);
  });
});