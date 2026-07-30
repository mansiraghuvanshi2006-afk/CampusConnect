import mongoose from "mongoose";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
  markAdminProvisioned,
} from "../models/User.js";

import AcademicYear from "../models/AcademicYear.js";
import Department from "../models/Department.js";

import Conversation, {
  CONVERSATION_MEMBER_ROLES,
  CONVERSATION_TYPES,
} from "../models/Conversation.js";

import Message from "../models/Message.js";
import MessageReceipt from "../models/MessageReceipt.js";
import Notification from "../models/Notification.js";
import Session from "../models/Session.js";

import ApiError from "../utils/ApiError.js";
import { withOptionalTransaction } from "../utils/mongoTransaction.js";

/**
 * Fields that only the server may decide.
 *
 * A create/update request can never set these directly.
 */
const SERVER_CONTROLLED_FIELDS = Object.freeze([
  "isEmailVerified",
  "profileCompleted",
  "teacherApprovalStatus",
  "teacherApprovedAt",
  "teacherApprovedBy",
  "teacherRejectionReason",
  "mustChangePassword",
  "passwordChangedAt",
  "createdBy",
  "password",
]);

export const assertNoServerControlledFields = (payload = {}) => {
  const rejected = SERVER_CONTROLLED_FIELDS.filter(
    (field) => payload[field] !== undefined
  );

  if (rejected.length > 0) {
    throw new ApiError(
      400,
      `These fields are managed by the server and cannot be set directly: ${rejected.join(", ")}`
    );
  }
};

/**
 * Load an active department or fail with a validation error.
 */
export const getActiveDepartment = async (departmentId) => {
  if (!mongoose.isValidObjectId(departmentId)) {
    throw new ApiError(400, "Invalid department ID");
  }

  const department = await Department.findOne({
    _id: departmentId,
    isActive: true,
  }).lean();

  if (!department) {
    throw new ApiError(
      400,
      "Department not found or is inactive"
    );
  }

  return department;
};

/**
 * Confirm every requested year exists, is active and belongs
 * to the department.
 */
export const assertActiveAcademicYears = async (
  departmentId,
  yearNumbers
) => {
  const uniqueYears = [
    ...new Set(
      (yearNumbers || []).map((year) => Number(year))
    ),
  ];

  if (uniqueYears.length === 0) {
    return [];
  }

  if (uniqueYears.some((year) => !Number.isInteger(year))) {
    throw new ApiError(400, "Academic years must be whole numbers");
  }

  const matches = await AcademicYear.find({
    department: departmentId,
    yearNumber: { $in: uniqueYears },
    isActive: true,
  })
    .select("yearNumber")
    .lean();

  const availableYears = new Set(
    matches.map((match) => match.yearNumber)
  );

  const missingYears = uniqueYears.filter(
    (year) => !availableYears.has(year)
  );

  if (missingYears.length > 0) {
    throw new ApiError(
      400,
      `These academic years are inactive or unavailable for the selected department: ${missingYears.join(", ")}`
    );
  }

  return uniqueYears.sort((first, second) => first - second);
};

/**
 * Build the server-controlled account state for a role.
 *
 * Admin-created accounts skip verification, onboarding and
 * teacher approval, and must replace their temporary password.
 */
const buildProvisionedState = ({ role, isActive }) => {
  const shared = {
    isEmailVerified: true,
    profileCompleted: true,
    isActive,
    mustChangePassword: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
  };

  if (role === USER_ROLES.ADMIN) {
    return {
      ...shared,
      department: null,
      year: null,
      teachingYears: [],
      teacherApprovalStatus:
        TEACHER_APPROVAL_STATUSES.NOT_REQUIRED,
      teacherApprovedAt: null,
      teacherApprovedBy: null,
      teacherRejectionReason: null,
    };
  }

  if (role === USER_ROLES.TEACHER) {
    return {
      ...shared,
      year: null,
      teacherApprovalStatus:
        TEACHER_APPROVAL_STATUSES.APPROVED,
      teacherRejectionReason: null,
    };
  }

  return {
    ...shared,
    teachingYears: [],
    teacherApprovalStatus:
      TEACHER_APPROVAL_STATUSES.NOT_REQUIRED,
    teacherApprovedAt: null,
    teacherApprovedBy: null,
    teacherRejectionReason: null,
  };
};

/**
 * Create a student, teacher or admin account directly.
 *
 * The temporary password is hashed by the User model save hook.
 */
export const createUserAsAdmin = async (actor, payload) => {
  const {
    role,
    name,
    email,
    temporaryPassword,
    department,
    year,
    teachingYears,
    isActive = true,
  } = payload;

  const emailAlreadyExists = await User.exists({
    email,
  });

  if (emailAlreadyExists) {
    throw new ApiError(
      409,
      "An account with this email address already exists"
    );
  }

  const state = buildProvisionedState({ role, isActive });

  if (role === USER_ROLES.STUDENT) {
    await getActiveDepartment(department);
    await assertActiveAcademicYears(department, [year]);

    state.department = department;
    state.year = Number(year);
  }

  if (role === USER_ROLES.TEACHER) {
    await getActiveDepartment(department);

    const normalizedYears = await assertActiveAcademicYears(
      department,
      teachingYears
    );

    if (normalizedYears.length === 0) {
      throw new ApiError(
        400,
        "At least one assigned academic year is required for a teacher"
      );
    }

    state.department = department;
    state.teachingYears = normalizedYears;
    state.teacherApprovedAt = new Date();
    state.teacherApprovedBy = actor._id;
  }

  const user = new User({
    name,
    email,
    password: temporaryPassword,
    role,
    createdBy: actor._id,
    ...state,
  });

  markAdminProvisioned(user);

  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(
        409,
        "An account with this email address already exists"
      );
    }

    throw error;
  }

  return user;
};

/**
 * Assign a new temporary password and require a change on
 * next login. Every existing session is revoked so the old
 * password cannot keep a device signed in.
 */
export const resetUserPasswordAsAdmin = async (
  actor,
  userId,
  temporaryPassword
) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user._id.toString() === actor._id.toString()) {
    throw new ApiError(
      400,
      "Use the password change flow to update your own password"
    );
  }

  const isSamePassword = await user.comparePassword(
    temporaryPassword
  );

  if (isSamePassword) {
    throw new ApiError(
      400,
      "The new temporary password must be different from the current password"
    );
  }

  user.password = temporaryPassword;
  user.mustChangePassword = true;

  await user.save({ validateModifiedOnly: true });

  await Session.deleteMany({ user: user._id });

  return user;
};

/**
 * Count the platform admins that can still sign in.
 */
export const countActiveAdmins = async (excludeUserId = null) => {
  const filter = {
    role: USER_ROLES.ADMIN,
    isActive: true,
  };

  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  return User.countDocuments(filter);
};

/**
 * Remove a user from every conversation membership and demote
 * them from group ownership so no group is left ownerless.
 *
 * Groups whose owner is deleted fall back to another active
 * group admin, otherwise the group is deactivated.
 */
export const detachUserFromConversations = async (
  userId,
  session = null
) => {
  const sessionOptions = session ? { session } : {};

  const conversations = await Conversation.find({
    $or: [{ "members.user": userId }, { owner: userId }],
  }).session(session);

  for (const conversation of conversations) {
    conversation.members = conversation.members.filter(
      (member) => member.user.toString() !== userId.toString()
    );

    const ownsConversation =
      conversation.owner &&
      conversation.owner.toString() === userId.toString();

    if (ownsConversation) {
      const replacementAdmin = conversation.members.find(
        (member) =>
          member.isActive &&
          member.role === CONVERSATION_MEMBER_ROLES.ADMIN
      );

      if (replacementAdmin) {
        conversation.owner = replacementAdmin.user;
      } else {
        conversation.owner = null;
        conversation.isActive = false;
      }
    }

    /*
      Direct conversations require exactly two active members,
      so they are deactivated instead of revalidated.
    */
    if (conversation.type === CONVERSATION_TYPES.DIRECT) {
      conversation.isActive = false;
    }

    await conversation.save({
      ...sessionOptions,
      validateBeforeSave: false,
    });
  }
};

/**
 * Permanently delete a user and clean up related records.
 *
 * Messages are preserved for group history, matching the
 * existing soft-delete approach used elsewhere in chat.
 */
export const deleteUserAsAdmin = async (actor, userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (userId.toString() === actor._id.toString()) {
    throw new ApiError(
      400,
      "You cannot permanently delete your own admin account"
    );
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (
    user.role === USER_ROLES.ADMIN &&
    user.isActive &&
    (await countActiveAdmins(user._id)) === 0
  ) {
    throw new ApiError(
      400,
      "The final active platform administrator cannot be deleted"
    );
  }

  const runDelete = async (session = null) => {
    const sessionOptions = session ? { session } : {};

    await detachUserFromConversations(user._id, session);

    await Promise.all([
      Session.deleteMany({ user: user._id }, sessionOptions),
      Notification.deleteMany(
        { user: user._id },
        sessionOptions
      ),
      MessageReceipt.deleteMany(
        { user: user._id },
        sessionOptions
      ),
      Message.updateMany(
        { "reactions.user": user._id },
        { $pull: { reactions: { user: user._id } } },
        sessionOptions
      ),
      Message.updateMany(
        { mentions: user._id },
        { $pull: { mentions: user._id } },
        sessionOptions
      ),
    ]);

    await User.deleteOne({ _id: user._id }, sessionOptions);
  };

  await withOptionalTransaction({
    startSession: () => User.startSession(),
    work: async (session) => runDelete(session),
    fallback: async () => runDelete(null),
  });

  return user;
};
