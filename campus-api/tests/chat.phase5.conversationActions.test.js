import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

import Department from "../src/models/Department.js";
import AcademicYear from "../src/models/AcademicYear.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";

import * as chatService from "../src/services/chatService.js";

let mongoServer;

/**
 * Group creation validates the department and academic years, so
 * tests need real active records instead of loose ObjectIds.
 */
const createDepartmentWithYears = async (
  code,
  yearNumbers = [1, 2]
) => {
  const creator = new mongoose.Types.ObjectId();

  const department = await Department.create({
    name: `Department ${code}`,
    code,
    durationInYears: Math.max(...yearNumbers),
    createdBy: creator,
  });

  await AcademicYear.insertMany(
    yearNumbers.map((yearNumber) => ({
      department: department._id,
      yearNumber,
      name: `Year ${yearNumber}`,
      sortOrder: yearNumber,
      createdBy: creator,
    }))
  );

  return department._id;
};

const createStudent = async ({ email, year = 2, department }) => {
  const user = await User.create({
    name: `Student ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.STUDENT,
  });

  user.isEmailVerified = true;
  user.isActive = true;
  user.profileCompleted = true;
  user.department = department;
  user.year = year;
  user.teacherApprovalStatus =
    TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;
  await user.save();
  return user;
};

const createTeacher = async ({ email, department }) => {
  const user = await User.create({
    name: `Teacher ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.TEACHER,
  });

  user.isEmailVerified = true;
  user.isActive = true;
  user.profileCompleted = true;
  user.department = department;
  user.teacherApprovalStatus = TEACHER_APPROVAL_STATUSES.APPROVED;
  user.teachingYears = [1, 2];
  await user.save();
  return user;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    retryWrites: false,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Department.deleteMany({}),
    AcademicYear.deleteMany({}),
  ]);
});

describe("Phase 5 conversation clear / hide / leave / delete", () => {
  it("clears chat for the current user only via clearedAt", async () => {
    const department = new mongoose.Types.ObjectId();
    const a = await createStudent({
      email: "a@test.com",
      department,
    });
    const b = await createStudent({
      email: "b@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(a, b._id);

    await chatService.sendTextMessage(a, conversation.id, {
      text: "before clear",
    });

    await chatService.clearConversationForMe(a, conversation.id);

    const forA = await chatService.getMessages(a, conversation.id);
    expect(forA.messages).toHaveLength(0);

    const forB = await chatService.getMessages(b, conversation.id);
    expect(forB.messages.some((m) => m.text === "before clear")).toBe(
      true
    );

    await chatService.sendTextMessage(b, conversation.id, {
      text: "after clear",
    });

    const forALater = await chatService.getMessages(a, conversation.id);
    expect(forALater.messages.map((m) => m.text)).toEqual([
      "after clear",
    ]);
  });

  it("hides a direct conversation for one user only", async () => {
    const department = new mongoose.Types.ObjectId();
    const a = await createStudent({
      email: "hidea@test.com",
      department,
    });
    const b = await createStudent({
      email: "hideb@test.com",
      department,
    });

    const { conversation } =
      await chatService.createOrGetDirectConversation(a, b._id);

    await chatService.sendTextMessage(a, conversation.id, {
      text: "hello",
    });

    await chatService.hideConversationForMe(a, conversation.id);

    const listA = await chatService.listConversations(a);
    expect(listA.find((item) => item.id === conversation.id)).toBeFalsy();

    const listB = await chatService.listConversations(b);
    expect(listB.find((item) => item.id === conversation.id)).toBeTruthy();
  });

  it("lets a non-admin member leave a group", async () => {
    const department = await createDepartmentWithYears("LEAVE");
    const teacher = await createTeacher({
      email: "tleave@test.com",
      department,
    });
    const student = await createStudent({
      email: "sleave@test.com",
      department,
      year: 2,
    });

    const created = await chatService.createGroupConversation(teacher, {
      name: "Leave Group",
      memberIds: [student._id.toString()],
      academicYears: [2],
    });

    const conversationId = created.conversation.id;

    await chatService.leaveConversation(student, conversationId);

    const list = await chatService.listConversations(student);
    expect(list.find((item) => item.id === conversationId)).toBeFalsy();

    const remaining = await chatService.getConversationById(
      teacher,
      conversationId
    );
    expect(remaining.memberCount).toBe(1);
  });

  it("allows a group manager to delete a group", async () => {
    const department = await createDepartmentWithYears("DEL");
    const teacher = await createTeacher({
      email: "tdel@test.com",
      department,
    });
    const student = await createStudent({
      email: "sdel@test.com",
      department,
      year: 2,
    });

    const created = await chatService.createGroupConversation(teacher, {
      name: "Delete Group",
      memberIds: [student._id.toString()],
      academicYears: [2],
    });

    const conversationId = created.conversation.id;

    await chatService.deactivateConversation(teacher, conversationId);

    await expect(
      chatService.getConversationById(teacher, conversationId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("blocks sole admin from leaving without another admin", async () => {
    const department = await createDepartmentWithYears("SOLE");
    const teacher = await createTeacher({
      email: "sole@test.com",
      department,
    });
    const student = await createStudent({
      email: "member@test.com",
      department,
      year: 2,
    });

    const created = await chatService.createGroupConversation(teacher, {
      name: "Sole Admin Group",
      memberIds: [student._id.toString()],
      academicYears: [2],
    });

    await expect(
      chatService.leaveConversation(teacher, created.conversation.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
