import mongoose from "mongoose";

export const CALL_TYPES = Object.freeze({
  AUDIO: "audio",
  VIDEO: "video",
});

export const CALL_MODES = Object.freeze({
  DIRECT: "direct",
  GROUP: "group",
});

export const CALL_STATUSES = Object.freeze({
  RINGING: "ringing",
  ACTIVE: "active",
  ENDED: "ended",
  MISSED: "missed",
  REJECTED: "rejected",
  BUSY: "busy",
  FAILED: "failed",
});

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    muted: {
      type: Boolean,
      default: false,
    },
    cameraOff: {
      type: Boolean,
      default: false,
    },
    screenSharing: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["invited", "ringing", "joined", "left", "rejected", "missed", "busy"],
      default: "invited",
    },
  },
  { _id: false }
);

const callSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(CALL_TYPES),
      required: true,
    },

    mode: {
      type: String,
      enum: Object.values(CALL_MODES),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(CALL_STATUSES),
      default: CALL_STATUSES.RINGING,
      index: true,
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callSchema.index({ conversation: 1, isActive: 1, status: 1 });
callSchema.index({ "participants.user": 1, isActive: 1 });

const Call = mongoose.model("Call", callSchema);

export default Call;
