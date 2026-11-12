import { Router } from "express";
import {
  getCurrentMember,
  loginMember,
  registerMember,
} from "../controllers/member.controller.js";
import { requireMember } from "../middleware/auth.middleware.js";
import { authRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/register", authRateLimit, registerMember);
router.post("/login", authRateLimit, loginMember);
router.get("/me", requireMember, getCurrentMember);

export default router;