import express from "express";

import {
  getProfileAcademicYears,
  getProfileDepartments,
} from "../controllers/profileOptionController.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.get("/departments", getProfileDepartments);
router.get(
  "/departments/:departmentId/years",
  getProfileAcademicYears
);

export default router;
