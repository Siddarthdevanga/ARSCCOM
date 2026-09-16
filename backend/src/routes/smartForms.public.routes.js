import express from "express";
import { getPublicForm, submitPublicResponse, getFormLogo } from "../controllers/smartForms.controller.js";

const router = express.Router();

router.get("/:slug",          getPublicForm);
router.get("/:slug/logo",     getFormLogo);
router.post("/:slug/submit",  submitPublicResponse);

export default router;
