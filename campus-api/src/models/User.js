import mongoose from "mongoose";
import bcrypt from "bcrypt";

export const USER_ROLES = Object.freeze({
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must contain at least 8 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: "Invalid user role",
      },
      default: USER_ROLES.STUDENT,
    },

    isActive: {
      type: Boolean,
      default: true,
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

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const configuredRounds = Number.parseInt(
    process.env.BCRYPT_SALT_ROUNDS,
    10
  );

  const saltRounds =
    Number.isInteger(configuredRounds) &&
    configuredRounds >= 10 &&
    configuredRounds <= 15
      ? configuredRounds
      : 12;

  this.password = await bcrypt.hash(
    this.password,
    saltRounds
  );
});

userSchema.methods.comparePassword = async function (
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

userSchema.methods.toJSON = function () {
  const user = this.toObject();

  delete user.password;

  return user;
};

const User = mongoose.model("User", userSchema);

export default User;