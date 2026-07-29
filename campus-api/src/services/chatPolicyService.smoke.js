/**
 * Lightweight smoke checks for chat eligibility rules.
 * Run: node src/services/chatPolicyService.smoke.js
 *
 * This is not a full test suite (the project has no Jest/Vitest yet).
 */

import {
  canUseChat,
  canStartDirectChat,
  canCreateGroup,
} from "./chatPolicyService.js";

import {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../models/User.js";

import {
  CONVERSATION_TYPES,
} from "../models/Conversation.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const studentA = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  role: USER_ROLES.STUDENT,
  isEmailVerified: true,
  isActive: true,
  profileCompleted: true,
  department: "dddddddddddddddddddddddd",
  year: 2,
};

const studentOtherYear = {
  ...studentA,
  _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  year: 3,
};

const teacherApproved = {
  _id: "cccccccccccccccccccccccc",
  role: USER_ROLES.TEACHER,
  isEmailVerified: true,
  isActive: true,
  profileCompleted: true,
  department: "dddddddddddddddddddddddd",
  teachingYears: [2],
  teacherApprovalStatus:
    TEACHER_APPROVAL_STATUSES.APPROVED,
};

const teacherPending = {
  ...teacherApproved,
  _id: "eeeeeeeeeeeeeeeeeeeeeeee",
  isActive: false,
  teacherApprovalStatus:
    TEACHER_APPROVAL_STATUSES.PENDING,
};

assert(
  canUseChat(studentA).allowed,
  "Active verified student should use chat"
);

assert(
  !canUseChat(teacherPending).allowed,
  "Pending teacher must not use chat"
);

assert(
  canStartDirectChat(studentA, {
    ...studentA,
    _id: "ffffffffffffffffffffffff",
  }).allowed,
  "Same dept/year students may chat"
);

assert(
  !canStartDirectChat(studentA, studentOtherYear).allowed,
  "Different year students must not chat"
);

assert(
  canStartDirectChat(teacherApproved, studentA).allowed,
  "Teacher may chat assigned-year students"
);

assert(
  !canStartDirectChat(
    teacherApproved,
    studentOtherYear
  ).allowed,
  "Teacher must not chat unassigned-year students"
);

assert(
  canCreateGroup(
    teacherApproved,
    CONVERSATION_TYPES.TEACHER_GROUP
  ).allowed,
  "Approved teacher may create teacher groups"
);

assert(
  !canCreateGroup(
    studentA,
    CONVERSATION_TYPES.TEACHER_GROUP
  ).allowed,
  "Students must not create groups"
);

console.log("chatPolicyService smoke checks passed");
