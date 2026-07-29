import { describe, expect, it } from "vitest";

import {
  canUseChat,
  canStartDirectChat,
  canCreateGroup,
  canViewConversation,
  canSendMessage,
} from "../src/services/chatPolicyService.js";

import {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

import {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
} from "../src/models/Conversation.js";

import { toSocketError } from "../src/utils/chatErrors.js";
import ApiError from "../src/utils/ApiError.js";

const departmentId = "dddddddddddddddddddddddd";

const studentA = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  role: USER_ROLES.STUDENT,
  isEmailVerified: true,
  isActive: true,
  profileCompleted: true,
  department: departmentId,
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
  department: departmentId,
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

const teacherRejected = {
  ...teacherPending,
  _id: "ffffffffffffffffffffffff",
  teacherApprovalStatus:
    TEACHER_APPROVAL_STATUSES.REJECTED,
};

describe("chatPolicyService eligibility", () => {
  it("allows active verified students to use chat", () => {
    expect(canUseChat(studentA).allowed).toBe(true);
  });

  it("blocks pending and rejected teachers from chat", () => {
    expect(canUseChat(teacherPending).allowed).toBe(false);
    expect(canUseChat(teacherRejected).allowed).toBe(false);
  });

  it("blocks inactive users from chat", () => {
    expect(
      canUseChat({
        ...studentA,
        isActive: false,
      }).allowed
    ).toBe(false);
  });

  it("allows same-department same-year student direct chats", () => {
    expect(
      canStartDirectChat(studentA, {
        ...studentA,
        _id: "111111111111111111111111",
      }).allowed
    ).toBe(true);
  });

  it("blocks different-year student direct chats", () => {
    expect(
      canStartDirectChat(studentA, studentOtherYear).allowed
    ).toBe(false);
  });

  it("allows student to chat with approved same-department teacher", () => {
    expect(
      canStartDirectChat(studentA, teacherApproved).allowed
    ).toBe(true);
  });

  it("allows teacher to chat assigned-year students only", () => {
    expect(
      canStartDirectChat(teacherApproved, studentA).allowed
    ).toBe(true);
    expect(
      canStartDirectChat(
        teacherApproved,
        studentOtherYear
      ).allowed
    ).toBe(false);
  });

  it("allows teachers to create teacher groups and blocks students", () => {
    expect(
      canCreateGroup(
        teacherApproved,
        CONVERSATION_TYPES.TEACHER_GROUP
      ).allowed
    ).toBe(true);
    expect(
      canCreateGroup(
        studentA,
        CONVERSATION_TYPES.TEACHER_GROUP
      ).allowed
    ).toBe(false);
  });
});

describe("conversation authorization", () => {
  const conversation = {
    _id: "222222222222222222222222",
    isActive: true,
    type: CONVERSATION_TYPES.DIRECT,
    onlyAdminsCanSend: false,
    members: [
      {
        user: studentA._id,
        isActive: true,
        role: CONVERSATION_MEMBER_ROLES.MEMBER,
      },
      {
        user: "111111111111111111111111",
        isActive: true,
        role: CONVERSATION_MEMBER_ROLES.MEMBER,
      },
    ],
  };

  it("denies non-members from viewing", () => {
    expect(
      canViewConversation(teacherApproved, conversation)
        .allowed
    ).toBe(false);
  });

  it("allows members to send", () => {
    expect(
      canSendMessage(studentA, conversation).allowed
    ).toBe(true);
  });

  it("blocks removed/inactive members", () => {
    const inactiveMembershipConversation = {
      ...conversation,
      members: [
        {
          user: studentA._id,
          isActive: false,
          role: CONVERSATION_MEMBER_ROLES.MEMBER,
        },
      ],
    };

    expect(
      canViewConversation(
        studentA,
        inactiveMembershipConversation
      ).allowed
    ).toBe(false);
  });
});

describe("toSocketError", () => {
  it("returns structured acknowledgement failures", () => {
    const payload = toSocketError(
      new ApiError(403, "Denied")
    );

    expect(payload).toMatchObject({
      success: false,
      statusCode: 403,
      code: "CHAT_ACCESS_DENIED",
      message: "Denied",
    });
  });
});
