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

export const startServer = (port = 3001) => {
  const app = createApp();

  app.listen(port, () => {
    console.log(`Express + Prisma running on ${port}`);
  });
};
