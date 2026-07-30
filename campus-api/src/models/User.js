import mongoose from "mongoose";
import bcrypt from "bcrypt";

export const USER_ROLES =
  Object.freeze({
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

export const ACADEMIC_YEARS =
  Object.freeze({
    FIRST: 1,
    SECOND: 2,
    THIRD: 3,
    FOURTH: 4,
    FIFTH: 5,
    SIXTH: 6,
    SEVENTH: 7,
    EIGHTH: 8,
    NINTH: 9,
    TENTH: 10,
  });

const userSchema =
  new mongoose.Schema(
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
          message:
            "Invalid user role",
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

      /*
        Teacher approval state.

        Students and admins use:
        not_required

        Teachers use:
        pending
        approved
        rejected
      */
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
        Department is selected from the
        departments created by the admin.
      */
      department: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Department",
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

        A teacher can teach students
        from multiple academic years.
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
        Used by the frontend to decide
        whether the profile setup page
        should be displayed.
      */
      profileCompleted: {
        type: Boolean,
        default: false,
      },

      /*
        Student:
        becomes active after email
        verification.

        Teacher:
        becomes active after email
        verification and admin approval.

        Admin:
        active immediately.
      */
      isActive: {
        type: Boolean,
        default: false,
      },

      /*
        Set to true for accounts provisioned by
        an administrator with a temporary password.

        Self-registered users keep false.
      */
      mustChangePassword: {
        type: Boolean,
        default: false,
      },

      passwordChangedAt: {
        type: Date,
        default: null,
      },

      /*
        Administrator who provisioned this account.
        Null for self-registered users.
      */
      createdBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        default: null,
      },

      lastLoginAt: {
        type: Date,
        default: null,
      },

      /*
        Last time the user disconnected from chat.
        Used for offline presence displays.
      */
      lastSeenAt: {
        type: Date,
        default: null,
      },

      /*
        Incremented on logout-all-devices so existing
        access tokens become invalid immediately.
      */
      tokenVersion: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* ---------- Phase 8 profile fields ---------- */

      bio: {
        type: String,
        trim: true,
        maxlength: [
          500,
          "Bio cannot exceed 500 characters",
        ],
        default: "",
      },

      phone: {
        type: String,
        trim: true,
        maxlength: [
          30,
          "Phone cannot exceed 30 characters",
        ],
        default: "",
      },

      dob: {
        type: Date,
        default: null,
      },

      gender: {
        type: String,
        enum: {
          values: [
            "male",
            "female",
            "other",
            "prefer_not_to_say",
            "",
            null,
          ],
          message: "Invalid gender",
        },
        default: "",
      },

      address: {
        type: String,
        trim: true,
        maxlength: [
          300,
          "Address cannot exceed 300 characters",
        ],
        default: "",
      },

      avatarUrl: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      socialLinks: {
        linkedin: {
          type: String,
          trim: true,
          maxlength: 300,
          default: "",
        },
        github: {
          type: String,
          trim: true,
          maxlength: 300,
          default: "",
        },
        twitter: {
          type: String,
          trim: true,
          maxlength: 300,
          default: "",
        },
        website: {
          type: String,
          trim: true,
          maxlength: 300,
          default: "",
        },
      },

      /* Teacher-only profile fields */
      qualification: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      experience: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      specialization: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      office: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      /* Admin-only profile field */
      designation: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      /*
        Account preferences (theme, notifications,
        privacy, language). Defaults preserve the
        existing dark Discord-like design.
      */
      settings: {
        theme: {
          type: String,
          enum: ["dark", "light", "system"],
          default: "dark",
        },
        language: {
          type: String,
          trim: true,
          maxlength: 20,
          default: "en",
        },
        notifications: {
          chatMessages: {
            type: Boolean,
            default: true,
          },
          groupUpdates: {
            type: Boolean,
            default: true,
          },
          callAlerts: {
            type: Boolean,
            default: true,
          },
          aiUpdates: {
            type: Boolean,
            default: true,
          },
          emailDigest: {
            type: Boolean,
            default: false,
          },
        },
        privacy: {
          showOnlineStatus: {
            type: Boolean,
            default: true,
          },
          showLastSeen: {
            type: Boolean,
            default: true,
          },
          showProfileToCampus: {
            type: Boolean,
            default: true,
          },
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

/*
  Admin-provisioned accounts skip the
  self-registration state reset below because the
  administrator supplies verification, approval and
  profile values that the server has already validated.

  Set with:
  user.$locals.adminProvisioned = true
*/
export const markAdminProvisioned = (user) => {
  user.$locals.adminProvisioned = true;

  return user;
};

/*
  Set the initial account state
  based on the selected role.
*/
userSchema.pre(
  "validate",
  function () {
    if (!this.isNew) {
      return;
    }

    if (this.$locals.adminProvisioned) {
      return;
    }

    /*
      Admin account
    */
    if (
      this.role ===
      USER_ROLES.ADMIN
    ) {
      this.isEmailVerified = true;
      this.isActive = true;
      this.profileCompleted = true;

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

      return;
    }

    /*
      Teacher account
    */
    if (
      this.role ===
      USER_ROLES.TEACHER
    ) {
      this.isEmailVerified = false;
      this.isActive = false;
      this.profileCompleted = false;

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

      return;
    }

    /*
      Student account
    */
    this.isEmailVerified = false;
    this.isActive = false;
    this.profileCompleted = false;

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
  }
);

/*
  Hash the password only when it
  is created or changed.
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

    this.passwordChangedAt =
      new Date();
  }
);

/*
  Compare a login password with
  the stored password hash.
*/
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

/*
  Decide whether the user is
  allowed to log in.

  Pending and rejected teachers may
  log in with limited frontend access.

  This allows them to:
  - complete their profile
  - see the pending approval page
  - see the rejection reason
*/
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

    /*
      Teacher login rules
    */
    if (
      this.role ===
      USER_ROLES.TEACHER
    ) {
      if (
        this.teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES
          .PENDING
      ) {
        return {
          allowed: true,
          code:
            "TEACHER_APPROVAL_PENDING",
          message:
            "Login allowed with limited access while awaiting administrator approval",
        };
      }

      if (
        this.teacherApprovalStatus ===
        TEACHER_APPROVAL_STATUSES
          .REJECTED
      ) {
        return {
          allowed: true,
          code:
            "TEACHER_APPROVAL_REJECTED",
          message:
            this
              .teacherRejectionReason ||
            "Your teacher account was not approved",
        };
      }

      if (
        this.teacherApprovalStatus !==
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
        code:
          "LOGIN_ALLOWED",
        message:
          "Login allowed",
      };
    }

    /*
      Student and admin login rules
    */
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
      code:
        "LOGIN_ALLOWED",
      message:
        "Login allowed",
    };
  };

/*
  Remove private fields before
  returning the user as JSON.
*/
userSchema.methods.toJSON =
  function () {
    const user =
      this.toObject();

    delete user.password;

    delete user
      .emailVerificationToken;

    delete user
      .emailVerificationExpiresAt;

    delete user.tokenVersion;

    return user;
  };

const User =
  mongoose.model(
    "User",
    userSchema
  );

export default User;
