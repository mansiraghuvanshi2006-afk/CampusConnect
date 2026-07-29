import mongoose from "mongoose";

/**
 * Concurrency-safe delivery/read receipts.
 * This collection is the only authoritative receipt store.
 */
const messageReceiptSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    seenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

messageReceiptSchema.index(
  { message: 1, user: 1 },
  { unique: true }
);

messageReceiptSchema.index({
  conversation: 1,
  user: 1,
});

messageReceiptSchema.index({
  conversation: 1,
  seenAt: 1,
});

const MessageReceipt = mongoose.model(
  "MessageReceipt",
  messageReceiptSchema
);

export default MessageReceipt;
