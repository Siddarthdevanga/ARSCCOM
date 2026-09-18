import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  listForms, getForm, createForm, updateForm, retireForm, deleteForm, uploadFormLogo,
  getResponses, exportResponses,
} from "../controllers/smartForms.controller.js";

const router = express.Router();
router.use(authenticate);

router.get("/",                listForms);
router.post("/",               createForm);
router.get("/:id",             getForm);
router.put("/:id",             updateForm);
router.delete("/:id",          retireForm);
router.delete("/:id/permanent", deleteForm);
router.put("/:id/logo",              upload.single("logo"), uploadFormLogo);
router.get("/:id/responses",         getResponses);
router.get("/:id/responses/export",  exportResponses);

export default router;
