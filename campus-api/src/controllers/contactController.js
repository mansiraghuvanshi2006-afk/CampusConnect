import asyncHandler from "../utils/asyncHandler.js";
import { sendContactFormEmail } from "../services/emailService.js";

/**
 * POST /api/v1/contact
 * Public — sends contact form to admin inbox.
 */
export const submitContactForm = asyncHandler(
  async (req, res) => {
    const { name, email, subject, message } = req.body;

    await sendContactFormEmail({
      name,
      email,
      subject,
      message,
    });

    return res.status(200).json({
      success: true,
      message:
        "Your message was sent successfully. We will reply to your email soon.",
      data: null,
    });
  }
);
