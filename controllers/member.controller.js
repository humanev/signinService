import User from "../models/globalUser.model.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import { startAuthenticatedSession } from "../services/session.service.js";
import HttpError from "../utils/httpError.js";
import {
  normalizeEmail,
  validateFullName,
  validatePassword,
} from "../utils/validation.js";

function publicMember(user) {
  return {
    id: user.userId,
    fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    membershipPlan: "Free Member",
  };
}

function nameParts(fullName) {
  const [firstName, ...lastNameParts] = fullName.split(" ");
  return {
    firstName,
    lastName: lastNameParts.join(" ") || firstName,
  };
}

export async function registerMember(request, response) {
  const email = normalizeEmail(request.body.email);
  const fullName = validateFullName(request.body.fullName);
  const password = validatePassword(request.body.password);
  const existingUser = await User.findOne({
    email,
    userScope: "supporter",
    isDeleted: false,
  });

  if (existingUser) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    ...nameParts(fullName),
    fullName,
    email,
    passwordHash,
    userScope: ["supporter"],
  });

  await startAuthenticatedSession(request, user, "member");
  response.status(201).json({ user: publicMember(user) });
}

export async function loginMember(request, response) {
  const email = normalizeEmail(request.body.email);
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const user = await User.findOne({
    email,
    userScope: "supporter",
    status: "active",
    isDeleted: false,
  }).select("+passwordHash +authVersion");
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  await startAuthenticatedSession(request, user, "member");
  response.json({ user: publicMember(user) });
}

export function getCurrentMember(request, response) {
  response.json({ user: publicMember(request.user) });
}