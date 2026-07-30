import mongoose from "mongoose";

/**
 * Campus AI conversations are separate from human chat
 * Conversation documents so chat policy, sockets and calls
 * remain untouched.
 */
const aiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "New conversation",
    },

    titleGenerated: {
      type: Boolean,
      default: false,
    },

    /**
     * Gemini Interactions API previous_interaction_id
     * for optional stateful continuation.
     */
    lastInteractionId: {
      type: String,
      default: null,
      select: false,
    },

    model: {
      type: String,
      default: null,
    },

    totalPromptTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCompletionTokens: {
      type: Number,
      default: 0,
      min: 0,
    },

    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

aiConversationSchema.index({
  user: 1,
  updatedAt: -1,
});

aiConversationSchema.index({
  user: 1,
  title: "text",
});

const AiConversation = mongoose.model(
  "AiConversation",
  aiConversationSchema
);

export default AiConversation;
