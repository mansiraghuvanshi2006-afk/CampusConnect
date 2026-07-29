import mongoose from "mongoose";

export const MESSAGE_TYPES = Object.freeze({
  TEXT: "text",
  SYSTEM: "system",
});

/*
  DEPRECATED embedded receipt subdocuments.

  Delivery and read state now live exclusively in MessageReceipt.
  These fields remain on the schema only for backward compatibility
  with existing documents. They must not be written to or used as
  an authoritative source.
*/
const deprecatedReceiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deliveredAt: {
      type: Date,
    },
  },
  { _id: false }
);

const deprecatedSeenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    seenAt: {
      type: Date,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation is required"],
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
    },

    type: {
      type: String,
      enum: {
        values: Object.values(MESSAGE_TYPES),
        message: "Invalid message type",
      },
      default: MESSAGE_TYPES.TEXT,
    },

    text: {
      type: String,
      trim: true,
      maxlength: [
        5000,
        "Message text cannot exceed 5000 characters",
      ],
      default: null,
    },

    temporaryId: {
      type: String,
      trim: true,
      default: null,
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    /* @deprecated — use MessageReceipt */
    deliveredTo: {
      type: [deprecatedReceiptSchema],
      default: [],
      select: false,
    },

    /* @deprecated — use MessageReceipt */
    seenBy: {
      type: [deprecatedSeenSchema],
      default: [],
      select: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    deletedForEveryoneAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

messageSchema.pre("validate", function () {
  if (this.type === MESSAGE_TYPES.TEXT) {
    if (!this.text || !String(this.text).trim()) {
      this.invalidate(
        "text",
        "A text message must contain non-empty text"
      );
    }
  }
});

messageSchema.index({
  conversation: 1,
  createdAt: -1,
  _id: -1,
});

messageSchema.index(
  {
    sender: 1,
    temporaryId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      temporaryId: { $type: "string" },
    },
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
