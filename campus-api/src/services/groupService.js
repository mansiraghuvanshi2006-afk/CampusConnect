import mongoose from "mongoose";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";

import AcademicYear from "../models/AcademicYear.js";
import Department from "../models/Department.js";

import Conversation, {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
  GROUP_TYPES,
} from "../models/Conversation.js";

import Message, { MESSAGE_TYPES } from "../models/Message.js";

import ApiError from "../utils/ApiError.js";

import {
  formatConversation,
  formatSafeUser,
  formatMessage,
  populateMessageQuery,
} from "../utils/chatSerializers.js";

import {
  assertCanUseChat,
  assertCanViewGroup,
  assertCanManageMembers,
  assertCanPromoteMember,
  assertCanDemoteMember,
  assertCanTransferGroupOwnership,
  getConversationPermissions,
  isValidObjectId,
} from "./chatPolicyService.js";

const SAFE_USER_SELECT =
  "name email role department year teachingYears lastSeenAt isActive";

const MAX_PAGE_SIZE = 50;

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toId = (value) => {
  if (!value) {
    return null;
  }

  return value._id ? value._id.toString() : value.toString();
};

const populateConversation = (query) =>
  query
    .populate({
      path: "members.user",
      select: SAFE_USER_SELECT,
      populate: {
        path: "department",
        select: "name code",
      },
    })
    .populate("department", "name code")
    .populate("createdBy", "name role")
    .populate({
      path: "lastMessage",
      populate: {
        path: "sender",
        select: "name role email",
      },
    });

/**
 * Parse a `1,2,3` style year list or an array of years.
 */
export const parseYearNumbers = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const raw = Array.isArray(value)
    ? value
    : String(value).split(",");

  const years = raw
    .map((entry) => Number(String(entry).trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return [...new Set(years)].sort(
    (first, second) => first - second
  );
};

/**
 * Validate the department/academic-year scope of a group against
 * the actor's own permissions.
 *
 * Teachers are locked to their own department and assigned years.
 * Admins may target any active department and its active years.
 */
export const resolveGroupScope = async (
  actor,
  { department, academicYears } = {}
) => {
  const requestedYears = parseYearNumbers(academicYears);

  let departmentId =
    actor.role === USER_ROLES.TEACHER
      ? toId(actor.department)
      : department
        ? toId(department)
        : null;

  if (actor.role === USER_ROLES.TEACHER) {
    if (
      department &&
      toId(department) !== toId(actor.department)
    ) {
      throw new ApiError(
        403,
        "You can only create groups for your own department"
      );
    }

    if (!departmentId) {
      throw new ApiError(
        403,
        "Your teacher department is required to create a group"
      );
    }

    const teachingYears = Array.isArray(actor.teachingYears)
      ? actor.teachingYears
      : [];

    const outsideYears = requestedYears.filter(
      (year) => !teachingYears.includes(year)
    );

    if (outsideYears.length > 0) {
      throw new ApiError(
        403,
        `These academic years are outside your assigned years: ${outsideYears.join(", ")}`
      );
    }
  }

  if (!departmentId) {
    if (requestedYears.length > 0) {
      throw new ApiError(
        400,
        "A department is required when selecting academic years"
      );
    }

    return {
      department: null,
      academicYears: [],
      groupType: GROUP_TYPES.CUSTOM,
    };
  }

  if (!isValidObjectId(departmentId)) {
    throw new ApiError(400, "Invalid department ID");
  }

  const departmentDoc = await Department.findOne({
    _id: departmentId,
    isActive: true,
  })
    .select("name code")
    .lean();

  if (!departmentDoc) {
    throw new ApiError(
      400,
      "Department not found or is inactive"
    );
  }

  if (requestedYears.length > 0) {
    const activeYears = await AcademicYear.find({
      department: departmentId,
      yearNumber: { $in: requestedYears },
      isActive: true,
    })
      .select("yearNumber")
      .lean();

    const availableYears = new Set(
      activeYears.map((year) => year.yearNumber)
    );

    const invalidYears = requestedYears.filter(
      (year) => !availableYears.has(year)
    );

    if (invalidYears.length > 0) {
      throw new ApiError(
        400,
        `These academic years are inactive or do not belong to the selected department: ${invalidYears.join(", ")}`
      );
    }
  }

  return {
    department: departmentId,
    academicYears: requestedYears,
    groupType:
      requestedYears.length > 0
        ? GROUP_TYPES.ACADEMIC_YEAR
        : GROUP_TYPES.DEPARTMENT,
  };
};

/**
 * Departments and academic years the actor may scope a group to.
 */
export const getGroupScopeOptions = async (actor) => {
  assertCanUseChat(actor);

  if (actor.role === USER_ROLES.STUDENT) {
    throw new ApiError(403, "Students cannot create groups");
  }

  if (actor.role === USER_ROLES.TEACHER) {
    const department = await Department.findOne({
      _id: actor.department,
      isActive: true,
    })
      .select("name code durationInYears")
      .lean();

    if (!department) {
      throw new ApiError(
        403,
        "Your department is inactive. Contact an administrator."
      );
    }

    const teachingYears = Array.isArray(actor.teachingYears)
      ? actor.teachingYears
      : [];

    const academicYears = await AcademicYear.find({
      department: department._id,
      yearNumber: { $in: teachingYears },
      isActive: true,
    })
      .select("department yearNumber name sortOrder")
      .sort({ sortOrder: 1, yearNumber: 1 })
      .lean();

    return {
      departmentLocked: true,
      departments: [department],
      academicYears,
    };
  }

  const [departments, academicYears] = await Promise.all([
    Department.find({ isActive: true })
      .select("name code durationInYears")
      .sort({ name: 1 })
      .lean(),
    AcademicYear.find({ isActive: true })
      .select("department yearNumber name sortOrder")
      .sort({ sortOrder: 1, yearNumber: 1 })
      .lean(),
  ]);

  return {
    departmentLocked: false,
    departments,
    academicYears,
  };
};

/**
 * Build the eligible-member query for group creation and for
 * adding members to an existing group.
 */
const buildMemberOptionsQuery = (actor, scope, filters) => {
  const { role, search, excludeIds = [] } = filters;

  const excluded = [
    actor._id,
    ...excludeIds.filter(Boolean),
  ].map((id) => new mongoose.Types.ObjectId(toId(id)));

  const andConditions = [
    {
      _id: { $nin: excluded },
      isActive: true,
      isEmailVerified: true,
      profileCompleted: true,
    },
  ];

  if (search && String(search).trim()) {
    const escaped = escapeRegex(String(search).trim());

    andConditions.push({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  const studentCondition = {
    role: USER_ROLES.STUDENT,
    ...(scope.department
      ? { department: scope.department }
      : {}),
    ...(scope.academicYears.length > 0
      ? { year: { $in: scope.academicYears } }
      : {}),
  };

  const teacherCondition = {
    role: USER_ROLES.TEACHER,
    teacherApprovalStatus:
      TEACHER_APPROVAL_STATUSES.APPROVED,
    ...(scope.department
      ? { department: scope.department }
      : {}),
  };

  if (actor.role === USER_ROLES.TEACHER) {
    const teachingYears = Array.isArray(actor.teachingYears)
      ? actor.teachingYears
      : [];

    /*
      A teacher may only reach students inside their assigned
      years, narrowed further by the group's selected years.
    */
    const allowedYears =
      scope.academicYears.length > 0
        ? scope.academicYears.filter((year) =>
            teachingYears.includes(year)
          )
        : teachingYears;

    studentCondition.year = { $in: allowedYears };
  }

  if (role === USER_ROLES.STUDENT) {
    andConditions.push(studentCondition);
  } else if (role === USER_ROLES.TEACHER) {
    andConditions.push(teacherCondition);
  } else {
    andConditions.push({
      $or: [studentCondition, teacherCondition],
    });
  }

  return { $and: andConditions };
};

/**
 * Paginated, server-side searched list of users that may be added
 * to a group with the given scope.
 */
export const getGroupMemberOptions = async (
  actor,
  filters = {},
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(filters.limit) || 20)
  );
  const skip = (page - 1) * limit;

  let scope;
  let excludeIds = [];

  if (filters.conversationId) {
    if (!isValidObjectId(filters.conversationId)) {
      throw new ApiError(400, "Invalid conversation ID");
    }

    const conversation = await Conversation.findById(
      filters.conversationId
    );

    if (!conversation) {
      throw new ApiError(404, "Group not found");
    }

    assertCanManageMembers(actor, conversation);

    scope = {
      department: conversation.department
        ? toId(conversation.department)
        : null,
      academicYears: conversation.academicYears || [],
    };

    excludeIds = (conversation.members || [])
      .filter((member) => member.isActive)
      .map((member) => toId(member.user));
  } else {
    if (actor.role === USER_ROLES.STUDENT) {
      throw new ApiError(
        403,
        "Students cannot browse group member options"
      );
    }

    const resolved = await resolveGroupScope(actor, {
      department: filters.departmentId,
      academicYears: filters.yearNumbers,
    });

    scope = {
      department: resolved.department,
      academicYears: resolved.academicYears,
    };
  }

  const query = buildMemberOptionsQuery(actor, scope, {
    role: filters.role,
    search: filters.search,
    excludeIds,
  });

  const [users, total] = await Promise.all([
    User.find(query)
      .select(SAFE_USER_SELECT)
      .populate("department", "name code")
      .sort({ role: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((user) =>
      formatSafeUser(user, onlineUserIds)
    ),
    scope: {
      departmentId: scope.department,
      academicYears: scope.academicYears,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

/**
 * Groups the actor may see: every active group for platform
 * admins, own memberships for everybody else.
 */
export const listGroups = async (
  actor,
  filters = {},
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(filters.limit) || 20)
  );
  const skip = (page - 1) * limit;

  const andConditions = [
    {
      isActive: true,
      type: { $ne: CONVERSATION_TYPES.DIRECT },
    },
  ];

  if (actor.role !== USER_ROLES.ADMIN) {
    andConditions.push({
      members: {
        $elemMatch: {
          user: actor._id,
          isActive: true,
        },
      },
    });
  }

  if (filters.departmentId) {
    if (!isValidObjectId(filters.departmentId)) {
      throw new ApiError(400, "Invalid department ID");
    }

    andConditions.push({ department: filters.departmentId });
  }

  const years = parseYearNumbers(filters.yearNumbers);

  if (years.length > 0) {
    andConditions.push({ academicYears: { $in: years } });
  }

  if (filters.search && String(filters.search).trim()) {
    andConditions.push({
      name: {
        $regex: escapeRegex(String(filters.search).trim()),
        $options: "i",
      },
    });
  }

  const query = { $and: andConditions };

  const [conversations, total] = await Promise.all([
    populateConversation(Conversation.find(query))
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(query),
  ]);

  return {
    groups: conversations.map((conversation) =>
      formatConversation(conversation, actor, {
        onlineUserIds,
        permissions: getConversationPermissions(
          actor,
          conversation
        ),
      })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

/**
 * Group profile with its full member list.
 */
export const getGroupDetails = async (
  actor,
  conversationId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation = await populateConversation(
    Conversation.findById(conversationId)
  ).lean();

  assertCanViewGroup(actor, conversation);

  const permissions = getConversationPermissions(
    actor,
    conversation
  );

  const group = formatConversation(conversation, actor, {
    onlineUserIds,
    permissions,
  });

  return {
    group,
    members: group.members,
    memberCount: group.memberCount,
  };
};

const createSystemMessage = async (
  conversation,
  actor,
  text
) => {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actor._id,
    type: MESSAGE_TYPES.SYSTEM,
    text,
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;

  return message;
};

const finalizeGroupChange = async (
  actor,
  conversation,
  systemMessage,
  onlineUserIds
) => {
  await conversation.save();

  const populated = await populateConversation(
    Conversation.findById(conversation._id)
  ).lean();

  const permissions = getConversationPermissions(
    actor,
    populated
  );

  const populatedSystemMessage = systemMessage
    ? await populateMessageQuery(
        Message.findById(systemMessage._id)
      ).lean()
    : null;

  return {
    group: formatConversation(populated, actor, {
      onlineUserIds,
      permissions,
    }),
    systemMessage: populatedSystemMessage
      ? formatMessage(populatedSystemMessage, {
          receipts: [],
        })
      : null,
  };
};

const loadGroupForManagement = async (conversationId) => {
  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation =
    await Conversation.findById(conversationId);

  if (!conversation || !conversation.isActive) {
    throw new ApiError(404, "Group not found");
  }

  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    throw new ApiError(
      400,
      "This conversation is not a group"
    );
  }

  return conversation;
};

/**
 * Promote an eligible member to group administrator.
 */
export const promoteGroupMember = async (
  actor,
  conversationId,
  userId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  const conversation =
    await loadGroupForManagement(conversationId);

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const targetUser = await User.findById(userId).select(
    SAFE_USER_SELECT
  );

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const membership = assertCanPromoteMember(
    actor,
    targetUser,
    conversation
  );

  membership.role = CONVERSATION_MEMBER_ROLES.ADMIN;

  const systemMessage = await createSystemMessage(
    conversation,
    actor,
    `${targetUser.name} is now a group admin`
  );

  const result = await finalizeGroupChange(
    actor,
    conversation,
    systemMessage,
    onlineUserIds
  );

  return {
    ...result,
    userId: targetUser._id.toString(),
    memberRole: CONVERSATION_MEMBER_ROLES.ADMIN,
  };
};

/**
 * Demote a group administrator back to a normal member.
 */
export const demoteGroupMember = async (
  actor,
  conversationId,
  userId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  const conversation =
    await loadGroupForManagement(conversationId);

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const targetUser = await User.findById(userId).select(
    SAFE_USER_SELECT
  );

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const membership = assertCanDemoteMember(
    actor,
    targetUser,
    conversation
  );

  membership.role = CONVERSATION_MEMBER_ROLES.MEMBER;

  const systemMessage = await createSystemMessage(
    conversation,
    actor,
    `${targetUser.name} is no longer a group admin`
  );

  const result = await finalizeGroupChange(
    actor,
    conversation,
    systemMessage,
    onlineUserIds
  );

  return {
    ...result,
    userId: targetUser._id.toString(),
    memberRole: CONVERSATION_MEMBER_ROLES.MEMBER,
  };
};

/**
 * Hand group ownership to another eligible member. The previous
 * owner stays on as a group administrator.
 */
export const transferGroupOwnership = async (
  actor,
  conversationId,
  userId,
  onlineUserIds = new Set()
) => {
  assertCanUseChat(actor);

  const conversation =
    await loadGroupForManagement(conversationId);

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const targetUser = await User.findById(userId).select(
    SAFE_USER_SELECT
  );

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  const membership = assertCanTransferGroupOwnership(
    actor,
    targetUser,
    conversation
  );

  membership.role = CONVERSATION_MEMBER_ROLES.ADMIN;
  conversation.owner = targetUser._id;

  const systemMessage = await createSystemMessage(
    conversation,
    actor,
    `${targetUser.name} is now the group owner`
  );

  const result = await finalizeGroupChange(
    actor,
    conversation,
    systemMessage,
    onlineUserIds
  );

  return {
    ...result,
    userId: targetUser._id.toString(),
    ownerId: targetUser._id.toString(),
  };
};