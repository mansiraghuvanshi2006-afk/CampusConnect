import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import healthRoutes from "./routes/healthRoutes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// ---------- Security Middleware ----------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ---------- Logging ----------
app.use(morgan("dev"));

// ---------- Body Parser ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Cookie Parser ----------
app.use(cookieParser());

// ---------- Routes ----------
app.use("/", healthRoutes);

// ---------- 404 Middleware ----------
app.use(notFound);

// ---------- Global Error Handler ----------
app.use(errorHandler);

export default app;