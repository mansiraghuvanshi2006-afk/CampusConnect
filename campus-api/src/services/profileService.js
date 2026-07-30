import User, { USER_ROLES } from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import {
  PROFILE_EDITABLE_FIELDS,
  PROFILE_FORBIDDEN_FIELDS,
  serializeMyProfile,
} from "../utils/profileSerializers.js";
import {
  buildAvatarUrl,
  removeAvatarFile,
} from "../middleware/uploadMiddleware.js";

const SOCIAL_LINK_KEYS = Object.freeze([
  "linkedin",
  "github",
  "twitter",
  "website",
]);

const isHttpUrl = (value) => {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Build an allowlisted update object from request body.
 * Never applies req.body directly to the User document.
 */
export const buildProfileUpdate = (role, body = {}) => {
  const allowed = PROFILE_EDITABLE_FIELDS[role];

  if (!allowed) {
    throw new ApiError(403, "This role cannot update a profile");
  }

  for (const key of Object.keys(body)) {
    if (PROFILE_FORBIDDEN_FIELDS.includes(key)) {
      throw new ApiError(
        403,
        `You cannot change ${key} from this endpoint`
      );
    }

    if (!allowed.includes(key) && key !== "socialLinks") {
      if (!allowed.includes(key)) {
        throw new ApiError(
          400,
          `Field "${key}" is not editable for your role`
        );
      }
    }
  }

  const update = {};

  if (allowed.includes("name") && body.name !== undefined) {
    update.name = String(body.name).trim();
  }

  if (allowed.includes("bio") && body.bio !== undefined) {
    update.bio = String(body.bio).trim();
  }

  if (allowed.includes("phone") && body.phone !== undefined) {
    update.phone = String(body.phone).trim();
  }

  if (allowed.includes("dob") && body.dob !== undefined) {
    if (body.dob === null || body.dob === "") {
      update.dob = null;
    } else {
      const parsed = new Date(body.dob);
      if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, "Invalid date of birth");
      }
      if (parsed > new Date()) {
        throw new ApiError(400, "Date of birth cannot be in the future");
      }
      update.dob = parsed;
    }
  }

  if (allowed.includes("gender") && body.gender !== undefined) {
    update.gender = body.gender === null ? "" : String(body.gender);
  }

  if (allowed.includes("address") && body.address !== undefined) {
    update.address = String(body.address).trim();
  }

  if (
    allowed.includes("qualification") &&
    body.qualification !== undefined
  ) {
    update.qualification = String(body.qualification).trim();
  }

  if (allowed.includes("experience") && body.experience !== undefined) {
    update.experience = String(body.experience).trim();
  }

  if (
    allowed.includes("specialization") &&
    body.specialization !== undefined
  ) {
    update.specialization = String(body.specialization).trim();
  }

  if (allowed.includes("office") && body.office !== undefined) {
    update.office = String(body.office).trim();
  }

  if (allowed.includes("designation") && body.designation !== undefined) {
    update.designation = String(body.designation).trim();
  }

  if (allowed.includes("socialLinks") && body.socialLinks !== undefined) {
    if (
      typeof body.socialLinks !== "object" ||
      body.socialLinks === null ||
      Array.isArray(body.socialLinks)
    ) {
      throw new ApiError(400, "socialLinks must be an object");
    }

    for (const key of Object.keys(body.socialLinks)) {
      if (!SOCIAL_LINK_KEYS.includes(key)) {
        throw new ApiError(400, `Invalid social link: ${key}`);
      }
    }

    const socialLinks = {};

    for (const key of SOCIAL_LINK_KEYS) {
      if (body.socialLinks[key] !== undefined) {
        const value = String(body.socialLinks[key] || "").trim();
        if (!isHttpUrl(value)) {
          throw new ApiError(
            400,
            `${key} must be a valid http(s) URL`
          );
        }
        socialLinks[`socialLinks.${key}`] = value;
      }
    }

    Object.assign(update, socialLinks);
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No editable profile fields were provided");
  }

  return update;
};

export const getMyProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate("department", "name code")
    .select("-password -emailVerificationToken -emailVerificationExpiresAt");

  if (!user) {
    throw new ApiError(404, "User account not found");
  }

  return serializeMyProfile(user);
};

export const updateMyProfile = async (user, body) => {
  const update = buildProfileUpdate(user.role, body);

  const updated = await User.findByIdAndUpdate(user._id, update, {
    returnDocument: "after",
    runValidators: true,
  })
    .populate("department", "name code")
    .select("-password -emailVerificationToken -emailVerificationExpiresAt");

  if (!updated) {
    throw new ApiError(404, "User account not found");
  }

  return serializeMyProfile(updated);
};

export const updateMyAvatar = async (user, fileName) => {
  const previousAvatarUrl = user.avatarUrl;
  const avatarUrl = buildAvatarUrl(fileName);

  const updated = await User.findByIdAndUpdate(
    user._id,
    { avatarUrl },
    { returnDocument: "after", runValidators: true }
  )
    .populate("department", "name code")
    .select("-password -emailVerificationToken -emailVerificationExpiresAt");

  if (!updated) {
    throw new ApiError(404, "User account not found");
  }

  removeAvatarFile(previousAvatarUrl);

  return serializeMyProfile(updated);
};

export const deleteMyAvatar = async (user) => {
  const previousAvatarUrl = user.avatarUrl;

  const updated = await User.findByIdAndUpdate(
    user._id,
    { avatarUrl: null },
    { returnDocument: "after", runValidators: true }
  )
    .populate("department", "name code")
    .select("-password -emailVerificationToken -emailVerificationExpiresAt");

  if (!updated) {
    throw new ApiError(404, "User account not found");
  }

  removeAvatarFile(previousAvatarUrl);

  return serializeMyProfile(updated);
};

export const assertCanEditSelfProfile = (user) => {
  if (
    ![USER_ROLES.STUDENT, USER_ROLES.TEACHER, USER_ROLES.ADMIN].includes(
      user.role
    )
  ) {
    throw new ApiError(403, "Profile editing is not available for this role");
  }
};
