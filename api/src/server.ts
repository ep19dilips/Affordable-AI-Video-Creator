import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/auth";
import { videoRoutes } from "./routes/videos";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.json({ status: "ok", service: "idea2video-api" }));
app.use("/auth", authRoutes);
app.use("/videos", videoRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`idea2video-api listening on :${port}`));
