import mongoose from "mongoose";

/**
 * Audit log for Campus AI backend tool invocations.
 * Never stores secrets, passwords, tokens or raw Mongo documents.
 */
const aiToolAuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiConversation",
      default: null,
    },

    toolName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    success: {
      type: Boolean,
      required: true,
    },

    denialReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    /**
     * Safe summary only — never full tool payloads.
     */
    summary: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiToolAuditLogSchema.index({ user: 1, createdAt: -1 });
aiToolAuditLogSchema.index({ conversation: 1, createdAt: -1 });
aiToolAuditLogSchema.index({ toolName: 1, createdAt: -1 });

const retentionDays = Number.parseInt(
  process.env.AI_TOOL_AUDIT_RETENTION_DAYS || "0",
  10
);

if (Number.isFinite(retentionDays) && retentionDays > 0) {
  aiToolAuditLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: retentionDays * 24 * 60 * 60 }
  );
}

const AiToolAuditLog = mongoose.model(
  "AiToolAuditLog",
  aiToolAuditLogSchema
);

export default AiToolAuditLog;
