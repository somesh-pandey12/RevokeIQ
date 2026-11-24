import mongoose from "mongoose";
import request from "supertest";
import { app } from "../src/app";

export type Agent = ReturnType<typeof request.agent>;

export async function connectTestDb() {
  const uri = process.env.MONGODB_URI ?? "";
  if (!uri.includes("_test")) {
    throw new Error("Refusing to run tests against a non-test database");
  }
  await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function resetDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}

export async function createCompanyAdmin(companyName: string, email: string) {
  const agent = request.agent(app); // cookies yaad rakhta hai
  const res = await agent
    .post("/api/v1/auth/register-company")
    .send({ name: "Admin", email, password: "Password123", companyName });
  return {
    agent,
    slug: res.body.company.slug as string,
    companyId: res.body.company.id as string,
  };
}

export async function inviteAndJoinAgent(admin: { agent: Agent }, email: string) {
  const inv = await admin.agent.post("/api/v1/invitations").send({ email });
  const token = new URL(inv.body.inviteLink).searchParams.get("token")!;
  const agent = request.agent(app);
  const res = await agent
    .post("/api/v1/auth/accept-invitation")
    .send({ token, name: "Agent", password: "Password123" });
  return { agent, token, res };
}

export async function findMemberId(admin: { agent: Agent }, email: string) {
  const list = await admin.agent.get("/api/v1/members");
  return list.body.items.find((m: { user: { email: string } }) => m.user.email === email).id as string;
}
export async function createCustomer(slug: string, email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/auth/register-customer").send({
    name: "Customer", email, password: "Password123", companySlug: slug,
  });
  return { agent, userId: res.body.user.id as string };
}

export async function submitTicket(
  customer: { agent: Agent },
  subject = "Order not delivered",
  category = "DELIVERY"
) {
  const res = await customer.agent.post("/api/v1/tickets").send({
    subject, description: "My order has not arrived for 5 days.", category,
  });
  return res.body.ticket as { id: string; number: number; status: string };
}