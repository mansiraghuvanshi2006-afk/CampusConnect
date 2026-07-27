import { z } from "zod";

const mongoIdSchema = z
  .string({
    required_error: "Teacher ID is required",
    invalid_type_error:
      "Teacher ID must be a string",
  })
  .trim()
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Teacher ID is invalid"
  );

/**
 * Validates:
 * /teachers/:id/approve
 * /teachers/:id/reject
 */
export const teacherIdParamsSchema = z
  .object({
    id: mongoIdSchema,
  })
  .strict();

/**
 * Validates the rejection request body.
 */
export const rejectTeacherSchema = z
  .object({
    reason: z
      .string({
        required_error:
          "Rejection reason is required",
        invalid_type_error:
          "Rejection reason must be a string",
      })
      .trim()
      .min(
        3,
        "Rejection reason must contain at least 3 characters"
      )
      .max(
        500,
        "Rejection reason cannot exceed 500 characters"
      ),
  })
  .strict();