import mongoose from "mongoose";

export const MESSAGE_TYPES = Object.freeze({
  TEXT: "text",
  SYSTEM: "system",
  IMAGE: "image",
  FILE: "file",
  VOICE: "voice",
  CALL: "call",
});

export const ALLOWED_REACTIONS = Object.freeze([
  "👍",
  "❤️",
  "😂",
  "🔥",
  "👏",
  "😢",
  "🎉",
  "😮",
]);

export const MESSAGE_EDIT_WINDOW_MS = Number(
  process.env.MESSAGE_EDIT_WINDOW_MS || 15 * 60 * 1000
);

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

const attachmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    waveForm: {
      type: [Number],
      default: undefined,
    },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      enum: ALLOWED_REACTIONS,
    },
    reactedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const editHistorySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    editedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const forwardedFromSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderName: {
      type: String,
      default: null,
    },
    text: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const voiceSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    mimeType: {
      type: String,
      default: "audio/webm",
    },
    size: {
      type: Number,
      default: 0,
    },
    waveForm: {
      type: [Number],
      default: [],
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

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    voice: {
      type: voiceSchema,
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

    edited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    editHistory: {
      type: [editHistorySchema],
      default: [],
    },

    deletedFor: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    deletedForEveryone: {
      type: Boolean,
      default: false,
    },

    deletedForEveryoneAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    forwardedFrom: {
      type: forwardedFromSchema,
      default: null,
    },

    reactions: {
      type: [reactionSchema],
      default: [],
    },

    mentions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    pinned: {
      type: Boolean,
      default: false,
    },

    pinnedAt: {
      type: Date,
      default: null,
    },

    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    linkPreview: {
      type: {
        url: String,
        title: String,
        description: String,
        image: String,
        siteName: String,
      },
      default: null,
    },

    callMeta: {
      type: {
        callId: String,
        callType: String,
        status: String,
        duration: Number,
      },
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

  if (this.type === MESSAGE_TYPES.VOICE && !this.voice?.url) {
    this.invalidate("voice", "Voice message requires audio data");
  }

  if (
    (this.type === MESSAGE_TYPES.IMAGE ||
      this.type === MESSAGE_TYPES.FILE) &&
    (!this.attachments || this.attachments.length === 0)
  ) {
    this.invalidate(
      "attachments",
      "Attachment message requires at least one file"
    );
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

messageSchema.index({
  conversation: 1,
  pinned: 1,
  pinnedAt: -1,
});

messageSchema.index({
  text: "text",
  "attachments.originalName": "text",
});

messageSchema.index({
  conversation: 1,
  "attachments.mimeType": 1,
});

messageSchema.index({
  conversation: 1,
  sender: 1,
  createdAt: -1,
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
