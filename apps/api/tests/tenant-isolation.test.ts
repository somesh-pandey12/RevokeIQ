import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { Invitation } from "../src/models/invitation.model";
import { CompanyMember } from "../src/models/companyMember.model";
import {
  connectTestDb, resetDb, disconnectTestDb,
  createCompanyAdmin, inviteAndJoinAgent, findMemberId,
} from "./helpers";

beforeAll(connectTestDb);
beforeEach(resetDb);
afterAll(disconnectTestDb);

describe("registration & roles", () => {
  it("public customer registration cannot choose a role", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const res = await request(app).post("/api/v1/auth/register-customer").send({
      name: "Riya", email: "riya@test.dev", password: "Password123",
      companySlug: admin.slug, role: "ADMIN",
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("CUSTOMER");
  });

  it("agent cannot create invitations (admin only)", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const agent = await inviteAndJoinAgent(admin, "agent@acme.test");
    const res = await agent.agent.post("/api/v1/invitations").send({ email: "x@acme.test" });
    expect(res.status).toBe(403);
  });

  it("customer and agent cannot list members", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const agent = await inviteAndJoinAgent(admin, "agent@acme.test");
    expect((await agent.agent.get("/api/v1/members")).status).toBe(403);

    const customer = request.agent(app);
    await customer.post("/api/v1/auth/register-customer").send({
      name: "Riya", email: "riya@test.dev", password: "Password123", companySlug: admin.slug,
    });
    expect((await customer.get("/api/v1/members")).status).toBe(403);
  });
});

describe("invitations", () => {
  it("lets an invited agent join with role AGENT and stores only a token hash", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const { agent, token, res } = await inviteAndJoinAgent(admin, "agent@acme.test");
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("AGENT");

    const me = await agent.get("/api/v1/auth/me");
    expect(me.body.role).toBe("AGENT");

    const stored = await Invitation.findOne({ email: "agent@acme.test" })
      .select("+tokenHash")
      .setOptions({ skipTenantGuard: true });
    expect(stored?.tokenHash).toBeDefined();
    expect(stored?.tokenHash).not.toBe(token);
  });

  it("invitation token works only once", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const first = await inviteAndJoinAgent(admin, "agent@acme.test");
    const again = await request(app)
      .post("/api/v1/auth/accept-invitation")
      .send({ token: first.token, name: "Other", password: "Password123" });
    expect(again.status).toBe(400);
  });

  it("expired invitation is rejected", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const inv = await admin.agent.post("/api/v1/invitations").send({ email: "late@acme.test" });
    const token = new URL(inv.body.inviteLink).searchParams.get("token")!;
    await Invitation.updateMany({}, { expiresAt: new Date(0) }).setOptions({ skipTenantGuard: true });

    const res = await request(app)
      .post("/api/v1/auth/accept-invitation")
      .send({ token, name: "Late", password: "Password123" });
    expect(res.status).toBe(400);
  });
});

describe("tenant isolation (Company A vs Company B)", () => {
  it("admin A only sees members of company A", async () => {
    const a = await createCompanyAdmin("Company A", "admin@a.test");
    const b = await createCompanyAdmin("Company B", "admin@b.test");
    await inviteAndJoinAgent(a, "agent@a.test");
    await inviteAndJoinAgent(b, "agent@b.test");

    const res = await a.agent.get("/api/v1/members");
    const emails = res.body.items.map((m: { user: { email: string } }) => m.user.email);
    expect(emails).toContain("agent@a.test");
    expect(emails).not.toContain("agent@b.test");
    expect(emails).not.toContain("admin@b.test");
  });

  it("admin A cannot suspend an agent of company B", async () => {
    const a = await createCompanyAdmin("Company A", "admin@a.test");
    const b = await createCompanyAdmin("Company B", "admin@b.test");
    await inviteAndJoinAgent(b, "agent@b.test");
    const bAgentId = await findMemberId(b, "agent@b.test");

    const res = await a.agent.patch(`/api/v1/members/${bAgentId}`).send({ status: "SUSPENDED" });
    expect(res.status).toBe(404);

    const stillActive = await CompanyMember.findOne({
      _id: bAgentId,
      tenantId: b.companyId,
    });
    expect(stillActive?.status).toBe("ACTIVE");
  });

  it("admin A cannot see or revoke company B invitations", async () => {
    const a = await createCompanyAdmin("Company A", "admin@a.test");
    const b = await createCompanyAdmin("Company B", "admin@b.test");
    const inv = await b.agent.post("/api/v1/invitations").send({ email: "new@b.test" });

    const list = await a.agent.get("/api/v1/invitations");
    expect(list.body.items).toHaveLength(0);

    const del = await a.agent.delete(`/api/v1/invitations/${inv.body.invitation.id}`);
    expect(del.status).toBe(404);
  });

  it("a suspended agent's existing session stops working immediately", async () => {
    const admin = await createCompanyAdmin("Acme", "admin@acme.test");
    const { agent } = await inviteAndJoinAgent(admin, "agent@acme.test");
    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);

    const agentId = await findMemberId(admin, "agent@acme.test");
    await admin.agent.patch(`/api/v1/members/${agentId}`).send({ status: "SUSPENDED" });

    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("tenant guard blocks queries without tenantId", async () => {
    await expect(CompanyMember.find({}).exec()).rejects.toThrow(/tenantId/);
  });
});