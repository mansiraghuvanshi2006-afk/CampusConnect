import dns from "node:dns";
import mongoose from "mongoose";
import "dotenv/config";

import connectDB from "../src/config/database.js";

import User from "../src/models/User.js";

import Conversation, {
  CONVERSATION_TYPES,
  CONVERSATION_MEMBER_ROLES,
  GROUP_TYPES,
} from "../src/models/Conversation.js";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

/*
  Phase 6 data normalization.

  Existing accounts keep their password (mustChangePassword: false)
  and existing groups receive an owner plus a group type so the new
  permission helpers have something to work with.

  The script is safe to run repeatedly and never deletes data.

  Usage:
    npm run migrate:phase6
*/

const backfillUsers = async () => {
  const result = await User.updateMany(
    {
      $or: [
        { mustChangePassword: { $exists: false } },
        { mustChangePassword: null },
      ],
    },
    { $set: { mustChangePassword: false } }
  );

  return result.modifiedCount || 0;
};

const backfillGroups = async () => {
  const groups = await Conversation.find({
    type: { $ne: CONVERSATION_TYPES.DIRECT },
    $or: [
      { owner: { $exists: false } },
      { owner: null },
      { groupType: { $exists: false } },
      { groupType: null },
    ],
  });

  let updatedOwners = 0;
  let updatedTypes = 0;

  for (const group of groups) {
    let changed = false;

    if (!group.owner) {
      const activeMembers = (group.members || []).filter(
        (member) => member.isActive
      );

      const creatorMembership = activeMembers.find(
        (member) =>
          group.createdBy &&
          member.user.toString() === group.createdBy.toString()
      );

      const ownerMembership =
        creatorMembership ||
        activeMembers.find(
          (member) =>
            member.role === CONVERSATION_MEMBER_ROLES.ADMIN
        ) ||
        activeMembers[0];

      if (ownerMembership) {
        group.owner = ownerMembership.user;
        ownerMembership.role =
          CONVERSATION_MEMBER_ROLES.ADMIN;

        updatedOwners += 1;
        changed = true;
      }
    }

    if (!group.groupType) {
      group.groupType =
        (group.academicYears || []).length > 0
          ? GROUP_TYPES.ACADEMIC_YEAR
          : group.department
            ? GROUP_TYPES.DEPARTMENT
            : GROUP_TYPES.CUSTOM;

      updatedTypes += 1;
      changed = true;
    }

    if (changed) {
      await group.save({ validateBeforeSave: false });
    }
  }

  return { updatedOwners, updatedTypes };
};

const migrate = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from the .env file"
      );
    }

    await connectDB();

    const users = await backfillUsers();
    const groups = await backfillGroups();

    console.log("Phase 6 migration finished.");

    console.log({
      usersNormalized: users,
      groupOwnersAssigned: groups.updatedOwners,
      groupTypesAssigned: groups.updatedTypes,
    });
  } catch (error) {
    console.error(
      `Phase 6 migration failed: ${error.message}`
    );

    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

migrate();
