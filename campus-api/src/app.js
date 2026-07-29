import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import profileOptionRoutes from "./routes/profileOptionRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import { UPLOAD_ROOT } from "./middleware/uploadMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
void __dirname;
void __filename;

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// Security middleware — allow cross-origin media for chat attachments
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Request logging
app.use(morgan("dev"));

// JSON body parsing
app.use(
  express.json({
    limit: "10kb",
  })
);

// Form body parsing
app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  })
);

// Cookie parsing
app.use(cookieParser());

// Static chat uploads (validated at write time)
app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    fallthrough: true,
    maxAge: "7d",
  })
);

// Health routes
app.use(
  "/api/v1/health",
  healthRoutes
);

// Authentication routes
app.use(
  "/api/v1/auth",
  authRoutes
);

// Profile routes
app.use(
  "/api/v1/profile",
  profileRoutes
);

// Active departments and academic years used during profile setup
app.use(
  "/api/v1/profile-options",
  profileOptionRoutes
);

// Admin routes
app.use(
  "/api/v1/admin",
  adminRoutes
);

// Campus chat routes
app.use(
  "/api/v1/chat",
  chatRoutes
);

// Handle unknown routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
