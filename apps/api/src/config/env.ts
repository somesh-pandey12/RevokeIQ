import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI required hai"),
});

export const env = schema.parse(process.env);