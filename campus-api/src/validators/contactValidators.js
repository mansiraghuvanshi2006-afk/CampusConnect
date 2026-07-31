import { z } from "zod";

export const contactFormSchema = z.object({
  name: z
    .string({
      required_error: "Name is required",
    })
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),

  email: z
    .string({
      required_error: "Email is required",
    })
    .trim()
    .email("Please provide a valid email address")
    .transform((value) => value.toLowerCase()),

  subject: z
    .string({
      required_error: "Subject is required",
    })
    .trim()
    .min(3, "Subject must contain at least 3 characters")
    .max(200, "Subject cannot exceed 200 characters"),

  message: z
    .string({
      required_error: "Message is required",
    })
    .trim()
    .min(10, "Message must contain at least 10 characters")
    .max(5000, "Message cannot exceed 5000 characters"),
});
