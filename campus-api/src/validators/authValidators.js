import { z } from "zod";

const nameSchema = z
  .string({
    required_error: "Name is required",
    invalid_type_error: "Name must be a string",
  })
  .trim()
  .min(2, "Name must contain at least 2 characters")
  .max(100, "Name cannot exceed 100 characters");

const emailSchema = z
  .string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  })
  .trim()
  .email("Please provide a valid email address")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string({
    required_error: "Password is required",
    invalid_type_error: "Password must be a string",
  })
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password cannot exceed 128 characters")
  .regex(
    /[a-z]/,
    "Password must contain a lowercase letter"
  )
  .regex(
    /[A-Z]/,
    "Password must contain an uppercase letter"
  )
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,

    password: z
      .string({
        required_error: "Password is required",
        invalid_type_error: "Password must be a string",
      })
      .min(1, "Password is required")
      .max(128, "Password cannot exceed 128 characters"),
  })
  .strict();

export const sessionIdParamsSchema = z
  .object({
    sessionId: z
      .string({
        required_error: "Session ID is required",
      })
      .trim()
      .min(1, "Session ID is required")
      .max(200, "Invalid session ID"),
  })
  .strict();