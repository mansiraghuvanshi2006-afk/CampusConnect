import { z } from "zod";

const objectIdSchema = z
  .string({
    required_error: "ID is required",
    invalid_type_error: "ID must be a string",
  })
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const academicYearSchema = z.coerce
  .number({
    invalid_type_error: "Academic year must be a number",
  })
  .int("Academic year must be a whole number")
  .min(1, "Academic year must be at least 1")
  .max(10, "Academic year cannot exceed 10");

export const conversationIdParamsSchema = z
  .object({
    conversationId: objectIdSchema,
  })
  .strict();

export const memberParamsSchema = z
  .object({
    conversationId: objectIdSchema,
    userId: objectIdSchema,
  })
  .strict();

export const createDirectConversationSchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const createGroupConversationSchema = z
  .object({
    name: z
      .string({
        required_error: "Group name is required",
      })
      .trim()
      .min(2, "Group name must contain at least 2 characters")
      .max(120, "Group name cannot exceed 120 characters"),

    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .nullable(),

    type: z
      .enum(["teacher_group", "official_group", "announcement"])
      .optional(),

    department: objectIdSchema.optional().nullable(),

    academicYears: z
      .array(academicYearSchema)
      .default([]),

    memberIds: z
      .array(objectIdSchema)
      .default([]),

    adminIds: z
      .array(objectIdSchema)
      .default([]),

    image: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable(),

    onlyAdminsCanSend: z.boolean().optional(),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .optional(),

    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable(),

    image: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable(),

    onlyAdminsCanSend: z.boolean().optional(),

    isActive: z.boolean().optional(),

    academicYears: z
      .array(academicYearSchema)
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

export const sendMessageSchema = z
  .object({
    text: z
      .string({
        required_error: "Message text is required",
      })
      .trim()
      .min(1, "Message text is required")
      .max(5000, "Message text cannot exceed 5000 characters"),

    temporaryId: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable(),

    replyTo: objectIdSchema.optional().nullable(),
  })
  .strict();

export const addMembersSchema = z
  .object({
    memberIds: z
      .array(objectIdSchema)
      .min(1, "At least one member ID is required"),
  })
  .strict();

export const markReadSchema = z
  .object({
    messageIds: z
      .array(objectIdSchema)
      .optional()
      .nullable(),
  })
  .strict();
