import { Router } from "express";
import * as c from "../controllers/ticket.controller";
import { authenticate } from "../middleware/auth";

export const ticketRoutes = Router();
ticketRoutes.use(authenticate);

ticketRoutes.get("/", c.list);
ticketRoutes.post("/", c.create);
ticketRoutes.get("/:id", c.detail);
ticketRoutes.patch("/:id", c.update);
ticketRoutes.post("/:id/messages", c.addMessage);
ticketRoutes.post("/:id/assign", c.assign);
ticketRoutes.post("/:id/escalate", c.escalate);