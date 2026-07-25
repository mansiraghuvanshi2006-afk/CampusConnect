import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },

    deviceName: {
      type: String,
      default: "Unknown device",
    },

    userAgent: {
      type: String,
      default: "Unknown device",
    },

    ipAddress: {
      type: String,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

sessionSchema.index({
  user: 1,
  sessionId: 1,
});

const Session = mongoose.model("Session", sessionSchema);

export default Session;