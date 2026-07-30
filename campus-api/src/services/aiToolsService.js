import User, { USER_ROLES } from "../models/User.js";
import Department from "../models/Department.js";
import Conversation from "../models/Conversation.js";
import AiToolAuditLog from "../models/AiToolAuditLog.js";
import ApiError from "../utils/ApiError.js";
import { getEligibleChatUsers } from "./chatPolicyService.js";
import { serializeMyProfile } from "../utils/profileSerializers.js";

const MAX_TOOL_CALLS = Number.parseInt(
  process.env.AI_MAX_TOOL_CALLS || "5",
  10
);

const safeUserSummary = (user) => ({
  id: user._id?.toString() || String(user.id || ""),
  name: user.name,
  role: user.role,
  department:
    user.department && typeof user.department === "object"
      ? user.department.name || null
      : null,
  year: user.year ?? null,
  teachingYears: user.teachingYears || [],
});

const auditTool = async ({
  user,
  conversationId,
  toolName,
  success,
  denialReason = null,
  summary = "",
  durationMs = 0,
  ipAddress = null,
}) => {
  try {
    await AiToolAuditLog.create({
      user: user._id,
      conversation: conversationId || null,
      toolName,
      success,
      denialReason,
      summary: String(summary).slice(0, 500),
      durationMs,
      ipAddress,
    });
  } catch {
    // Audit failures must not break AI responses.
  }
};

const TOOL_HANDLERS = {
  async getMyProfile({ user }) {
    const populated = await User.findById(user._id)
      .populate("department", "name code")
      .select(
        "name email role bio phone avatarUrl department year teachingYears qualification experience specialization office designation"
      );

    const profile = serializeMyProfile(populated || user);

    return {
      name: profile.name,
      role: profile.role,
      department: profile.department?.name || null,
      year: profile.year,
      teachingYears: profile.teachingYears,
      bio: profile.bio,
      qualification: profile.qualification,
      specialization: profile.specialization,
      designation: profile.designation,
    };
  },

  async getMyGroups({ user }) {
    const conversations = await Conversation.find({
      isActive: true,
      type: { $ne: "direct" },
      members: {
        $elemMatch: {
          user: user._id,
          isActive: true,
        },
      },
    })
      .select("name type groupType members lastMessageAt")
      .sort({ lastMessageAt: -1 })
      .limit(25)
      .lean();

    return {
      count: conversations.length,
      groups: conversations.map((conversation) => ({
        id: conversation._id.toString(),
        name: conversation.name,
        type: conversation.type,
        groupType: conversation.groupType,
        memberCount: (conversation.members || []).filter(
          (member) => member.isActive
        ).length,
      })),
    };
  },

  async getDepartmentSummary({ user }) {
    if (!user.department) {
      return { message: "You are not assigned to a department." };
    }

    const department = await Department.findById(user.department)
      .select("name code isActive")
      .lean();

    if (!department) {
      return { message: "Department not found." };
    }

    const [studentCount, teacherCount] = await Promise.all([
      User.countDocuments({
        role: USER_ROLES.STUDENT,
        department: department._id,
        isActive: true,
        isEmailVerified: true,
      }),
      User.countDocuments({
        role: USER_ROLES.TEACHER,
        department: department._id,
        isActive: true,
        teacherApprovalStatus: "approved",
      }),
    ]);

    return {
      department: {
        name: department.name,
        code: department.code,
        isActive: department.isActive,
      },
      studentCount,
      teacherCount,
      yourRole: user.role,
      yourYear: user.year ?? null,
    };
  },

  async getYearSummary({ user }) {
    if (user.role === USER_ROLES.STUDENT) {
      if (!user.year || !user.department) {
        return {
          message: "Your academic year or department is not set.",
        };
      }

      const peers = await User.countDocuments({
        role: USER_ROLES.STUDENT,
        department: user.department,
        year: user.year,
        isActive: true,
        isEmailVerified: true,
      });

      return {
        year: user.year,
        peerStudentCount: peers,
      };
    }

    if (user.role === USER_ROLES.TEACHER) {
      const years = user.teachingYears || [];

      if (years.length === 0) {
        return { message: "You have no assigned teaching years." };
      }

      const counts = await Promise.all(
        years.map(async (year) => ({
          year,
          studentCount: await User.countDocuments({
            role: USER_ROLES.STUDENT,
            department: user.department,
            year,
            isActive: true,
            isEmailVerified: true,
          }),
        }))
      );

      return { teachingYears: counts };
    }

    if (user.role === USER_ROLES.ADMIN) {
      const pipeline = await User.aggregate([
        {
          $match: {
            role: USER_ROLES.STUDENT,
            isActive: true,
            year: { $ne: null },
          },
        },
        { $group: { _id: "$year", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      return {
        years: pipeline.map((row) => ({
          year: row._id,
          studentCount: row.count,
        })),
      };
    }

    throw new ApiError(403, "Year summary is not available for your role");
  },

  async searchAuthorizedUsers({ user, args = {} }) {
    const search = String(args.query || args.search || "").trim().slice(0, 80);
    const role = args.role || undefined;

    const result = await getEligibleChatUsers(user, {
      search: search || undefined,
      role,
      page: 1,
      limit: 15,
    });

    return {
      count: result.users.length,
      users: result.users.map(safeUserSummary),
      pagination: result.pagination,
    };
  },

  async getGroupSummary({ user, args = {} }) {
    const groupId = args.groupId || args.id;

    if (!groupId) {
      const conversations = await Conversation.find({
        isActive: true,
        type: { $ne: "direct" },
        members: {
          $elemMatch: { user: user._id, isActive: true },
        },
      })
        .select("name type members")
        .limit(10)
        .lean();

      return {
        groups: conversations.map((conversation) => ({
          id: conversation._id.toString(),
          name: conversation.name,
          type: conversation.type,
          memberCount: (conversation.members || []).filter(
            (member) => member.isActive
          ).length,
        })),
      };
    }

    const conversation = await Conversation.findOne({
      _id: groupId,
      isActive: true,
      type: { $ne: "direct" },
      members: {
        $elemMatch: { user: user._id, isActive: true },
      },
    })
      .select("name type groupType description members onlyAdminsCanSend")
      .lean();

    if (!conversation) {
      throw new ApiError(404, "Group not found or not accessible");
    }

    const activeMembers = (conversation.members || []).filter(
      (member) => member.isActive
    );

    return {
      id: conversation._id.toString(),
      name: conversation.name,
      type: conversation.type,
      groupType: conversation.groupType,
      description: conversation.description || "",
      memberCount: activeMembers.length,
      onlyAdminsCanSend: Boolean(conversation.onlyAdminsCanSend),
    };
  },

  async getUnreadSummary({ user }) {
    const conversations = await Conversation.find({
      isActive: true,
      members: {
        $elemMatch: {
          user: user._id,
          isActive: true,
          unreadCount: { $gt: 0 },
        },
      },
    })
      .select("name type members")
      .limit(20)
      .lean();

    const items = conversations.map((conversation) => {
      const membership = (conversation.members || []).find(
        (member) =>
          member.isActive &&
          String(member.user) === String(user._id)
      );

      return {
        id: conversation._id.toString(),
        name: conversation.name || "Direct chat",
        type: conversation.type,
        unreadCount: membership?.unreadCount || 0,
      };
    });

    const totalUnread = items.reduce(
      (sum, item) => sum + item.unreadCount,
      0
    );

    return {
      totalUnread,
      conversations: items,
    };
  },

  async getPlatformSummary({ user }) {
    if (user.role !== USER_ROLES.ADMIN) {
      throw new ApiError(
        403,
        "Platform statistics are only available to administrators"
      );
    }

    const [
      studentCount,
      teacherCount,
      adminCount,
      activeUsers,
      pendingTeachers,
      departmentCount,
      groupCount,
      directCount,
    ] = await Promise.all([
      User.countDocuments({ role: USER_ROLES.STUDENT }),
      User.countDocuments({ role: USER_ROLES.TEACHER }),
      User.countDocuments({ role: USER_ROLES.ADMIN }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({
        role: USER_ROLES.TEACHER,
        teacherApprovalStatus: "pending",
      }),
      Department.countDocuments({ isActive: true }),
      Conversation.countDocuments({
        isActive: true,
        type: { $ne: "direct" },
      }),
      Conversation.countDocuments({
        isActive: true,
        type: "direct",
      }),
    ]);

    return {
      students: studentCount,
      teachers: teacherCount,
      admins: adminCount,
      activeUsers,
      pendingTeachers,
      departments: departmentCount,
      groups: groupCount,
      directChats: directCount,
    };
  },
};

/**
 * Role-based tool allowlist. Gemini cannot invent tools
 * outside this set, and each call is audited.
 */
export const ROLE_TOOL_ALLOWLIST = Object.freeze({
  [USER_ROLES.STUDENT]: Object.freeze([
    "getMyProfile",
    "getMyGroups",
    "getDepartmentSummary",
    "getYearSummary",
    "searchAuthorizedUsers",
    "getGroupSummary",
    "getUnreadSummary",
  ]),
  [USER_ROLES.TEACHER]: Object.freeze([
    "getMyProfile",
    "getMyGroups",
    "getDepartmentSummary",
    "getYearSummary",
    "searchAuthorizedUsers",
    "getGroupSummary",
    "getUnreadSummary",
  ]),
  [USER_ROLES.ADMIN]: Object.freeze([
    "getMyProfile",
    "getMyGroups",
    "getDepartmentSummary",
    "getYearSummary",
    "searchAuthorizedUsers",
    "getGroupSummary",
    "getUnreadSummary",
    "getPlatformSummary",
  ]),
});

export const runCampusTools = async ({
  user,
  toolNames = [],
  argsByTool = {},
  conversationId = null,
  ipAddress = null,
}) => {
  const allowlist = ROLE_TOOL_ALLOWLIST[user.role] || [];
  const uniqueTools = [...new Set(toolNames)].slice(
    0,
    Number.isFinite(MAX_TOOL_CALLS) && MAX_TOOL_CALLS > 0
      ? MAX_TOOL_CALLS
      : 5
  );

  const results = [];
  const usage = [];

  for (const toolName of uniqueTools) {
    const started = Date.now();

    if (!allowlist.includes(toolName)) {
      await auditTool({
        user,
        conversationId,
        toolName,
        success: false,
        denialReason: "role_not_allowed",
        summary: `Denied ${toolName} for role ${user.role}`,
        durationMs: Date.now() - started,
        ipAddress,
      });

      usage.push({
        name: toolName,
        success: false,
        durationMs: Date.now() - started,
      });

      continue;
    }

    const handler = TOOL_HANDLERS[toolName];

    if (!handler) {
      usage.push({
        name: toolName,
        success: false,
        durationMs: Date.now() - started,
      });
      continue;
    }

    try {
      const data = await handler({
        user,
        args: argsByTool[toolName] || {},
      });

      const durationMs = Date.now() - started;

      await auditTool({
        user,
        conversationId,
        toolName,
        success: true,
        summary: `Executed ${toolName}`,
        durationMs,
        ipAddress,
      });

      results.push({ toolName, data });
      usage.push({ name: toolName, success: true, durationMs });
    } catch (error) {
      const durationMs = Date.now() - started;

      await auditTool({
        user,
        conversationId,
        toolName,
        success: false,
        denialReason: error?.message?.slice(0, 200) || "tool_error",
        summary: `Failed ${toolName}`,
        durationMs,
        ipAddress,
      });

      results.push({
        toolName,
        error: error?.message || "Tool failed",
      });
      usage.push({ name: toolName, success: false, durationMs });
    }
  }

  return { results, usage };
};

/**
 * Convert tool results into a safe context string for Gemini.
 * Never includes passwords, tokens or raw documents.
 */
export const formatToolContextForPrompt = (toolResults = []) => {
  if (!toolResults.length) {
    return "";
  }

  return toolResults
    .map((entry) => {
      if (entry.error) {
        return `Tool ${entry.toolName} failed: ${entry.error}`;
      }

      return `Tool ${entry.toolName} result:\n${JSON.stringify(entry.data, null, 2)}`;
    })
    .join("\n\n");
};
