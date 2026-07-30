import { z } from "zod";

const nameSchema = z
  .string({
    required_error: "Name is required",
    invalid_type_error:
      "Name must be a string",
  })
  .trim()
  .min(
    2,
    "Name must contain at least 2 characters"
  )
  .max(
    100,
    "Name cannot exceed 100 characters"
  );

const emailSchema = z
  .string({
    required_error: "Email is required",
    invalid_type_error:
      "Email must be a string",
  })
  .trim()
  .email(
    "Please provide a valid email address"
  )
  .transform((email) =>
    email.toLowerCase()
  );

const passwordSchema = z
  .string({
    required_error: "Password is required",
    invalid_type_error:
      "Password must be a string",
  })
  .min(
    8,
    "Password must contain at least 8 characters"
  )
  .max(
    128,
    "Password cannot exceed 128 characters"
  )
  .regex(
    /[a-z]/,
    "Password must contain a lowercase letter"
  )
  .regex(
    /[A-Z]/,
    "Password must contain an uppercase letter"
  )
  .regex(
    /[0-9]/,
    "Password must contain a number"
  );

const roleSchema = z
  .enum(["student", "teacher"], {
    invalid_type_error:
      "Role must be a string",
    required_error:
      "Role is required",
  })
  .default("student");

/**
 * POST /api/v1/auth/register
 */
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
  })
  .strict();

/**
 * POST /api/v1/auth/login
 */
export const loginSchema = z
  .object({
    email: emailSchema,

    password: z
      .string({
        required_error:
          "Password is required",
        invalid_type_error:
          "Password must be a string",
      })
      .min(
        1,
        "Password is required"
      )
      .max(
        128,
        "Password cannot exceed 128 characters"
      ),
  })
  .strict();

/**
 * POST /api/v1/auth/verify-email
 */
export const verifyEmailSchema = z
  .object({
    token: z
      .string({
        required_error:
          "Verification token is required",
        invalid_type_error:
          "Verification token must be a string",
      })
      .trim()
      .min(
        1,
        "Verification token is required"
      )
      .max(
        256,
        "Verification token is invalid"
      ),
  })
  .strict();

/**
 * POST /api/v1/auth/resend-verification
 */
export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

/**
 * PATCH /api/v1/auth/change-temporary-password
 *
 * Used by admin-created accounts on first login.
 */
export const changeTemporaryPasswordSchema = z
  .object({
    currentPassword: z
      .string({
        required_error:
          "Current password is required",
        invalid_type_error:
          "Current password must be a string",
      })
      .min(
        1,
        "Current password is required"
      )
      .max(
        128,
        "Current password cannot exceed 128 characters"
      ),

    newPassword: passwordSchema,

    confirmPassword: z
      .string({
        required_error:
          "Password confirmation is required",
        invalid_type_error:
          "Password confirmation must be a string",
      })
      .min(
        1,
        "Password confirmation is required"
      ),
  })
  .strict()
  .refine(
    (data) =>
      data.newPassword ===
      data.confirmPassword,
    {
      message:
        "New password and confirmation do not match",
      path: ["confirmPassword"],
    }
  )
  .refine(
    (data) =>
      data.newPassword !==
      data.currentPassword,
    {
      message:
        "The new password must be different from your temporary password",
      path: ["newPassword"],
    }
  );

/**
 * DELETE /api/v1/auth/sessions/:sessionId
 */
export const sessionIdParamsSchema = z
  .object({
    sessionId: z
      .string({
        required_error:
          "Session ID is required",
        invalid_type_error:
          "Session ID must be a string",
      })
      .trim()
      .min(
        1,
        "Session ID is required"
      )
      .max(
        200,
        "Invalid session ID"
      ),
  })
  .strict();