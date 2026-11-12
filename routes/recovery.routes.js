import { Router } from "express";
import {
  requestAdminRecovery,
  resetAdminPassword,
} from "../controllers/recovery.controller.js";
import { recoveryRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/request", recoveryRateLimit, requestAdminRecovery);
router.post("/reset", recoveryRateLimit, resetAdminPassword);

export default router;