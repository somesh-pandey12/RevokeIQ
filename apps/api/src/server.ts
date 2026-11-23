import { app } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";

async function main() {
  await connectDB();
  app.listen(env.API_PORT, () => {
    console.log(`API running on http://localhost:${env.API_PORT}`);
  });
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});