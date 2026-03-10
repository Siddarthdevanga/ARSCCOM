import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkUpsertEmployees
} from "../controllers/employee.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/",        listEmployees);
router.post("/",       createEmployee);
router.put("/:id",     updateEmployee);
router.delete("/:id",  deleteEmployee);
router.post("/bulk",   bulkUpsertEmployees);

export default router;
