import mongoose from "mongoose";
import bcrypt from "bcrypt";

export const USER_ROLES = Object.freeze({
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
});

export const TEACHER_APPROVAL_STATUSES =
  Object.freeze({
    NOT_REQUIRED: "not_required",
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
  });

export const DEPARTMENTS = Object.freeze({
  COMPUTER_SCIENCE:
    "computer_science",
  INFORMATION_TECHNOLOGY:
    "information_technology",
  ELECTRONICS: "electronics",
  MECHANICAL: "mechanical",
  CIVIL: "civil",
});

export const ACADEMIC_YEARS = Object.freeze({
  FIRST: 1,
  SECOND: 2,
  THIRD: 3,
  FOURTH: 4,
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [
        true,
        "Name is required",
      ],
      trim: true,
      minlength: [
        2,
        "Name must contain at least 2 characters",
      ],
      maxlength: [
        100,
        "Name cannot exceed 100 characters",
      ],
    },

    email: {
      type: String,
      required: [
        true,
        "Email is required",
      ],
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: [
        true,
        "Password is required",
      ],
      minlength: [
        8,
        "Password must contain at least 8 characters",
      ],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values:
          Object.values(USER_ROLES),
        message: "Invalid user role",
      },
      default:
        USER_ROLES.STUDENT,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    teacherApprovalStatus: {
      type: String,
      enum: {
        values: Object.values(
          TEACHER_APPROVAL_STATUSES
        ),
        message:
          "Invalid teacher approval status",
      },
      default:
        TEACHER_APPROVAL_STATUSES
          .NOT_REQUIRED,
    },

    teacherApprovedAt: {
      type: Date,
      default: null,
    },

    teacherApprovedBy: {
      type:
        mongoose.Schema.Types
          .ObjectId,
      ref: "User",
      default: null,
    },

    teacherRejectionReason: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Teacher rejection reason cannot exceed 500 characters",
      ],
      default: null,
    },

    /*
      Student and teacher profile setup
    */
    department: {
      type: String,
      enum: {
        values: [
          ...Object.values(
            DEPARTMENTS
          ),
          null,
        ],
        message:
          "Invalid department",
      },
      default: null,
    },

    /*
      Used only for students.
    */
    year: {
      type: Number,
      enum: {
        values: [
          ...Object.values(
            ACADEMIC_YEARS
          ),
          null,
        ],
        message:
          "Invalid academic year",
      },
      default: null,
    },

    /*
      Used only for teachers.
      A teacher can teach multiple years.
    */
    teachingYears: {
      type: [
        {
          type: Number,
          enum: {
            values:
              Object.values(
                ACADEMIC_YEARS
              ),
            message:
              "Invalid teaching year",
          },
        },
      ],
      default: [],
    },

    /*
      Used by the frontend to decide:

      false:
      show department/year selection page

      true:
      allow entry to chat
    */
    profileCompleted: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/*
  Set initial account state based on role.

  Student:
  - inactive until email verification
  - profile not completed

  Teacher:
  - inactive until email verification
    and admin approval
  - profile not completed

  Admin:
  - immediately verified and active
  - profile considered completed
*/
userSchema.pre(
  "validate",
  function () {
    if (!this.isNew) {
      return;
    }

    if (
      this.role ===
      USER_ROLES.ADMIN
    ) {
      this.isEmailVerified = true;
      this.isActive = true;

      this.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES
          .NOT_REQUIRED;

      this.teacherApprovedAt = null;
      this.teacherApprovedBy = null;
      this.teacherRejectionReason =
        null;

      this.department = null;
      this.year = null;
      this.teachingYears = [];
      this.profileCompleted = true;

      return;
    }

    if (
      this.role ===
      USER_ROLES.TEACHER
    ) {
      this.isEmailVerified = false;
      this.isActive = false;

      this.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES
          .PENDING;

      this.teacherApprovedAt = null;
      this.teacherApprovedBy = null;
      this.teacherRejectionReason =
        null;

      this.department = null;
      this.year = null;
      this.teachingYears = [];
      this.profileCompleted = false;

      return;
    }

    /*
      Student account
    */
    this.isEmailVerified = false;
    this.isActive = false;

    this.teacherApprovalStatus =
      TEACHER_APPROVAL_STATUSES
        .NOT_REQUIRED;

    this.teacherApprovedAt = null;
    this.teacherApprovedBy = null;
    this.teacherRejectionReason =
      null;

    this.department = null;
    this.year = null;
    this.teachingYears = [];
    this.profileCompleted = false;
  }
);

/*
  Hash password only when it is
  new or changed.
*/
userSchema.pre(
  "save",
  async function () {
    if (
      !this.isModified("password")
    ) {
      return;
    }

    const configuredRounds =
      Number.parseInt(
        process.env
          .BCRYPT_SALT_ROUNDS,
        10
      );

    const saltRounds =
      Number.isInteger(
        configuredRounds
      ) &&
      configuredRounds >= 10 &&
      configuredRounds <= 15
        ? configuredRounds
        : 12;

    this.password =
      await bcrypt.hash(
        this.password,
        saltRounds
      );
  }
);

userSchema.methods.comparePassword =
  async function (
    candidatePassword
  ) {
    if (!this.password) {
      return false;
    }

    return bcrypt.compare(
      candidatePassword,
      this.password
    );
  };

userSchema.methods.canLogin =
  function () {
    if (!this.isEmailVerified) {
      return {
        allowed: false,
        code:
          "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email before logging in",
      };
    }

    if (
      this.role ===
        USER_ROLES.TEACHER &&
      this
        .teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES
          .PENDING
    ) {
      return {
        allowed: false,
        code:
          "TEACHER_APPROVAL_PENDING",
        message:
          "Your teacher account is awaiting administrator approval",
      };
    }

    if (
      this.role ===
        USER_ROLES.TEACHER &&
      this
        .teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES
          .REJECTED
    ) {
      return {
        allowed: false,
        code:
          "TEACHER_APPROVAL_REJECTED",
        message:
          this
            .teacherRejectionReason ||
          "Your teacher account was not approved",
      };
    }

    if (
      this.role ===
        USER_ROLES.TEACHER &&
      this
        .teacherApprovalStatus !==
        TEACHER_APPROVAL_STATUSES
          .APPROVED
    ) {
      return {
        allowed: false,
        code:
          "TEACHER_NOT_APPROVED",
        message:
          "Your teacher account has not been approved",
      };
    }

    if (!this.isActive) {
      return {
        allowed: false,
        code:
          "ACCOUNT_INACTIVE",
        message:
          "Your account is currently inactive",
      };
    }

    return {
      allowed: true,
      code: "LOGIN_ALLOWED",
      message: "Login allowed",
    };
  };

userSchema.methods.toJSON =
  function () {
    const user =
      this.toObject();

    delete user.password;
    delete user
      .emailVerificationToken;
    delete user
      .emailVerificationExpiresAt;

    return user;
  };

const User = mongoose.model(
  "User",
  userSchema
);

export default User;