import mongoose from "mongoose";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";

import Conversation, {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
} from "../models/Conversation.js";

import ApiError from "../utils/ApiError.js";
import { chatError } from "../utils/chatErrors.js";

const toId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const sameDepartment = (userA, userB) => {
  const deptA = toId(userA?.department);
  const deptB = toId(userB?.department);

  return Boolean(deptA && deptB && deptA === deptB);
};

/**
 * Whether the user may use campus chat at all.
 */
export const canUseChat = (user) => {
  if (!user) {
    return {
      allowed: false,
      message: "Authentication required",
      statusCode: 401,
    };
  }

  if (!user.isEmailVerified) {
    return {
      allowed: false,
      message: "Please verify your email before using chat",
      statusCode: 403,
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      message: "Your account is inactive and cannot use chat",
      statusCode: 403,
    };
  }

  if (user.role === USER_ROLES.ADMIN) {
    return {
      allowed: true,
      message: "Chat access allowed",
      statusCode: 200,
    };
  }

  if (!user.profileCompleted) {
    return {
      allowed: false,
      message: "Please complete your profile before using chat",
      statusCode: 403,
    };
  }

  if (user.role === USER_ROLES.TEACHER) {
    if (
      user.teacherApprovalStatus !==
      TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      return {
        allowed: false,
        message:
          "Only approved teachers can use campus chat",
        statusCode: 403,
      };
    }

    if (!user.department) {
      return {
        allowed: false,
        message:
          "Teacher department is required for chat access",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Chat access allowed",
      statusCode: 200,
    };
  }

  if (user.role === USER_ROLES.STUDENT) {
    if (!user.department || !user.year) {
      return {
        allowed: false,
        message:
          "Student department and academic year are required for chat",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Chat access allowed",
      statusCode: 200,
    };
  }

  return {
    allowed: false,
    message: "You do not have permission to use chat",
    statusCode: 403,
  };
};

export const assertCanUseChat = (user) => {
  const result = canUseChat(user);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }
};

/**
 * Whether currentUser may start a direct chat with targetUser.
 */
export const canStartDirectChat = (currentUser, targetUser) => {
  const actorAccess = canUseChat(currentUser);

  if (!actorAccess.allowed) {
    return actorAccess;
  }

  if (!targetUser || !targetUser.isActive) {
    return {
      allowed: false,
      message: "Target user is not available for chat",
      statusCode: 404,
    };
  }

  if (!targetUser.isEmailVerified) {
    return {
      allowed: false,
      message: "Target user has not verified their email",
      statusCode: 403,
    };
  }

  if (toId(currentUser) === toId(targetUser)) {
    return {
      allowed: false,
      message: "You cannot start a direct chat with yourself",
      statusCode: 400,
    };
  }

  const currentRole = currentUser.role;
  const targetRole = targetUser.role;

  if (currentRole === USER_ROLES.ADMIN) {
    if (
      targetRole === USER_ROLES.TEACHER &&
      targetUser.teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      return {
        allowed: false,
        message: "Only approved teachers can be messaged",
        statusCode: 403,
      };
    }

    if (
      targetRole === USER_ROLES.STUDENT &&
      !targetUser.profileCompleted
    ) {
      return {
        allowed: false,
        message: "Student profile is incomplete",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Direct chat allowed",
      statusCode: 200,
    };
  }

  if (currentRole === USER_ROLES.STUDENT) {
    if (targetRole === USER_ROLES.STUDENT) {
      if (!sameDepartment(currentUser, targetUser)) {
        return {
          allowed: false,
          message:
            "Students can only chat with students from the same department",
          statusCode: 403,
        };
      }

      if (currentUser.year !== targetUser.year) {
        return {
          allowed: false,
          message:
            "Students can only chat with students from the same academic year",
          statusCode: 403,
        };
      }

      if (!targetUser.profileCompleted) {
        return {
          allowed: false,
          message: "Target student has not completed their profile",
          statusCode: 403,
        };
      }

      return {
        allowed: true,
        message: "Direct chat allowed",
        statusCode: 200,
      };
    }

    if (targetRole === USER_ROLES.TEACHER) {
      if (
        targetUser.teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES.APPROVED
      ) {
        return {
          allowed: false,
          message: "Only approved teachers can be messaged",
          statusCode: 403,
        };
      }

      if (!sameDepartment(currentUser, targetUser)) {
        return {
          allowed: false,
          message:
            "Students can only chat with teachers from their department",
          statusCode: 403,
        };
      }

      return {
        allowed: true,
        message: "Direct chat allowed",
        statusCode: 200,
      };
    }

    return {
      allowed: false,
      message: "Students cannot start a direct chat with this user",
      statusCode: 403,
    };
  }

  if (currentRole === USER_ROLES.TEACHER) {
    if (targetRole === USER_ROLES.STUDENT) {
      if (!sameDepartment(currentUser, targetUser)) {
        return {
          allowed: false,
          message:
            "Teachers can only chat with students from their department",
          statusCode: 403,
        };
      }

      if (
        !Array.isArray(currentUser.teachingYears) ||
        !currentUser.teachingYears.includes(targetUser.year)
      ) {
        return {
          allowed: false,
          message:
            "Teachers can only chat with students from their assigned academic years",
          statusCode: 403,
        };
      }

      if (!targetUser.profileCompleted) {
        return {
          allowed: false,
          message: "Target student has not completed their profile",
          statusCode: 403,
        };
      }

      return {
        allowed: true,
        message: "Direct chat allowed",
        statusCode: 200,
      };
    }

    if (targetRole === USER_ROLES.TEACHER) {
      if (
        targetUser.teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES.APPROVED
      ) {
        return {
          allowed: false,
          message: "Only approved teachers can be messaged",
          statusCode: 403,
        };
      }

      if (!sameDepartment(currentUser, targetUser)) {
        return {
          allowed: false,
          message:
            "Teachers can only chat with teachers from the same department",
          statusCode: 403,
        };
      }

      return {
        allowed: true,
        message: "Direct chat allowed",
        statusCode: 200,
      };
    }

    return {
      allowed: false,
      message: "Teachers cannot start a direct chat with this user",
      statusCode: 403,
    };
  }

  return {
    allowed: false,
    message: "You cannot start a direct chat with this user",
    statusCode: 403,
  };
};

export const assertCanStartDirectChat = (
  currentUser,
  targetUser
) => {
  const result = canStartDirectChat(currentUser, targetUser);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }
};

export const canCreateGroup = (user, type) => {
  const access = canUseChat(user);

  if (!access.allowed) {
    return access;
  }

  if (user.role === USER_ROLES.ADMIN) {
    if (
      type &&
      ![
        CONVERSATION_TYPES.OFFICIAL_GROUP,
        CONVERSATION_TYPES.ANNOUNCEMENT,
      ].includes(type)
    ) {
      return {
        allowed: false,
        message:
          "Admins may only create official or announcement groups",
        statusCode: 400,
      };
    }

    return {
      allowed: true,
      message: "Group creation allowed",
      statusCode: 200,
    };
  }

  if (user.role === USER_ROLES.TEACHER) {
    if (type && type !== CONVERSATION_TYPES.TEACHER_GROUP) {
      return {
        allowed: false,
        message: "Teachers may only create teacher groups",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Group creation allowed",
      statusCode: 200,
    };
  }

  return {
    allowed: false,
    message: "Students cannot create groups",
    statusCode: 403,
  };
};

export const assertCanCreateGroup = (user, type) => {
  const result = canCreateGroup(user, type);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }
};

export const getActiveMembership = (conversation, userId) => {
  if (!conversation?.members?.length) {
    return null;
  }

  const normalizedUserId = toId(userId);

  return (
    conversation.members.find(
      (member) =>
        member.isActive &&
        toId(member.user) === normalizedUserId
    ) || null
  );
};

export const isConversationAdmin = (conversation, userId) => {
  const membership = getActiveMembership(conversation, userId);

  return (
    Boolean(membership) &&
    membership.role === CONVERSATION_MEMBER_ROLES.ADMIN
  );
};

export const canViewConversation = (user, conversation) => {
  const access = canUseChat(user);

  if (!access.allowed) {
    return access;
  }

  if (!conversation || !conversation.isActive) {
    return {
      allowed: false,
      message: "Conversation not found",
      statusCode: 404,
    };
  }

  const membership = getActiveMembership(conversation, user._id);

  if (!membership) {
    return {
      allowed: false,
      message: "You are not a member of this conversation",
      statusCode: 403,
    };
  }

  return {
    allowed: true,
    message: "Conversation access allowed",
    statusCode: 200,
    membership,
  };
};

export const assertCanViewConversation = (user, conversation) => {
  const result = canViewConversation(user, conversation);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }

  return result.membership;
};

export const canSendMessage = (user, conversation) => {
  const view = canViewConversation(user, conversation);

  if (!view.allowed) {
    return view;
  }

  if (
    conversation.onlyAdminsCanSend &&
    view.membership.role !== CONVERSATION_MEMBER_ROLES.ADMIN &&
    user.role !== USER_ROLES.ADMIN
  ) {
    return {
      allowed: false,
      message: "Only group administrators can send messages here",
      statusCode: 403,
    };
  }

  return {
    allowed: true,
    message: "Message sending allowed",
    statusCode: 200,
    membership: view.membership,
  };
};

export const assertCanSendMessage = (user, conversation) => {
  const result = canSendMessage(user, conversation);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }

  return result.membership;
};

export const canManageConversation = (user, conversation) => {
  const access = canUseChat(user);

  if (!access.allowed) {
    return access;
  }

  if (!conversation || !conversation.isActive) {
    return {
      allowed: false,
      message: "Conversation not found",
      statusCode: 404,
    };
  }

  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    return {
      allowed: false,
      message: "Direct conversations cannot be managed this way",
      statusCode: 400,
    };
  }

  if (user.role === USER_ROLES.ADMIN) {
    return {
      allowed: true,
      message: "Conversation management allowed",
      statusCode: 200,
    };
  }

  if (
    user.role === USER_ROLES.TEACHER &&
    conversation.type === CONVERSATION_TYPES.TEACHER_GROUP &&
    isConversationAdmin(conversation, user._id)
  ) {
    return {
      allowed: true,
      message: "Conversation management allowed",
      statusCode: 200,
    };
  }

  return {
    allowed: false,
    message:
      "You do not have permission to manage this conversation",
    statusCode: 403,
  };
};

export const assertCanManageConversation = (
  user,
  conversation
) => {
  const result = canManageConversation(user, conversation);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }
};

/**
 * Whether actor may add targetUser to the conversation.
 */
export const canAddMember = (actor, targetUser, conversation) => {
  const manage = canManageConversation(actor, conversation);

  if (!manage.allowed) {
    return manage;
  }

  if (!targetUser || !targetUser.isActive) {
    return {
      allowed: false,
      message: "Target user is not available",
      statusCode: 404,
    };
  }

  if (!targetUser.isEmailVerified || !targetUser.profileCompleted) {
    return {
      allowed: false,
      message:
        "Only verified users with completed profiles can be added",
      statusCode: 403,
    };
  }

  if (getActiveMembership(conversation, targetUser._id)) {
    return {
      allowed: false,
      message: "User is already an active member",
      statusCode: 409,
    };
  }

  if (actor.role === USER_ROLES.ADMIN) {
    if (
      targetUser.role === USER_ROLES.TEACHER &&
      targetUser.teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES.APPROVED
    ) {
      return {
        allowed: false,
        message: "Only approved teachers can be added",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Member can be added",
      statusCode: 200,
    };
  }

  if (actor.role === USER_ROLES.TEACHER) {
    if (targetUser.role !== USER_ROLES.STUDENT) {
      return {
        allowed: false,
        message:
          "Teachers may only add eligible students to their groups",
        statusCode: 403,
      };
    }

    if (!sameDepartment(actor, targetUser)) {
      return {
        allowed: false,
        message:
          "Students must belong to the teacher's department",
        statusCode: 403,
      };
    }

    if (
      !Array.isArray(actor.teachingYears) ||
      !actor.teachingYears.includes(targetUser.year)
    ) {
      return {
        allowed: false,
        message:
          "Students must be from the teacher's assigned academic years",
        statusCode: 403,
      };
    }

    if (
      Array.isArray(conversation.academicYears) &&
      conversation.academicYears.length > 0 &&
      !conversation.academicYears.includes(targetUser.year)
    ) {
      return {
        allowed: false,
        message:
          "Student academic year is not included in this group",
        statusCode: 403,
      };
    }

    return {
      allowed: true,
      message: "Member can be added",
      statusCode: 200,
    };
  }

  return {
    allowed: false,
    message: "You cannot add members to this conversation",
    statusCode: 403,
  };
};

export const assertCanAddMember = (
  actor,
  targetUser,
  conversation
) => {
  const result = canAddMember(actor, targetUser, conversation);

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }
};

export const canRemoveMember = (
  actor,
  targetUser,
  conversation
) => {
  const manage = canManageConversation(actor, conversation);

  if (!manage.allowed) {
    return manage;
  }

  const targetMembership = getActiveMembership(
    conversation,
    targetUser?._id || targetUser
  );

  if (!targetMembership) {
    return {
      allowed: false,
      message: "User is not an active member of this conversation",
      statusCode: 404,
    };
  }

  if (
    targetMembership.role === CONVERSATION_MEMBER_ROLES.ADMIN
  ) {
    const activeAdmins = conversation.members.filter(
      (member) =>
        member.isActive &&
        member.role === CONVERSATION_MEMBER_ROLES.ADMIN
    );

    if (activeAdmins.length <= 1) {
      return {
        allowed: false,
        message:
          "Cannot remove the only group administrator",
        statusCode: 400,
      };
    }
  }

  return {
    allowed: true,
    message: "Member can be removed",
    statusCode: 200,
    membership: targetMembership,
  };
};

export const assertCanRemoveMember = (
  actor,
  targetUser,
  conversation
) => {
  const result = canRemoveMember(
    actor,
    targetUser,
    conversation
  );

  if (!result.allowed) {
    throw new ApiError(
      result.statusCode,
      result.message
    );
  }

  return result.membership;
};

/**
 * Build a Mongo filter for eligible chat users based on role rules.
 */
export const buildEligibleUsersQuery = (currentUser, filters = {}) => {
  assertCanUseChat(currentUser);

  const {
    search = "",
    role,
    year,
  } = filters;

  const baseActive = {
    _id: { $ne: currentUser._id },
    isActive: true,
    isEmailVerified: true,
    profileCompleted: true,
  };

  const andConditions = [baseActive];

  if (search && String(search).trim()) {
    const escaped = String(search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    andConditions.push({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  if (currentUser.role === USER_ROLES.ADMIN) {
    const roleFilter = {};

    if (role === USER_ROLES.STUDENT) {
      roleFilter.role = USER_ROLES.STUDENT;

      if (year) {
        roleFilter.year = Number(year);
      }
    } else if (role === USER_ROLES.TEACHER) {
      roleFilter.role = USER_ROLES.TEACHER;
      roleFilter.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES.APPROVED;
    } else if (role === USER_ROLES.ADMIN) {
      roleFilter.role = USER_ROLES.ADMIN;
    } else {
      andConditions.push({
        $or: [
          {
            role: USER_ROLES.STUDENT,
            ...(year ? { year: Number(year) } : {}),
          },
          {
            role: USER_ROLES.TEACHER,
            teacherApprovalStatus:
              TEACHER_APPROVAL_STATUSES.APPROVED,
          },
          { role: USER_ROLES.ADMIN },
        ],
      });
    }

    if (Object.keys(roleFilter).length > 0) {
      andConditions.push(roleFilter);
    }

    return { $and: andConditions };
  }

  if (currentUser.role === USER_ROLES.STUDENT) {
    const allowedRoles = [];

    if (!role || role === USER_ROLES.STUDENT) {
      allowedRoles.push({
        role: USER_ROLES.STUDENT,
        department: currentUser.department,
        year: currentUser.year,
      });
    }

    if (!role || role === USER_ROLES.TEACHER) {
      allowedRoles.push({
        role: USER_ROLES.TEACHER,
        department: currentUser.department,
        teacherApprovalStatus:
          TEACHER_APPROVAL_STATUSES.APPROVED,
      });
    }

    if (allowedRoles.length === 0) {
      andConditions.push({ _id: null });
    } else {
      andConditions.push({ $or: allowedRoles });
    }

    return { $and: andConditions };
  }

  if (currentUser.role === USER_ROLES.TEACHER) {
    const teachingYears = Array.isArray(currentUser.teachingYears)
      ? currentUser.teachingYears
      : [];

    const allowedRoles = [];

    if (!role || role === USER_ROLES.STUDENT) {
      const studentFilter = {
        role: USER_ROLES.STUDENT,
        department: currentUser.department,
        year: { $in: teachingYears },
      };

      if (year) {
        const yearNumber = Number(year);

        if (!teachingYears.includes(yearNumber)) {
          andConditions.push({ _id: null });
          return { $and: andConditions };
        }

        studentFilter.year = yearNumber;
      }

      allowedRoles.push(studentFilter);
    }

    if (!role || role === USER_ROLES.TEACHER) {
      allowedRoles.push({
        role: USER_ROLES.TEACHER,
        department: currentUser.department,
        teacherApprovalStatus:
          TEACHER_APPROVAL_STATUSES.APPROVED,
      });
    }

    if (allowedRoles.length === 0) {
      andConditions.push({ _id: null });
    } else {
      andConditions.push({ $or: allowedRoles });
    }

    return { $and: andConditions };
  }

  throw new ApiError(403, "Unable to search chat users");
};

export const getEligibleChatUsers = async (
  currentUser,
  filters = {}
) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(filters.limit) || 20)
  );
  const skip = (page - 1) * limit;

  const query = buildEligibleUsersQuery(currentUser, filters);

  const [users, total] = await Promise.all([
    User.find(query)
      .select(
        "name email role department year teachingYears lastSeenAt isActive"
      )
      .populate("department", "name code")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getConversationPermissions = (
  user,
  conversation
) => {
  const membership = getActiveMembership(conversation, user._id);
  const canView = Boolean(membership) && conversation?.isActive;
  const canSend = canSendMessage(user, conversation).allowed;
  const canManage = canManageConversation(
    user,
    conversation
  ).allowed;

  return {
    canView,
    canSend,
    canManage,
    canAddMembers: canManage,
    canRemoveMembers: canManage,
    isMember: Boolean(membership),
    memberRole: membership?.role || null,
    isPinned: Boolean(membership?.isPinned),
    unreadCount: membership?.unreadCount || 0,
  };
};

export const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

/**
 * Load and authorize a conversation for a socket/REST actor.
 *
 * @param {"view"|"send"|"manage"} permission
 */
export const getAuthorizedConversation = async ({
  user,
  conversationId,
  permission = "view",
}) => {
  assertCanUseChat(user);

  if (!isValidObjectId(conversationId)) {
    throw chatError(
      400,
      "Invalid conversation ID",
      "INVALID_CONVERSATION_ID"
    );
  }

  const conversation = await Conversation.findById(
    conversationId
  );

  if (!conversation || !conversation.isActive) {
    throw chatError(
      404,
      "Conversation not found",
      "CONVERSATION_NOT_FOUND"
    );
  }

  if (permission === "send") {
    assertCanSendMessage(user, conversation);
  } else if (permission === "manage") {
    assertCanManageConversation(user, conversation);
  } else {
    assertCanViewConversation(user, conversation);
  }

  return conversation;
};
