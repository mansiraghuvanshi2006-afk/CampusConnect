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

const objectIdSchema = z
  .string({
    required_error: "ID is required",
    invalid_type_error:
      "ID must be a string",
  })
  .trim()
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid ID"
  );

const userNameSchema = z
  .string({
    required_error: "Full name is required",
    invalid_type_error:
      "Full name must be a string",
  })
  .trim()
  .min(
    2,
    "Full name must contain at least 2 characters"
  )
  .max(
    100,
    "Full name cannot exceed 100 characters"
  );

const userEmailSchema = z
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

/**
 * Temporary passwords follow the same strength rules
 * as self-registration.
 */
const temporaryPasswordSchema = z
  .string({
    required_error:
      "Temporary password is required",
    invalid_type_error:
      "Temporary password must be a string",
  })
  .min(
    8,
    "Temporary password must contain at least 8 characters"
  )
  .max(
    128,
    "Temporary password cannot exceed 128 characters"
  )
  .regex(
    /[a-z]/,
    "Temporary password must contain a lowercase letter"
  )
  .regex(
    /[A-Z]/,
    "Temporary password must contain an uppercase letter"
  )
  .regex(
    /[0-9]/,
    "Temporary password must contain a number"
  );

const academicYearNumberSchema = z.coerce
  .number({
    invalid_type_error:
      "Academic year must be a number",
  })
  .int(
    "Academic year must be a whole number"
  )
  .min(
    1,
    "Academic year must be at least 1"
  )
  .max(
    10,
    "Academic year cannot exceed 10"
  );

/**
 * Validates:
 * /users/:id
 * /users/:id/status
 * /users/:id/reset-password
 */
export const userIdParamsSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

/**
 * POST /api/v1/admin/users
 *
 * Role decides which profile fields are required.
 * Verification, onboarding, approval and password-change
 * state are always set by the server.
 */
export const createUserSchema = z
  .discriminatedUnion("role", [
    z
      .object({
        role: z.literal("student"),
        name: userNameSchema,
        email: userEmailSchema,
        temporaryPassword:
          temporaryPasswordSchema,
        department: objectIdSchema,
        year: academicYearNumberSchema,
        isActive: z
          .boolean()
          .default(true),
      })
      .strict(),

    z
      .object({
        role: z.literal("teacher"),
        name: userNameSchema,
        email: userEmailSchema,
        temporaryPassword:
          temporaryPasswordSchema,
        department: objectIdSchema,
        teachingYears: z
          .array(
            academicYearNumberSchema
          )
          .min(
            1,
            "Select at least one assigned academic year"
          )
          .max(
            10,
            "Too many assigned academic years"
          ),
        isActive: z
          .boolean()
          .default(true),
      })
      .strict(),

    z
      .object({
        role: z.literal("admin"),
        name: userNameSchema,
        email: userEmailSchema,
        temporaryPassword:
          temporaryPasswordSchema,
        isActive: z
          .boolean()
          .default(true),
      })
      .strict(),
  ]);

/**
 * PATCH /api/v1/admin/users/:id
 */
export const updateUserSchema = z
  .object({
    name: userNameSchema.optional(),

    email: userEmailSchema.optional(),

    role: z
      .enum(
        ["student", "teacher", "admin"],
        {
          invalid_type_error:
            "Invalid user role",
        }
      )
      .optional(),

    department: objectIdSchema
      .nullable()
      .optional(),

    year: academicYearNumberSchema
      .nullable()
      .optional(),

    teachingYears: z
      .array(academicYearNumberSchema)
      .max(
        10,
        "Too many assigned academic years"
      )
      .optional(),

    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one field must be provided",
    }
  );

/**
 * PATCH /api/v1/admin/users/:id/status
 */
export const updateUserStatusSchema = z
  .object({
    isActive: z.boolean({
      required_error:
        "isActive is required",
      invalid_type_error:
        "isActive must be true or false",
    }),
  })
  .strict();

/**
 * PATCH /api/v1/admin/users/:id/reset-password
 */
export const resetUserPasswordSchema = z
  .object({
    temporaryPassword:
      temporaryPasswordSchema,
  })
  .strict();

/**
 * DELETE /api/v1/admin/users/:id
 */
export const deleteUserSchema = z
  .object({
    confirmation: z
      .string({
        invalid_type_error:
          'Type "DELETE" to confirm permanent deletion',
      })
      .refine(
        (value) => value === "DELETE",
        {
          message:
            'Type "DELETE" to confirm permanent deletion',
        }
      ),
  })
  .strict();