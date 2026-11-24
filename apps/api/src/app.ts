import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth.routes";
import { invitationRoutes, memberRoutes, companyRoutes } from "./routes/team.routes";
import { notFound, errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { error: { code: "RATE_LIMITED", message: "Too many requests, try again later" } },
});

app.get("/api/v1/health", (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? "ok" : "degraded",
    service: "resolveiq-api",
    database: dbReady ? "connected" : "disconnected",
  });
});

app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/invitations", invitationRoutes);
app.use("/api/v1/members", memberRoutes);
app.use("/api/v1/companies", companyRoutes);

app.use(notFound);
app.use(errorHandler);