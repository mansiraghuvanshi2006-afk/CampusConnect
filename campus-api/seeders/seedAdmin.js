import dns from "node:dns";
import mongoose from "mongoose";
import "dotenv/config";

import connectDB from "../src/config/database.js";

import User, {
  USER_ROLES,
  TEACHER_APPROVAL_STATUSES,
} from "../src/models/User.js";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

const seedAdmin = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from the .env file"
      );
    }

    if (!process.env.ADMIN_EMAIL?.trim()) {
      throw new Error(
        "ADMIN_EMAIL is missing from the .env file"
      );
    }

    if (!process.env.ADMIN_PASSWORD) {
      throw new Error(
        "ADMIN_PASSWORD is missing from the .env file"
      );
    }

    if (
      process.env.ADMIN_PASSWORD.length < 8
    ) {
      throw new Error(
        "ADMIN_PASSWORD must contain at least 8 characters"
      );
    }

    await connectDB();

    const normalizedEmail =
      process.env.ADMIN_EMAIL
        .trim()
        .toLowerCase();

    const adminName =
      process.env.ADMIN_NAME?.trim() ||
      "CampusConnect Admin";

    const existingAccount =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingAccount) {
      existingAccount.name =
        adminName;

      existingAccount.role =
        USER_ROLES.ADMIN;

      existingAccount.isEmailVerified =
        true;

      existingAccount.isActive =
        true;

      existingAccount.teacherApprovalStatus =
        TEACHER_APPROVAL_STATUSES.NOT_REQUIRED;

      existingAccount.teacherApprovedAt =
        null;

      existingAccount.teacherApprovedBy =
        null;

      existingAccount.teacherRejectionReason =
        null;

      existingAccount.emailVerificationToken =
        null;

      existingAccount.emailVerificationExpiresAt =
        null;

      /*
        The seeded root admin owns its password through the
        .env file, so it never has to change it on login.
      */
      existingAccount.mustChangePassword =
        false;

      /*
        Update the admin password using ADMIN_PASSWORD
        from the .env file. The User model will hash it
        automatically before saving.
      */
      existingAccount.password =
        process.env.ADMIN_PASSWORD;

      await existingAccount.save();

      console.log(
        "Existing admin account updated successfully."
      );

      console.log({
        id: existingAccount._id.toString(),
        name: existingAccount.name,
        email: existingAccount.email,
        role: existingAccount.role,
        isEmailVerified:
          existingAccount.isEmailVerified,
        isActive:
          existingAccount.isActive,
        teacherApprovalStatus:
          existingAccount.teacherApprovalStatus,
      });

      return;
    }

    const admin = await User.create({
      name: adminName,
      email: normalizedEmail,
      password:
        process.env.ADMIN_PASSWORD,
      role: USER_ROLES.ADMIN,
      isEmailVerified: true,
      isActive: true,
      teacherApprovalStatus:
        TEACHER_APPROVAL_STATUSES.NOT_REQUIRED,
    });

    console.log(
      "Admin account created successfully."
    );

    console.log({
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isEmailVerified:
        admin.isEmailVerified,
      isActive: admin.isActive,
      teacherApprovalStatus:
        admin.teacherApprovalStatus,
    });
  } catch (error) {
    console.error(
      `Failed to seed admin: ${error.message}`
    );

    process.exitCode = 1;
  } finally {
    if (
      mongoose.connection.readyState !== 0
    ) {
      await mongoose.disconnect();
    }
  }
};

seedAdmin();