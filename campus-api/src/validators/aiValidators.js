import { z } from "zod";

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const createAiConversationSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
  })
  .strict();

export const renameAiConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
  })
  .strict();

export const sendAiMessageSchema = z
  .object({
    prompt: z
      .string({
        required_error: "Prompt is required",
      })
      .trim()
      .min(1, "Prompt is required")
      .max(
        Number.parseInt(process.env.AI_MAX_PROMPT_LENGTH || "8000", 10) ||
          8000
      ),
    stream: z.boolean().optional().default(true),
  })
  .strict();

export const editAiPromptSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(
        Number.parseInt(process.env.AI_MAX_PROMPT_LENGTH || "8000", 10) ||
          8000
      ),
  })
  .strict();

export const aiAutocompleteSchema = z
  .object({
    query: z.string().trim().min(2).max(120),
    includeAi: z.boolean().optional().default(false),
  })
  .strict();

export const aiConversationIdParamsSchema = z
  .object({
    conversationId: objectId,
  })
  .strict();

export const aiMessageIdParamsSchema = z
  .object({
    conversationId: objectId,
    messageId: objectId,
  })
  .strict();

export const aiSearchQuerySchema = z
  .object({
    search: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

/**
 * Cursor pagination for AI messages.
 * Loads newest page by default when `before` is omitted;
 * use `before` to fetch older messages.
 */
export const aiMessagesQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(30),
    before: objectId.optional(),
  })
  .strict();
