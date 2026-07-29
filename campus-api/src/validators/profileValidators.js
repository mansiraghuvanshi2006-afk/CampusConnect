import { z } from "zod";

const objectIdSchema = z
  .string({
    required_error:
      "Department is required",
    invalid_type_error:
      "Department must be a string",
  })
  .trim()
  .regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid department ID"
  );

const academicYearSchema = z.coerce
  .number({
    required_error:
      "Academic year is required",
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
 * PATCH /api/v1/profile/student
 */
export const studentProfileSchema =
  z
    .object({
      department:
        objectIdSchema,

      year:
        academicYearSchema,
    })
    .strict();

/**
 * PATCH /api/v1/profile/teacher
 */
export const teacherProfileSchema =
  z
    .object({
      department:
        objectIdSchema,

      teachingYears: z
        .array(
          academicYearSchema,
          {
            required_error:
              "Teaching years are required",
            invalid_type_error:
              "Teaching years must be an array",
          }
        )
        .min(
          1,
          "Select at least one teaching year"
        )
        .max(
          10,
          "You cannot select more than ten teaching years"
        )
        .transform((years) => [
          ...new Set(years),
        ]),
    })
    .strict();