import express from "express";

import {
  getProfileAcademicYears,
  getProfileDepartments,
} from "../controllers/profileOptionController.js";
import authenticate from "../middleware/authenticate.js";
import requirePasswordChange from "../middleware/requirePasswordChange.js";

const router = express.Router();

router.use(authenticate, requirePasswordChange);

router.get("/departments", getProfileDepartments);
router.get(
  "/departments/:departmentId/years",
  getProfileAcademicYears
);

export default router;
