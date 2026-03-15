import express from "express";
import syncRoutes from "./routes/sync.js";

const app = express();
app.use(express.json());
app.use("/sync", syncRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Sync server error" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Sync API listening on ${port}`);
});
