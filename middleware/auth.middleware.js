import { timingSafeEqual } from "node:crypto";
import User from "../models/globalUser.model.js";
import HttpError from "../utils/httpError.js";
import { destroySession } from "../services/session.service.js";

async function loadAuthenticatedUser(request) {
  if (!request.session?.userId || !request.session.accountType) {
    throw new HttpError(401, "Please sign in to continue.");
  }

  const user = await User.findOne({
    userId: request.session.userId,
    status: "active",
    isDeleted: false,
  }).select("+authVersion");

  if (!user || user.authVersion !== request.session.authVersion) {
    await destroySession(request);
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }

  return user;
}

export async function requireMember(request, response, next) {
  const user = await loadAuthenticatedUser(request);
  if (
    request.session.accountType !== "member" ||
    !user.userScope.includes("supporter")
  ) {
    throw new HttpError(403, "A member account is required.");
  }

  request.user = user;
  next();
}

export async function requireAdmin(request, response, next) {
  const user = await loadAuthenticatedUser(request);
  if (request.session.accountType !== "admin" || !user.adminRole) {
    throw new HttpError(403, "An administrator account is required.");
  }

  request.user = user;
  next();
}

export function verifyCsrfToken(request, response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const expectedToken = request.session?.csrfToken;
  const suppliedToken = request.get("x-csrf-token");
  if (typeof expectedToken !== "string" || typeof suppliedToken !== "string") {
    throw new HttpError(403, "Security token is missing or expired. Refresh and retry.");
  }

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new HttpError(403, "Security token is invalid. Refresh and retry.");
  }

  next();
}