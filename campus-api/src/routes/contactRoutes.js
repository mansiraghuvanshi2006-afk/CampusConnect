import express from "express";

import validateRequest from "../middleware/validateRequest.js";
import { contactRateLimiter } from "../middleware/contactRateLimiter.js";
import { submitContactForm } from "../controllers/contactController.js";
import { contactFormSchema } from "../validators/contactValidators.js";

const router = express.Router();

router.post(
  "/",
  contactRateLimiter,
  validateRequest(contactFormSchema),
  submitContactForm
);

export default router;
