import { Router } from "express";
import adminRoutes from "../../routes/admin.routes.js";
import authRoutes from "../../routes/auth.routes.js";
import memberRoutes from "../../routes/member.routes.js";
import recoveryRoutes from "../../routes/recovery.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/auth/member", memberRoutes);
router.use("/", adminRoutes);
router.use("/admin/recovery", recoveryRoutes);

export default router;
