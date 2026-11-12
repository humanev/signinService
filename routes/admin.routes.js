import { Router } from "express";
import {
  acceptAdminInvitation,
  changeAdminPassword,
  changeAdminRole,
  getAdminProfile,
  getAdminSession,
  inviteAdmin,
  listAdmins,
  loginAdmin,
  removeAdmin,
} from "../controllers/admin.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { requireOwner } from "../middleware/role.middleware.js";
import { authRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/auth/login", authRateLimit, loginAdmin);
router.post("/auth/signup", authRateLimit, acceptAdminInvitation);

router.get("/admin/session", requireAdmin, getAdminSession);
router.get("/admin/team", requireAdmin, requireOwner, listAdmins);
router.post("/admin/team", requireAdmin, requireOwner, inviteAdmin);
router.patch(
  "/admin/team/:userId/role",
  requireAdmin,
  requireOwner,
  changeAdminRole,
);
router.delete(
  "/admin/team/:userId",
  requireAdmin,
  requireOwner,
  removeAdmin,
);

router.get("/admin/profile", requireAdmin, getAdminProfile);
router.post(
  "/admin/profile/password",
  requireAdmin,
  authRateLimit,
  changeAdminPassword,
);

export default router;