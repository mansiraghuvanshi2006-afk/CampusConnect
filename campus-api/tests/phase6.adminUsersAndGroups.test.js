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
import request from "supertest";

import app from "../src/app.js";
import { generateAccessToken } from "../src/services/tokenService.js";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

import Department from "../src/models/Department.js";
import AcademicYear from "../src/models/AcademicYear.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import Session from "../src/models/Session.js";

let mongoServer;

const authHeader = (user) => [
  "Authorization",
  `Bearer ${generateAccessToken(user)}`,
];

const createDepartment = async ({
  code = "CSE",
  years = [1, 2, 3, 4],
} = {}) => {
  const creator = new mongoose.Types.ObjectId();

  const department = await Department.create({
    name: `Department ${code}`,
    code,
    durationInYears: Math.max(...years),
    createdBy: creator,
  });

  await AcademicYear.insertMany(
    years.map((yearNumber) => ({
      department: department._id,
      yearNumber,
      name: `Year ${yearNumber}`,
      sortOrder: yearNumber,
      createdBy: creator,
    }))
  );

  return department;
};

const createAdmin = async (email = "admin@campus.test") => {
  const admin = await User.create({
    name: "Platform Admin",
    email,
    password: "Password1!",
    role: USER_ROLES.ADMIN,
    isEmailVerified: true,
    isActive: true,
    teacherApprovalStatus:
      TEACHER_APPROVAL_STATUSES.NOT_REQUIRED,
  });

  admin.isEmailVerified = true;
  admin.isActive = true;
  admin.profileCompleted = true;
  await admin.save();

  return admin;
};

const createTeacher = async ({
  email,
  department,
  teachingYears = [2],
}) => {
  const teacher = await User.create({
    name: `Teacher ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.TEACHER,
  });

  teacher.isEmailVerified = true;
  teacher.isActive = true;
  teacher.profileCompleted = true;
  teacher.department = department;
  teacher.teachingYears = teachingYears;
  teacher.teacherApprovalStatus =
    TEACHER_APPROVAL_STATUSES.APPROVED;
  await teacher.save();

  return teacher;
};

const createStudent = async ({
  email,
  department,
  year = 2,
}) => {
  const student = await User.create({
    name: `Student ${email.split("@")[0]}`,
    email,
    password: "Password1!",
    role: USER_ROLES.STUDENT,
  });

  student.isEmailVerified = true;
  student.isActive = true;
  student.profileCompleted = true;
  student.department = department;
  student.year = year;
  await student.save();

  return student;
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
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    AcademicYear.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
  ]);
});

describe("Phase 6 admin user provisioning", () => {
  it("creates a ready-to-use student that must change its password", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const response = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Provisioned Student",
        email: "Provisioned.Student@Campus.test",
        temporaryPassword: "TempPass1!",
        department: department._id.toString(),
        year: 2,
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      role: "student",
      email: "provisioned.student@campus.test",
      isEmailVerified: true,
      profileCompleted: true,
      isActive: true,
      mustChangePassword: true,
    });
    expect(response.body.data.user.password).toBeUndefined();

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "provisioned.student@campus.test",
        password: "TempPass1!",
      });

    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
  });

  it("creates an approved teacher with assigned years", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const response = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "teacher",
        name: "Provisioned Teacher",
        email: "teacher.provisioned@campus.test",
        temporaryPassword: "TempPass1!",
        department: department._id.toString(),
        teachingYears: [1, 2],
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      role: "teacher",
      teacherApprovalStatus: "approved",
      isEmailVerified: true,
      profileCompleted: true,
      mustChangePassword: true,
    });
    expect(response.body.data.user.teachingYears).toEqual([
      1, 2,
    ]);
  });

  it("rejects duplicate emails, inactive departments and unknown years", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const duplicate = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "admin",
        name: "Another Admin",
        email: admin.email,
        temporaryPassword: "TempPass1!",
        isActive: true,
      });

    expect(duplicate.status).toBe(409);

    const badDepartment = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Bad Department",
        email: "bad.department@campus.test",
        temporaryPassword: "TempPass1!",
        department: new mongoose.Types.ObjectId().toString(),
        year: 1,
        isActive: true,
      });

    expect(badDepartment.status).toBe(400);

    const badYear = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Bad Year",
        email: "bad.year@campus.test",
        temporaryPassword: "TempPass1!",
        department: department._id.toString(),
        year: 9,
        isActive: true,
      });

    expect(badYear.status).toBe(400);
  });

  it("never trusts client-sent account state", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const response = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Sneaky Student",
        email: "sneaky@campus.test",
        temporaryPassword: "TempPass1!",
        department: department._id.toString(),
        year: 1,
        isActive: true,
        mustChangePassword: false,
      });

    expect(response.status).toBe(400);
  });

  it("blocks students from the admin user API", async () => {
    const department = await createDepartment();
    const student = await createStudent({
      email: "student@campus.test",
      department: department._id,
    });

    const response = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(student))
      .send({
        role: "admin",
        name: "Escalation",
        email: "escalation@campus.test",
        temporaryPassword: "TempPass1!",
        isActive: true,
      });

    expect(response.status).toBe(403);
  });

  it("protects the acting admin and the last active admin", async () => {
    const admin = await createAdmin();

    const selfDelete = await request(app)
      .delete(`/api/v1/admin/users/${admin._id}`)
      .set(...authHeader(admin))
      .send({ confirmation: "DELETE" });

    expect(selfDelete.status).toBe(400);

    const secondAdmin = await createAdmin("second@campus.test");

    const disableLast = await request(app)
      .patch(`/api/v1/admin/users/${secondAdmin._id}/status`)
      .set(...authHeader(admin))
      .send({ isActive: false });

    expect(disableLast.status).toBe(200);

    const deleteSecond = await request(app)
      .delete(`/api/v1/admin/users/${secondAdmin._id}`)
      .set(...authHeader(admin))
      .send({ confirmation: "DELETE" });

    expect(deleteSecond.status).toBe(200);
  });
});

describe("Phase 6 temporary password change", () => {
  const provisionStudent = async (admin, department) => {
    await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Temp Student",
        email: "temp.student@campus.test",
        temporaryPassword: "TempPass1!",
        department: department._id.toString(),
        year: 2,
        isActive: true,
      });

    return User.findOne({
      email: "temp.student@campus.test",
    });
  };

  it("blocks protected routes until the password is changed", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();
    const student = await provisionStudent(admin, department);

    const blocked = await request(app)
      .get("/api/v1/chat/conversations")
      .set(...authHeader(student));

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const currentUser = await request(app)
      .get("/api/v1/auth/me")
      .set(...authHeader(student));

    expect(currentUser.status).toBe(200);
    expect(currentUser.body.data.user.mustChangePassword).toBe(
      true
    );
  });

  it("rejects reusing the temporary password and clears the flag on success", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();
    const student = await provisionStudent(admin, department);

    const reuse = await request(app)
      .patch("/api/v1/auth/change-temporary-password")
      .set(...authHeader(student))
      .send({
        currentPassword: "TempPass1!",
        newPassword: "TempPass1!",
        confirmPassword: "TempPass1!",
      });

    expect(reuse.status).toBe(400);

    const wrongCurrent = await request(app)
      .patch("/api/v1/auth/change-temporary-password")
      .set(...authHeader(student))
      .send({
        currentPassword: "WrongPass1!",
        newPassword: "BrandNew1!",
        confirmPassword: "BrandNew1!",
      });

    expect(wrongCurrent.status).toBe(401);

    const changed = await request(app)
      .patch("/api/v1/auth/change-temporary-password")
      .set(...authHeader(student))
      .send({
        currentPassword: "TempPass1!",
        newPassword: "BrandNew1!",
        confirmPassword: "BrandNew1!",
      });

    expect(changed.status).toBe(200);
    expect(changed.body.data.user.mustChangePassword).toBe(
      false
    );

    const allowed = await request(app)
      .get("/api/v1/chat/conversations")
      .set(...authHeader(student));

    expect(allowed.status).toBe(200);
  });
});

describe("Phase 6 group creation and permissions", () => {
  const createGroupAs = (actor, payload) =>
    request(app)
      .post("/api/v1/chat/conversations/groups")
      .set(...authHeader(actor))
      .send(payload);

  it("makes the creating teacher the owner and admin", async () => {
    const department = await createDepartment();
    const teacher = await createTeacher({
      email: "owner@campus.test",
      department: department._id,
      teachingYears: [1, 2],
    });
    const student = await createStudent({
      email: "member@campus.test",
      department: department._id,
      year: 2,
    });

    const response = await createGroupAs(teacher, {
      name: "Year 2 Discussion",
      description: "Coursework updates",
      academicYears: [2],
      memberIds: [student._id.toString()],
    });

    expect(response.status).toBe(201);

    const group = response.body.data.conversation;

    expect(group.owner).toBe(teacher._id.toString());
    expect(group.groupType).toBe("academic-year");
    expect(group.memberCount).toBe(2);
    expect(group.permissions.isOwner).toBe(true);
    expect(group.permissions.canDeleteGroup).toBe(true);

    const stored = await Conversation.findById(group.id);
    expect(stored.owner.toString()).toBe(
      teacher._id.toString()
    );
  });

  it("keeps teachers inside their own department and years", async () => {
    const department = await createDepartment();
    const otherDepartment = await createDepartment({
      code: "ECE",
      years: [1, 2],
    });

    const teacher = await createTeacher({
      email: "scoped@campus.test",
      department: department._id,
      teachingYears: [2],
    });

    const outsideStudent = await createStudent({
      email: "outside@campus.test",
      department: otherDepartment._id,
      year: 2,
    });

    const wrongYearStudent = await createStudent({
      email: "wrongyear@campus.test",
      department: department._id,
      year: 3,
    });

    const crossDepartment = await createGroupAs(teacher, {
      name: "Cross Department",
      department: otherDepartment._id.toString(),
      academicYears: [2],
    });

    expect(crossDepartment.status).toBe(403);

    const unassignedYear = await createGroupAs(teacher, {
      name: "Unassigned Year",
      academicYears: [3],
    });

    expect(unassignedYear.status).toBe(403);

    const outsideMember = await createGroupAs(teacher, {
      name: "Outside Member",
      academicYears: [2],
      memberIds: [outsideStudent._id.toString()],
    });

    expect(outsideMember.status).toBe(403);

    const wrongYearMember = await createGroupAs(teacher, {
      name: "Wrong Year Member",
      academicYears: [2],
      memberIds: [wrongYearStudent._id.toString()],
    });

    expect(wrongYearMember.status).toBe(403);
  });

  it("refuses disabled users as members", async () => {
    const department = await createDepartment();
    const teacher = await createTeacher({
      email: "disabled-owner@campus.test",
      department: department._id,
      teachingYears: [2],
    });

    const disabled = await createStudent({
      email: "disabled@campus.test",
      department: department._id,
      year: 2,
    });

    disabled.isActive = false;
    await disabled.save();

    const response = await createGroupAs(teacher, {
      name: "Disabled Member",
      academicYears: [2],
      memberIds: [disabled._id.toString()],
    });

    expect(response.status).toBe(404);
  });

  it("blocks students from creating groups", async () => {
    const department = await createDepartment();
    const student = await createStudent({
      email: "nocreate@campus.test",
      department: department._id,
      year: 2,
    });

    const response = await createGroupAs(student, {
      name: "Student Group",
      academicYears: [2],
    });

    expect(response.status).toBe(403);
  });

  it("lets admins create groups for any department", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const teacher = await createTeacher({
      email: "admin-group-teacher@campus.test",
      department: department._id,
      teachingYears: [1],
    });

    const response = await createGroupAs(admin, {
      name: "Official Announcements",
      department: department._id.toString(),
      academicYears: [1],
      memberIds: [teacher._id.toString()],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.conversation.owner).toBe(
      admin._id.toString()
    );
  });

  it("promotes teachers, refuses students and protects the owner", async () => {
    const department = await createDepartment();
    const owner = await createTeacher({
      email: "promo-owner@campus.test",
      department: department._id,
      teachingYears: [1, 2],
    });
    const colleague = await createTeacher({
      email: "colleague@campus.test",
      department: department._id,
      teachingYears: [2],
    });
    const student = await createStudent({
      email: "promo-student@campus.test",
      department: department._id,
      year: 2,
    });

    const created = await createGroupAs(owner, {
      name: "Promotions",
      academicYears: [2],
      memberIds: [
        colleague._id.toString(),
        student._id.toString(),
      ],
    });

    const groupId = created.body.data.conversation.id;

    const promoteStudent = await request(app)
      .patch(
        `/api/v1/chat/conversations/${groupId}/admins/${student._id}/promote`
      )
      .set(...authHeader(owner));

    expect(promoteStudent.status).toBe(403);

    const promoteTeacher = await request(app)
      .patch(
        `/api/v1/chat/conversations/${groupId}/admins/${colleague._id}/promote`
      )
      .set(...authHeader(owner));

    expect(promoteTeacher.status).toBe(200);

    const removeOwner = await request(app)
      .delete(
        `/api/v1/chat/conversations/${groupId}/members/${owner._id}`
      )
      .set(...authHeader(colleague));

    expect(removeOwner.status).toBe(400);

    const deleteAsAdminMember = await request(app)
      .delete(`/api/v1/chat/conversations/${groupId}`)
      .set(...authHeader(colleague));

    expect(deleteAsAdminMember.status).toBe(403);

    const demoteByNonOwner = await request(app)
      .patch(
        `/api/v1/chat/conversations/${groupId}/admins/${owner._id}/demote`
      )
      .set(...authHeader(colleague));

    expect(demoteByNonOwner.status).toBe(400);

    const demoteByOwner = await request(app)
      .patch(
        `/api/v1/chat/conversations/${groupId}/admins/${colleague._id}/demote`
      )
      .set(...authHeader(owner));

    expect(demoteByOwner.status).toBe(200);
  });

  it("stops students from editing groups or managing members", async () => {
    const department = await createDepartment();
    const teacher = await createTeacher({
      email: "student-limits@campus.test",
      department: department._id,
      teachingYears: [2],
    });
    const student = await createStudent({
      email: "limited@campus.test",
      department: department._id,
      year: 2,
    });
    const other = await createStudent({
      email: "limited-two@campus.test",
      department: department._id,
      year: 2,
    });

    const created = await createGroupAs(teacher, {
      name: "Student Limits",
      academicYears: [2],
      memberIds: [
        student._id.toString(),
        other._id.toString(),
      ],
    });

    const groupId = created.body.data.conversation.id;

    const rename = await request(app)
      .patch(`/api/v1/chat/conversations/${groupId}`)
      .set(...authHeader(student))
      .send({ name: "Hijacked" });

    expect(rename.status).toBe(403);

    const removeMember = await request(app)
      .delete(
        `/api/v1/chat/conversations/${groupId}/members/${other._id}`
      )
      .set(...authHeader(student));

    expect(removeMember.status).toBe(403);

    const deleteGroup = await request(app)
      .delete(`/api/v1/chat/conversations/${groupId}`)
      .set(...authHeader(student));

    expect(deleteGroup.status).toBe(403);
  });

  it("transfers ownership and keeps the previous owner as admin", async () => {
    const department = await createDepartment();
    const owner = await createTeacher({
      email: "transfer-owner@campus.test",
      department: department._id,
      teachingYears: [2],
    });
    const successor = await createTeacher({
      email: "successor@campus.test",
      department: department._id,
      teachingYears: [2],
    });

    const created = await createGroupAs(owner, {
      name: "Transfer",
      academicYears: [2],
      memberIds: [successor._id.toString()],
    });

    const groupId = created.body.data.conversation.id;

    const transfer = await request(app)
      .patch(
        `/api/v1/chat/conversations/${groupId}/owner/${successor._id}`
      )
      .set(...authHeader(owner));

    expect(transfer.status).toBe(200);

    const stored = await Conversation.findById(groupId);

    expect(stored.owner.toString()).toBe(
      successor._id.toString()
    );

    const previousOwnerMembership = stored.members.find(
      (member) =>
        member.user.toString() === owner._id.toString()
    );

    expect(previousOwnerMembership.role).toBe("admin");
  });
});

describe("Phase 6 group member options", () => {
  it("only returns eligible users for the requested scope", async () => {
    const department = await createDepartment();
    const otherDepartment = await createDepartment({
      code: "MECH",
      years: [1, 2],
    });

    const teacher = await createTeacher({
      email: "options@campus.test",
      department: department._id,
      teachingYears: [2],
    });

    const eligible = await createStudent({
      email: "eligible@campus.test",
      department: department._id,
      year: 2,
    });

    await createStudent({
      email: "otheryear@campus.test",
      department: department._id,
      year: 1,
    });

    await createStudent({
      email: "otherdept@campus.test",
      department: otherDepartment._id,
      year: 2,
    });

    const disabled = await createStudent({
      email: "inactive@campus.test",
      department: department._id,
      year: 2,
    });

    disabled.isActive = false;
    await disabled.save();

    const response = await request(app)
      .get("/api/v1/chat/group-member-options")
      .query({ yearNumbers: "2", role: "student" })
      .set(...authHeader(teacher));

    expect(response.status).toBe(200);

    const emails = response.body.data.users.map(
      (user) => user.email
    );

    expect(emails).toEqual([eligible.email]);
  });

  it("locks the teacher scope options to their own department", async () => {
    const department = await createDepartment();
    const teacher = await createTeacher({
      email: "scope@campus.test",
      department: department._id,
      teachingYears: [2, 3],
    });

    const response = await request(app)
      .get("/api/v1/chat/group-scope-options")
      .set(...authHeader(teacher));

    expect(response.status).toBe(200);
    expect(response.body.data.departmentLocked).toBe(true);
    expect(response.body.data.departments).toHaveLength(1);
    expect(
      response.body.data.academicYears.map(
        (year) => year.yearNumber
      )
    ).toEqual([2, 3]);
  });

  it("refuses student access to member options", async () => {
    const department = await createDepartment();
    const student = await createStudent({
      email: "nooptions@campus.test",
      department: department._id,
      year: 2,
    });

    const response = await request(app)
      .get("/api/v1/chat/group-member-options")
      .set(...authHeader(student));

    expect(response.status).toBe(403);
  });
});

describe("Phase 6 password reset and deletion", () => {
  it("resets a password and forces the next login change", async () => {
    const admin = await createAdmin();
    const department = await createDepartment();

    const createResponse = await request(app)
      .post("/api/v1/admin/users")
      .set(...authHeader(admin))
      .send({
        role: "student",
        name: "Reset Target",
        email: "reset.target@campus.test",
        temporaryPassword: "TempPass1",
        department: department._id.toString(),
        year: 2,
        isActive: true,
      });

    expect(createResponse.status).toBe(201);

    const userId = createResponse.body.data.user.id;

    const clearFlag = await User.findById(userId);
    clearFlag.mustChangePassword = false;
    await clearFlag.save();

    const resetResponse = await request(app)
      .patch(`/api/v1/admin/users/${userId}/reset-password`)
      .set(...authHeader(admin))
      .send({ temporaryPassword: "NewTemp2A" });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.user.mustChangePassword).toBe(
      true
    );
    expect(resetResponse.body.data.user.password).toBeUndefined();
    expect(
      JSON.stringify(resetResponse.body).includes("NewTemp2A")
    ).toBe(false);

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "reset.target@campus.test",
        password: "NewTemp2A",
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.mustChangePassword).toBe(
      true
    );

    const refreshed = await User.findById(userId);
    const blocked = await request(app)
      .get("/api/v1/chat/conversations")
      .set(...authHeader(refreshed));

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
  it("detaches deleted users from group ownership safely", async () => {
    const admin = await createAdmin("owner-admin@campus.test");
    const department = await createDepartment({ code: "OWN" });
    const teacher = await createTeacher({
      email: "keep.owner@campus.test",
      department: department._id,
      teachingYears: [2],
    });
    const doomed = await createTeacher({
      email: "doomed.owner@campus.test",
      department: department._id,
      teachingYears: [2],
    });

    const groupResponse = await request(app)
      .post("/api/v1/chat/conversations/groups")
      .set(...authHeader(doomed))
      .send({
        name: "Doomed Group",
        department: department._id.toString(),
        academicYears: [2],
        memberIds: [teacher._id.toString()],
        adminIds: [teacher._id.toString()],
      });

    expect(groupResponse.status).toBe(201);

    const conversationId = groupResponse.body.data.conversation.id;

    const deleteResponse = await request(app)
      .delete(`/api/v1/admin/users/${doomed._id}`)
      .set(...authHeader(admin))
      .send({ confirmation: "DELETE" });

    expect(deleteResponse.status).toBe(200);

    const conversation = await Conversation.findById(conversationId);
    expect(conversation).toBeTruthy();
    expect(conversation.owner.toString()).not.toBe(
      doomed._id.toString()
    );

    const activeMembers = conversation.members.filter(
      (member) => member.isActive
    );

    expect(
      activeMembers.some(
        (member) => member.user.toString() === doomed._id.toString()
      )
    ).toBe(false);

    expect(
      activeMembers.some(
        (member) =>
          member.user.toString() === conversation.owner.toString() &&
          member.role === "admin"
      )
    ).toBe(true);
  });
});
