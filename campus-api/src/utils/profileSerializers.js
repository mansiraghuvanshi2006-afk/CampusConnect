/**
 * Shared safe serializers for profile and settings.
 * Never includes passwords, hashes, tokens or secrets.
 */

const getSocialLinks = (user) => ({
  linkedin: user.socialLinks?.linkedin || "",
  github: user.socialLinks?.github || "",
  twitter: user.socialLinks?.twitter || "",
  website: user.socialLinks?.website || "",
});

const getDefaultSettings = () => ({
  theme: "dark",
  language: "en",
  notifications: {
    chatMessages: true,
    groupUpdates: true,
    callAlerts: true,
    aiUpdates: true,
    emailDigest: false,
  },
  privacy: {
    showOnlineStatus: true,
    showLastSeen: true,
    showProfileToCampus: true,
  },
});

export const serializeSettings = (user) => {
  const defaults = getDefaultSettings();
  const settings = user.settings || {};

  return {
    theme: settings.theme || defaults.theme,
    language: settings.language || defaults.language,
    notifications: {
      ...defaults.notifications,
      ...(settings.notifications || {}),
    },
    privacy: {
      ...defaults.privacy,
      ...(settings.privacy || {}),
    },
  };
};

/**
 * Full self-profile payload for the logged-in user.
 */
export const serializeMyProfile = (user) => {
  const department =
    user.department && typeof user.department === "object"
      ? {
          id: user.department._id?.toString() || String(user.department),
          name: user.department.name || null,
          code: user.department.code || null,
        }
      : user.department
        ? { id: String(user.department), name: null, code: null }
        : null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    phone: user.phone || "",
    dob: user.dob || null,
    gender: user.gender || "",
    address: user.address || "",
    avatarUrl: user.avatarUrl || null,
    socialLinks: getSocialLinks(user),
    qualification: user.qualification || "",
    experience: user.experience || "",
    specialization: user.specialization || "",
    office: user.office || "",
    designation: user.designation || "",
    department,
    year: user.year ?? null,
    teachingYears: user.teachingYears || [],
    profileCompleted: user.profileCompleted,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    mustChangePassword: Boolean(user.mustChangePassword),
    teacherApprovalStatus: user.teacherApprovalStatus,
    teacherApprovedAt: user.teacherApprovedAt,
    teacherRejectionReason: user.teacherRejectionReason,
    settings: serializeSettings(user),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Fields each role may update via PATCH /profile/me.
 * Email, role, department, year, teachingYears and admin
 * privileges are intentionally excluded.
 */
export const PROFILE_EDITABLE_FIELDS = Object.freeze({
  student: Object.freeze([
    "name",
    "bio",
    "phone",
    "dob",
    "gender",
    "address",
    "socialLinks",
  ]),
  teacher: Object.freeze([
    "name",
    "bio",
    "phone",
    "qualification",
    "experience",
    "specialization",
    "office",
    "socialLinks",
  ]),
  admin: Object.freeze([
    "name",
    "bio",
    "phone",
    "designation",
    "socialLinks",
  ]),
});

export const PROFILE_FORBIDDEN_FIELDS = Object.freeze([
  "email",
  "password",
  "role",
  "department",
  "year",
  "teachingYears",
  "isActive",
  "isEmailVerified",
  "profileCompleted",
  "mustChangePassword",
  "teacherApprovalStatus",
  "teacherApprovedAt",
  "teacherApprovedBy",
  "teacherRejectionReason",
  "tokenVersion",
  "createdBy",
  "settings",
  "avatarUrl",
]);
