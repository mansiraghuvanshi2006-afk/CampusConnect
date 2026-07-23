import { sendSuccess } from "../utils/apiResponse.js";
import messages from "../constants/messages.js";

export const getHealth = (req, res) => {
  sendSuccess(res, 200, messages.SERVER_RUNNING, { uptime: process.uptime() });
};