import User from "../models/globalUser.model.js";
import {
  consumeAdminInvitation,
  createAdminInvitation,
  releaseAdminInvitation,
} from "../services/invitation.service.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import { startAuthenticatedSession } from "../services/session.service.js";
import HttpError from "../utils/httpError.js";
import {
  normalizeEmail,
  validateAdminRole,
  validatePassword,
} from "../utils/validation.js";

function publicAdmin(user) {
  return { id: user.userId, email: user.email, role: user.adminRole };
}

function adminName(email) {
  return { fullName: email.split("@")[0].slice(0, 60) };
}

export async function loginAdmin(request, response) {
  const email = normalizeEmail(request.body.email);
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const user = await User.findOne({
    email,
    adminRole: { $type: "string" },
    status: "active",
    isDeleted: false,
  }).select("+passwordHash +authVersion");
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  await startAuthenticatedSession(request, user, "admin");
  response.json({ user: publicAdmin(user) });
}

export async function acceptAdminInvitation(request, response) {
  const email = normalizeEmail(request.body.email);
  const signupCode = request.body.signupCode;
  const password = validatePassword(request.body.password);
  if (request.body.confirmPassword !== password) {
    throw new HttpError(400, "Password and confirm password must match.");
  }

  if (typeof signupCode !== "string" || signupCode.length < 24 || signupCode.length > 100) {
    throw new HttpError(400, "The invitation code is invalid or expired.");
  }

  const invitation = await consumeAdminInvitation({ email, code: signupCode });
  const existingAdmin = await User.findOne({
    email,
    adminRole: { $type: "string" },
  });
  if (existingAdmin) {
    await releaseAdminInvitation(invitation);
    throw new HttpError(409, "An administrator account with this email already exists.");
  }

  let user;
  try {
    user = await User.create({
      ...adminName(email),
      email,
      passwordHash: await hashPassword(password),
      adminRole: invitation.role,
      userScope: ["admin", invitation.role],
      createdBy: invitation.invitedBy,
    });
  } catch (error) {
    try {
      await releaseAdminInvitation(invitation);
    } catch (cleanupError) {
      console.error("Could not release a failed admin invitation.", {
        name: cleanupError.name || "Error",
      });
    }
    throw error;
  }

  await startAuthenticatedSession(request, user, "admin");
  response.status(201).json({ user: publicAdmin(user) });
}

export function getAdminSession(request, response) {
  response.json({ user: publicAdmin(request.user) });
}

export async function inviteAdmin(request, response) {
  const email = normalizeEmail(request.body.email);
  const role = validateAdminRole(request.body.role);
  const existingAdmin = await User.findOne({
    email,
    adminRole: { $type: "string" },
  });
  if (existingAdmin) {
    throw new HttpError(409, "An administrator account with this email already exists.");
  }

  await createAdminInvitation({ email, role, invitedBy: request.user.userId });
  response.status(202).json({ message: "Invitation email sent." });
}

export async function listAdmins(request, response) {
  const admins = await User.find({
    adminRole: { $type: "string" },
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .select("userId email adminRole createdAt");

  response.json({
    admins: admins.map((admin) => ({
      ...publicAdmin(admin),
      createdAt: admin.createdAt,
    })),
  });
}

export async function changeAdminRole(request, response) {
  const role = validateAdminRole(request.body.role);
  const admin = await User.findOne({
    userId: request.params.userId,
    adminRole: { $type: "string" },
    isDeleted: false,
  }).select("+authVersion");
  if (!admin) {
    throw new HttpError(404, "Administrator not found.");
  }
  if (admin.adminRole === "owner") {
    throw new HttpError(403, "The owner role cannot be changed here.");
  }

  admin.adminRole = role;
  const adminRoleScopes = new Set(["editor", "publisher", "supporter"]);
  admin.userScope = [
    ...new Set([
      ...admin.userScope.filter((scope) => !adminRoleScopes.has(scope)),
      "admin",
      role,
    ]),
  ];
  admin.lastUpdatedBy = request.user.userId;
  await admin.save();

  response.json({ admin: publicAdmin(admin) });
}

export async function removeAdmin(request, response) {
  if (request.params.userId === request.user.userId) {
    throw new HttpError(400, "You cannot remove your own administrator access.");
  }

  const admin = await User.findOne({
    userId: request.params.userId,
    adminRole: { $type: "string" },
    isDeleted: false,
  }).select("+authVersion");
  if (!admin) {
    throw new HttpError(404, "Administrator not found.");
  }
  if (admin.adminRole === "owner") {
    throw new HttpError(403, "The owner account cannot be removed here.");
  }

  admin.status = "inactive";
  admin.isDeleted = true;
  admin.authVersion += 1;
  admin.lastUpdatedBy = request.user.userId;
  await admin.save();

  response.status(204).end();
}

export function getAdminProfile(request, response) {
  response.json({
    profile: { email: request.user.email, role: request.user.adminRole },
  });
}

export async function changeAdminPassword(request, response) {
  const currentPassword =
    typeof request.body.currentPassword === "string" ? request.body.currentPassword : "";
  const newPassword = validatePassword(request.body.newPassword);
  const user = await User.findOne({
    userId: request.user.userId,
    adminRole: { $type: "string" },
    status: "active",
    isDeleted: false,
  }).select("+passwordHash +authVersion");

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(401, "Current password is incorrect.");
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new HttpError(400, "Choose a password you have not used before.");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.authVersion += 1;
  await user.save();
  await startAuthenticatedSession(request, user, "admin");

  response.json({ message: "Password updated. Other active sessions were signed out." });
}
