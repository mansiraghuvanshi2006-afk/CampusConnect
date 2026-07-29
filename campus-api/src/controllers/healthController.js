import mongoose from "mongoose";
import asyncHandler from "express-async-handler";

import { sendSuccess } from "../utils/apiResponse.js";
import messages from "../constants/messages.js";
import httpStatus from "../constants/statusCodes.js";

export const getHealth = asyncHandler(async (req, res) => {
  return sendSuccess(
    res,
    httpStatus.OK,
    messages.SERVER_RUNNING,
    {
      uptime: Math.floor(process.uptime()),
      database:
        mongoose.connection.readyState === 1
          ? "connected"
          : "disconnected",
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }
  );
});