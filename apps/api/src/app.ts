import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

export const app = express();

app.use(helmet());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/v1/health", (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? "ok" : "degraded",
    service: "resolveiq-api",
    database: dbReady ? "connected" : "disconnected",
  });
});