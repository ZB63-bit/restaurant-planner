import "dotenv/config";
import express from "express";
import cors from "cors";
import { placesRouter } from "./routes/places.js";
import { pushRouter } from "./routes/push.js";

const app = express();
app.use(express.json());

// Allow only the configured browser origins (the Vite app).
const origins = (process.env.WEB_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: origins }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/places", placesRouter());
app.use("/api/push", pushRouter());

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Restaurant Planner server listening on http://localhost:${port}`);
  console.log(`Allowed origins: ${origins.join(", ")}`);
});
