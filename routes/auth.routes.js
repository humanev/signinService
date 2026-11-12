import { randomBytes } from "node:crypto";
import { Router } from "express";
import { requireMember } from "../middleware/auth.middleware.js";
import {
  destroySession,
  saveSession,
} from "../services/session.service.js";
import { getCurrentMember } from "../controllers/member.controller.js";
import {
  SESSION_COOKIE_NAME,
  sessionCookieClearOptions,
} from "../config/session.js";

const router = Router();

router.get("/csrf", async (request, response) => {
  if (!request.session.csrfToken) {
    request.session.csrfToken = randomBytes(32).toString("base64url");
    await saveSession(request);
  }

  response.set("Cache-Control", "no-store");
  response.json({ csrfToken: request.session.csrfToken });
});

router.post("/logout", async (request, response) => {
  await destroySession(request);
  response.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions);
  response.status(204).end();
});

router.get("/me", requireMember, getCurrentMember);

export default router;
