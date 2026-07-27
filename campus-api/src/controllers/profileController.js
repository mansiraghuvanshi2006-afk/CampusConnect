import User, {
    USER_ROLES,
  } from "../models/User.js";
  
  import ApiError from "../utils/ApiError.js";
  import asyncHandler from "../utils/asyncHandler.js";
  
  const getPublicProfile = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    year: user.year,
    teachingYears:
      user.teachingYears || [],
    profileCompleted:
      user.profileCompleted,
    isEmailVerified:
      user.isEmailVerified,
    isActive: user.isActive,
    teacherApprovalStatus:
      user.teacherApprovalStatus,
    updatedAt: user.updatedAt,
  });
  
  /**
   * PATCH /api/v1/profile/student
   *
   * Complete or update the logged-in
   * student's department and year.
   */
  export const completeStudentProfile =
    asyncHandler(async (req, res) => {
      if (
        req.user.role !==
        USER_ROLES.STUDENT
      ) {
        throw new ApiError(
          403,
          "Only students can complete a student profile"
        );
      }
  
      const {
        department,
        year,
      } = req.body;
  
      const user =
        await User.findByIdAndUpdate(
          req.user._id,
          {
            department,
            year,
            teachingYears: [],
            profileCompleted: true,
          },
          {
            new: true,
            runValidators: true,
          }
        );
  
      if (!user) {
        throw new ApiError(
          404,
          "User account not found"
        );
      }
  
      return res.status(200).json({
        success: true,
        message:
          "Student profile completed successfully",
        data: {
          user:
            getPublicProfile(user),
        },
      });
    });
  
  /**
   * PATCH /api/v1/profile/teacher
   *
   * Complete or update the logged-in
   * teacher's department and teaching years.
   */
  export const completeTeacherProfile =
    asyncHandler(async (req, res) => {
      if (
        req.user.role !==
        USER_ROLES.TEACHER
      ) {
        throw new ApiError(
          403,
          "Only teachers can complete a teacher profile"
        );
      }
  
      const {
        department,
        teachingYears,
      } = req.body;
  
      const user =
        await User.findByIdAndUpdate(
          req.user._id,
          {
            department,
            year: null,
            teachingYears,
            profileCompleted: true,
          },
          {
            new: true,
            runValidators: true,
          }
        );
  
      if (!user) {
        throw new ApiError(
          404,
          "User account not found"
        );
      }
  
      return res.status(200).json({
        success: true,
        message:
          "Teacher profile completed successfully",
        data: {
          user:
            getPublicProfile(user),
        },
      });
    });