import cors from "cors";
import MongoStore from "connect-mongo";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import session from "express-session";
import { disconnectFromDatabase, connectToDatabase } from "../config/database.js";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../config/session.js";
import { validateEnvironment } from "../config/env.js";
import User from "../models/globalUser.model.js";
import { verifyCsrfToken } from "../middleware/auth.middleware.js";
import HttpError from "../utils/httpError.js";
import apiRoutes from "./routes/index.js";

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "signin_sessions",
    ttl: 60 * 60,
  });

  if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new HttpError(403, "This origin is not allowed."));
      },
    }),
  );
  app.use("/api", (request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      rolling: true,
      cookie: sessionCookieOptions,
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests. Try again later." },
    }),
  );
  app.get("/api/status", (request, response) => {
    response.json({ localDemoMode: false, authentication: "session-cookie" });
  });
  app.use("/api", verifyCsrfToken, apiRoutes);
  app.use((request, response, next) => {
    next(new HttpError(404, "Route not found."));
  });
  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    let status = error instanceof HttpError ? error.status : 500;
    let message = error instanceof HttpError
      ? error.message
      : "An unexpected server error occurred.";

    if (error.code === 11000) {
      status = 409;
      message = "An account with these details already exists.";
    } else if (error.name === "ValidationError") {
      status = 400;
      message = "The submitted data is invalid.";
    } else if (error.name === "CastError") {
      status = 400;
      message = "The submitted identifier is invalid.";
    } else if (error.type === "entity.too.large") {
      status = 413;
      message = "Request body is too large.";
    } else if (error.type === "entity.parse.failed") {
      status = 400;
      message = "Request body is invalid JSON.";
    }

    if (status >= 500) {
      console.error("Request failed.", { name: error.name || "Error" });
    }
    response.status(status).json({ message });
  });

  sessionStore.on("error", (error) => {
    console.error("Session store error.", { name: error.name || "Error" });
  });
  return app;
}

export async function startServer() {
  validateEnvironment();
  await connectToDatabase();
  await User.init();

  const app = createApp();
  const port = Number(process.env.PORT || 5000);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.once("error", reject);
  });

  console.log(`Sign-in service listening on port ${port}.`);

  const shutdown = async () => {
    server.close(async () => {
      await disconnectFromDatabase();
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}
