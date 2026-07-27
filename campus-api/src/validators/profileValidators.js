import { z } from "zod";

import {
  ACADEMIC_YEARS,
  DEPARTMENTS,
} from "../models/User.js";

const departmentSchema = z.enum(
  Object.values(DEPARTMENTS),
  {
    required_error:
      "Department is required",
    invalid_type_error:
      "Department must be a string",
  }
);

const academicYearSchema = z
  .number({
    required_error:
      "Academic year is required",
    invalid_type_error:
      "Academic year must be a number",
  })
  .int(
    "Academic year must be an integer"
  )
  .refine(
    (year) =>
      Object.values(
        ACADEMIC_YEARS
      ).includes(year),
    {
      message:
        "Invalid academic year",
    }
  );

/**
 * PATCH /api/v1/profile/student
 */
export const studentProfileSchema = z
  .object({
    department:
      departmentSchema,

    year:
      academicYearSchema,
  })
  .strict();

/**
 * PATCH /api/v1/profile/teacher
 */
export const teacherProfileSchema = z
  .object({
    department:
      departmentSchema,

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
        4,
        "You cannot select more than four teaching years"
      )
      .transform((years) => [
        ...new Set(years),
      ]),
  })
  .strict();