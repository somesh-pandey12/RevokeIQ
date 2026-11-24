import { Router } from "express";
import * as c from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

export const authRoutes = Router();

authRoutes.post("/register-company", c.registerCompany);
authRoutes.post("/register-customer", c.registerCustomer);
authRoutes.post("/login", c.login);
authRoutes.post("/logout", c.logout);
authRoutes.get("/me", authenticate, c.me);