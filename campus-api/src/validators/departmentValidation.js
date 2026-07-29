import { z } from "zod";

const departmentNameSchema = z
  .string({
    required_error: "Department name is required",
  })
  .trim()
  .min(2, "Department name must contain at least 2 characters")
  .max(100, "Department name cannot exceed 100 characters");

const departmentCodeSchema = z
  .string({
    required_error: "Department code is required",
  })
  .trim()
  .min(2, "Department code must contain at least 2 characters")
  .max(20, "Department code cannot exceed 20 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Department code can only contain letters, numbers, hyphens and underscores"
  )
  .transform((value) => value.toUpperCase());

const departmentDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Department description cannot exceed 500 characters");

const durationInYearsSchema = z.coerce
  .number({
    required_error: "Department duration is required",
    invalid_type_error: "Department duration must be a number",
  })
  .int("Department duration must be a whole number")
  .min(1, "Department duration must be at least 1 year")
  .max(10, "Department duration cannot exceed 10 years");

export const createDepartmentSchema = z.object({
  name: departmentNameSchema,

  code: departmentCodeSchema,

  description: departmentDescriptionSchema.optional().default(""),

  durationInYears: durationInYearsSchema,

  isActive: z.boolean().optional().default(true),
});

export const updateDepartmentSchema = z
  .object({
    name: departmentNameSchema.optional(),

    code: departmentCodeSchema.optional(),

    description: departmentDescriptionSchema.optional(),

    durationInYears: durationInYearsSchema.optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });