import express from "express";

import {
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
  updateDepartment,
} from "../../controllers/admin/departmentController.js";

import validateRequest from "../../middleware/validateRequest.js";

import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../../validators/departmentValidation.js";

const router = express.Router();

router
  .route("/")
  .post(validateRequest(createDepartmentSchema), createDepartment)
  .get(getDepartments);

router
  .route("/:departmentId")
  .get(getDepartmentById)
  .patch(validateRequest(updateDepartmentSchema), updateDepartment)
  .delete(deleteDepartment);

export default router;