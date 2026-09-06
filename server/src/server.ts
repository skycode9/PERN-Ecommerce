import "dotenv/config";
import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "success",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});

export default app;
