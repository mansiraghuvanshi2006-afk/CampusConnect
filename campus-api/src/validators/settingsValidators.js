import { z } from "zod";

const socialLinksSchema = z
  .object({
    linkedin: z.string().trim().max(300).optional(),
    github: z.string().trim().max(300).optional(),
    twitter: z.string().trim().max(300).optional(),
    website: z.string().trim().max(300).optional(),
  })
  .strict()
  .optional();

/**
 * PATCH /profile/me — role-specific fields are enforced in
 * profileService allowlists; zod only validates shape/length.
 */
export const updateMyProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(30).optional(),
    dob: z.union([z.string().datetime({ offset: true }), z.string().date(), z.null()]).optional(),
    gender: z
      .enum(["male", "female", "other", "prefer_not_to_say", ""])
      .optional(),
    address: z.string().trim().max(300).optional(),
    qualification: z.string().trim().max(200).optional(),
    experience: z.string().trim().max(200).optional(),
    specialization: z.string().trim().max(200).optional(),
    office: z.string().trim().max(200).optional(),
    designation: z.string().trim().max(200).optional(),
    socialLinks: socialLinksSchema,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one profile field is required",
  });

export const updateSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light", "system"]).optional(),
    language: z.string().trim().min(2).max(20).optional(),
    notifications: z
      .object({
        chatMessages: z.boolean().optional(),
        groupUpdates: z.boolean().optional(),
        callAlerts: z.boolean().optional(),
        aiUpdates: z.boolean().optional(),
        emailDigest: z.boolean().optional(),
      })
      .strict()
      .optional(),
    privacy: z
      .object({
        showOnlineStatus: z.boolean().optional(),
        showLastSeen: z.boolean().optional(),
        showProfileToCampus: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one settings field is required",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        "New password must include upper, lower and a number"
      ),
  })
  .strict();
