import express from "express";

import {
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYearById,
  getAcademicYearsByDepartment,
  updateAcademicYear,
} from "../controllers/admin/academicYearController.js";

import validateRequest from "../middleware/validateRequest.js";

import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} from "../validators/academicYearValidation.js";

const router = express.Router();

/**
 * Department academic-year routes
 */

// Get all years for one department
router.get(
  "/departments/:departmentId/years",
  getAcademicYearsByDepartment
);

// Manually create a year for one department
router.post(
  "/departments/:departmentId/years",
  validateRequest(createAcademicYearSchema),
  createAcademicYear
);

/**
 * Individual academic-year routes
 */

// Get one academic year
router.get(
  "/academic-years/:academicYearId",
  getAcademicYearById
);

// Update one academic year
router.patch(
  "/academic-years/:academicYearId",
  validateRequest(updateAcademicYearSchema),
  updateAcademicYear
);

// Delete one academic year
router.delete(
  "/academic-years/:academicYearId",
  deleteAcademicYear
);

export default router;