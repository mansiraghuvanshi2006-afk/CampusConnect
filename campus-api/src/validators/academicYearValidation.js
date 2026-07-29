import { z } from "zod";

const yearNumberSchema = z.coerce
  .number({
    required_error: "Year number is required",
    invalid_type_error: "Year number must be a number",
  })
  .int("Year number must be a whole number")
  .min(1, "Year number must be at least 1")
  .max(10, "Year number cannot exceed 10");

const yearNameSchema = z
  .string({
    required_error: "Year name is required",
  })
  .trim()
  .min(2, "Year name must contain at least 2 characters")
  .max(100, "Year name cannot exceed 100 characters");

const sortOrderSchema = z.coerce
  .number({
    invalid_type_error: "Sort order must be a number",
  })
  .int("Sort order must be a whole number")
  .min(1, "Sort order must be at least 1");

export const createAcademicYearSchema = z.object({
  yearNumber: yearNumberSchema,

  name: yearNameSchema.optional(),

  sortOrder: sortOrderSchema.optional(),

  isActive: z.boolean().optional().default(true),
});

export const updateAcademicYearSchema = z
  .object({
    yearNumber: yearNumberSchema.optional(),

    name: yearNameSchema.optional(),

    sortOrder: sortOrderSchema.optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        "At least one field is required for update",
    }
  );