import mongoose from "mongoose";

export const AI_MESSAGE_ROLES = Object.freeze({
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
});

export const AI_MODES = Object.freeze({
  GENERAL: "general",
  LIVE_INTERNET: "live_internet",
  CAMPUS: "campus",
});

const citationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    uri: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { _id: false }
);

const toolUsageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    success: {
      type: Boolean,
      default: true,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiConversation",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: Object.values(AI_MESSAGE_ROLES),
      required: true,
    },

    content: {
      type: String,
      required: true,
      maxlength: 50000,
    },

    mode: {
      type: String,
      enum: [...Object.values(AI_MODES), null],
      default: null,
    },

    model: {
      type: String,
      default: null,
    },

    promptTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    completionTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    citations: {
      type: [citationSchema],
      default: [],
    },

    toolsUsed: {
      type: [toolUsageSchema],
      default: [],
    },

    followUpSuggestions: {
      type: [String],
      default: [],
    },

    /**
     * Soft-delete for "delete message".
     */
    isDeleted: {
      type: Boolean,
      default: false,
    },

    /**
     * Regeneration / edit lineage.
     */
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiMessage",
      default: null,
    },

    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiMessage",
      default: null,
    },

    status: {
      type: String,
      enum: ["complete", "aborted", "error"],
      default: "complete",
    },

    errorCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiMessageSchema.index({
  conversation: 1,
  createdAt: 1,
});

aiMessageSchema.index({
  conversation: 1,
  isDeleted: 1,
  createdAt: 1,
});

const AiMessage = mongoose.model("AiMessage", aiMessageSchema);

export default AiMessage;
