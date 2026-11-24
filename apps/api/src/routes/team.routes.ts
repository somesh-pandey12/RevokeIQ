import { Router } from "express";
import * as c from "../controllers/team.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const invitationRoutes = Router();
invitationRoutes.use(authenticate, requireRole("ADMIN"));
invitationRoutes.post("/", c.createInvitation);
invitationRoutes.get("/", c.listInvitations);
invitationRoutes.delete("/:id", c.revokeInvitation);

export const memberRoutes = Router();
memberRoutes.use(authenticate, requireRole("ADMIN"));
memberRoutes.get("/", c.listMembers);
memberRoutes.patch("/:id", c.updateMember);

export const companyRoutes = Router();
companyRoutes.use(authenticate);
companyRoutes.get("/current", c.currentCompany);