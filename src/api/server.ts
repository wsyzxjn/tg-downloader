import { serve } from "@hono/node-server";
import { app } from "@/api/app.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`API server is running at http://localhost:${port}`);
