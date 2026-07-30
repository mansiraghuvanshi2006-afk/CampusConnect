import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../src/app.js";
import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";
import Department from "../src/models/Department.js";
import AcademicYear from "../src/models/AcademicYear.js";
import { generateAccessToken } from "../src/services/tokenService.js";
import { detectAiMode } from "../src/services/aiIntentService.js";
import {
  ROLE_TOOL_ALLOWLIST,
  runCampusTools,
} from "../src/services/aiToolsService.js";
import { buildProfileUpdate } from "../src/services/profileService.js";
import { AI_MODES } from "../src/models/AiMessage.js";
import AiConversation from "../src/models/AiConversation.js";
import AiMessage from "../src/models/AiMessage.js";

let mongoServer;

const authHeader = (user) => ({
  Authorization: `Bearer ${generateAccessToken(user)}`,
});

const createDepartment = async () => {
  const creator = new mongoose.Types.ObjectId();

  const department = await Department.create({
    name: "Computer Science",
    code: "CSE",
    durationInYears: 4,
    createdBy: creator,
  });

  await AcademicYear.insertMany(
    [1, 2, 3, 4].map((yearNumber) => ({
      department: department._id,
      yearNumber,
      name: `Year ${yearNumber}`,
      sortOrder: yearNumber,
      createdBy: creator,
    }))
  );

  return department;
};

const createUser = async ({
  role,
  email,
  department = null,
  year = null,
  teachingYears = [],
}) => {
  const user = await User.create({
    name: `${role} User`,
    email,
    password: "Password1!",
    role,
  });

  user.isEmailVerified = true;
  user.isActive = true;
  user.profileCompleted = true;
  user.department = department;
  user.year = year;
  user.teachingYears = teachingYears;
  user.teacherApprovalStatus =
    role === USER_ROLES.TEACHER
      ? TEACHER_APPROVAL_STATUSES.APPROVED
      : TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

  await user.save();
  return user;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

describe("Phase 8 — AI intent detection", () => {
  it("detects campus mode deterministically", () => {
    const result = detectAiMode("Show my groups");
    expect(result.mode).toBe(AI_MODES.CAMPUS);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it("detects live internet mode", () => {
    const result = detectAiMode("Latest AI news today");
    expect(result.mode).toBe(AI_MODES.LIVE_INTERNET);
  });

  it("defaults to general mode", () => {
    const result = detectAiMode("Explain React Hooks");
    expect(result.mode).toBe(AI_MODES.GENERAL);
  });
});

describe("Phase 8 — AI tool RBAC", () => {
  it("denies platform summary for students", async () => {
    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "student@test.com",
      department: department._id,
      year: 2,
    });

    expect(ROLE_TOOL_ALLOWLIST.student).not.toContain("getPlatformSummary");

    const result = await runCampusTools({
      user: student,
      toolNames: ["getPlatformSummary", "getMyProfile"],
    });

    const denied = result.usage.find(
      (item) => item.name === "getPlatformSummary"
    );
    expect(denied.success).toBe(false);

    const allowed = result.results.find(
      (item) => item.toolName === "getMyProfile"
    );
    expect(allowed?.data?.name).toBeTruthy();
  });
});

describe("Phase 8 — profile allowlists", () => {
  it("rejects email and role updates", () => {
    expect(() =>
      buildProfileUpdate("student", { email: "hacked@test.com" })
    ).toThrow(/cannot change email/i);

    expect(() =>
      buildProfileUpdate("teacher", { department: "x" })
    ).toThrow(/cannot change department/i);

    expect(() =>
      buildProfileUpdate("admin", { role: "student" })
    ).toThrow(/cannot change role/i);
  });

  it("allows student bio update", () => {
    const update = buildProfileUpdate("student", { bio: "Hello campus" });
    expect(update.bio).toBe("Hello campus");
  });
});

describe("Phase 8 — API routes", () => {
  it("returns AI not configured status without crashing", async () => {
    delete process.env.GEMINI_API_KEY;

    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "ai-student@test.com",
      department: department._id,
      year: 1,
    });

    const response = await request(app)
      .get("/api/v1/ai/status")
      .set(authHeader(student));

    expect(response.status).toBe(200);
    expect(response.body.data.configured).toBe(false);
  });

  it("creates and lists AI conversations", async () => {
    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "history@test.com",
      department: department._id,
      year: 1,
    });

    const created = await request(app)
      .post("/api/v1/ai/conversations")
      .set(authHeader(student))
      .send({ title: "Test chat" });

    expect(created.status).toBe(201);
    expect(created.body.data.conversation.title).toBe("Test chat");

    const listed = await request(app)
      .get("/api/v1/ai/conversations")
      .set(authHeader(student));

    expect(listed.status).toBe(200);
    expect(listed.body.data.conversations).toHaveLength(1);
  });

  it("loads and updates profile me", async () => {
    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "profile@test.com",
      department: department._id,
      year: 3,
    });

    const me = await request(app)
      .get("/api/v1/profile/me")
      .set(authHeader(student));

    expect(me.status).toBe(200);
    expect(me.body.data.profile.email).toBe("profile@test.com");

    const updated = await request(app)
      .patch("/api/v1/profile/me")
      .set(authHeader(student))
      .send({ bio: "Phase 8 bio", phone: "1234567890" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.profile.bio).toBe("Phase 8 bio");

    const forbidden = await request(app)
      .patch("/api/v1/profile/me")
      .set(authHeader(student))
      .send({ email: "new@test.com" });

    expect(forbidden.status).toBe(400);
  });

  it("updates settings and logout-all bumps token version", async () => {
    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "settings@test.com",
      department: department._id,
      year: 1,
    });

    const settings = await request(app)
      .patch("/api/v1/settings")
      .set(authHeader(student))
      .send({ theme: "light", language: "en" });

    expect(settings.status).toBe(200);
    expect(settings.body.data.settings.theme).toBe("light");

    const before = await User.findById(student._id);
    const versionBefore = before.tokenVersion || 0;

    const logoutAll = await request(app)
      .post("/api/v1/settings/logout-all")
      .set(authHeader(student));

    expect(logoutAll.status).toBe(200);

    const after = await User.findById(student._id);
    expect(after.tokenVersion).toBe(versionBefore + 1);

    const rejected = await request(app)
      .get("/api/v1/profile/me")
      .set(authHeader(student));

    expect(rejected.status).toBe(401);
  });

  it("returns starter prompts by role", async () => {
    const admin = await createUser({
      role: USER_ROLES.ADMIN,
      email: "admin-ai@test.com",
    });

    const response = await request(app)
      .get("/api/v1/ai/starters")
      .set(authHeader(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.starters).toEqual(
      expect.arrayContaining(["Platform statistics"])
    );
  });

  it("clears AI history", async () => {
    const department = await createDepartment();
    const student = await createUser({
      role: USER_ROLES.STUDENT,
      email: "clear@test.com",
      department: department._id,
      year: 1,
    });

    const conversation = await AiConversation.create({
      user: student._id,
      title: "Temp",
    });

    await AiMessage.create({
      conversation: conversation._id,
      user: student._id,
      role: "user",
      content: "hello",
    });

    const response = await request(app)
      .delete("/api/v1/ai/conversations")
      .set(authHeader(student));

    expect(response.status).toBe(200);
    expect(await AiConversation.countDocuments({ user: student._id })).toBe(0);
    expect(await AiMessage.countDocuments({ user: student._id })).toBe(0);
  });

  it("paginates AI messages with validated query and ownership", async () => {
    const department = await createDepartment();
    const owner = await createUser({
      role: USER_ROLES.STUDENT,
      email: "owner-msg@test.com",
      department: department._id,
      year: 1,
    });
    const other = await createUser({
      role: USER_ROLES.STUDENT,
      email: "other-msg@test.com",
      department: department._id,
      year: 1,
    });

    const conversation = await AiConversation.create({
      user: owner._id,
      title: "Paged",
    });

    const created = [];
    for (let i = 0; i < 5; i += 1) {
      created.push(
        await AiMessage.create({
          conversation: conversation._id,
          user: owner._id,
          role: "user",
          content: `message-${i}`,
        })
      );
    }

    const invalid = await request(app)
      .get(`/api/v1/ai/conversations/${conversation._id}/messages`)
      .query({ limit: 500 })
      .set(authHeader(owner));

    expect(invalid.status).toBe(400);

    const page = await request(app)
      .get(`/api/v1/ai/conversations/${conversation._id}/messages`)
      .query({ limit: 2 })
      .set(authHeader(owner));

    expect(page.status).toBe(200);
    expect(page.body.data.messages).toHaveLength(2);
    expect(page.body.data.pagination.hasMore).toBe(true);
    expect(page.body.data.pagination.nextCursor).toBeTruthy();

    const older = await request(app)
      .get(`/api/v1/ai/conversations/${conversation._id}/messages`)
      .query({
        limit: 2,
        before: page.body.data.pagination.nextCursor,
      })
      .set(authHeader(owner));

    expect(older.status).toBe(200);
    expect(older.body.data.messages.length).toBeGreaterThan(0);
    expect(
      older.body.data.messages.every(
        (message) =>
          !page.body.data.messages.some((item) => item.id === message.id)
      )
    ).toBe(true);

    const forbidden = await request(app)
      .get(`/api/v1/ai/conversations/${conversation._id}/messages`)
      .set(authHeader(other));

    expect(forbidden.status).toBe(404);

    const foreignMessage = await request(app)
      .delete(
        `/api/v1/ai/conversations/${conversation._id}/messages/${created[0]._id}`
      )
      .set(authHeader(other));

    expect(foreignMessage.status).toBe(404);
  });
});
