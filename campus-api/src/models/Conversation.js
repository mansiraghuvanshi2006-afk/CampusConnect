import mongoose from "mongoose";

export const CONVERSATION_TYPES = Object.freeze({
  DIRECT: "direct",
  TEACHER_GROUP: "teacher_group",
  OFFICIAL_GROUP: "official_group",
  ANNOUNCEMENT: "announcement",
});

export const CONVERSATION_MEMBER_ROLES = Object.freeze({
  MEMBER: "member",
  ADMIN: "admin",
});

const conversationMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    role: {
      type: String,
      enum: {
        values: Object.values(CONVERSATION_MEMBER_ROLES),
        message: "Invalid conversation member role",
      },
      default: CONVERSATION_MEMBER_ROLES.MEMBER,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastReadAt: {
      type: Date,
      default: null,
    },

    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: Object.values(CONVERSATION_TYPES),
        message: "Invalid conversation type",
      },
      required: [true, "Conversation type is required"],
    },

    name: {
      type: String,
      trim: true,
      maxlength: [120, "Conversation name cannot exceed 120 characters"],
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Conversation description cannot exceed 500 characters",
      ],
      default: null,
    },

    image: {
      type: String,
      default: null,
    },

    members: {
      type: [conversationMemberSchema],
      default: [],
    },

    /*
      Sorted "userIdA:userIdB" key used to prevent
      duplicate direct conversations between the same pair.
    */
    directKey: {
      type: String,
      default: null,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Conversation creator is required"],
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    academicYears: {
      type: [
        {
          type: Number,
          min: 1,
          max: 10,
        },
      ],
      default: [],
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    onlyAdminsCanSend: {
      type: Boolean,
      default: false,
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

conversationSchema.pre("validate", function () {
  if (this.type === CONVERSATION_TYPES.DIRECT) {
    const activeMembers = (this.members || []).filter(
      (member) => member.isActive
    );

    if (activeMembers.length !== 2) {
      this.invalidate(
        "members",
        "A direct conversation must contain exactly two active members"
      );
    }

    if (!this.directKey && activeMembers.length === 2) {
      const ids = activeMembers
        .map((member) => member.user.toString())
        .sort();

      this.directKey = `${ids[0]}:${ids[1]}`;
    }

    return;
  }

  if (!this.name || !String(this.name).trim()) {
    this.invalidate(
      "name",
      "Group conversations must have a name"
    );
  }
});

conversationSchema.index(
  { directKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: CONVERSATION_TYPES.DIRECT,
      directKey: { $type: "string" },
      isActive: true,
    },
  }
);

conversationSchema.index({
  "members.user": 1,
  isActive: 1,
  lastMessageAt: -1,
});

conversationSchema.index({
  lastMessageAt: -1,
  createdAt: -1,
});

conversationSchema.index({
  department: 1,
  type: 1,
  isActive: 1,
});

export const buildDirectKey = (userIdA, userIdB) => {
  const ids = [userIdA.toString(), userIdB.toString()].sort();
  return `${ids[0]}:${ids[1]}`;
};

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

export default Conversation;
