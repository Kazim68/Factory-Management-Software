import express from "express";
import routes from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(routes);
  app.use(errorHandler);

  return app;
};

export function startServer() {
  const app = createApp();
   return new Promise((resolve, reject) => {
    try {
      const server = app.listen(4001, "127.0.0.1" , () => {
        console.log("✅ Express running on 3001");
        resolve(server);
      });

      server.on("error", (err) => {
        console.error("❌ Express server error:", err);
        reject(err);
      });

    } catch (err) {
      console.error("❌ Express crashed:", err);
      reject(err);
    }
  });
}

