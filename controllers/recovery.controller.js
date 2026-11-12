import { timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import RecoveryCode from "../models/recoveryCode.model.js";
import User from "../models/globalUser.model.js";
import { sendAdminRecoveryCode } from "../services/email.service.js";
import {
  hashPassword,
  verifyPassword,
} from "../services/password.service.js";
import { hashOneTimeToken } from "../services/token.service.js";
import generateRecoveryCode from "../utils/generateRecoveryCode.js";
import HttpError from "../utils/httpError.js";
import {
  normalizeEmail,
  validatePassword,
} from "../utils/validation.js";

const recoveryLifetimeMs = 10 * 60 * 1000;
const recoveryRequestCooldownMs = 60 * 1000;
const genericRequestMessage =
  "If an active admin account matches that email, a recovery email can be sent.";
const minimumRequestDurationMs = 250;

function hashesMatch(storedHash, candidateHash) {
  const stored = Buffer.from(storedHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

async function deliverRecoveryCode(recoveryId, email, code) {
  try {
    await sendAdminRecoveryCode({ email, code });
  } catch {
    try {
      const result = await RecoveryCode.deleteOne({ _id: recoveryId });
      if (result.deletedCount !== 1) {
        console.error("Could not invalidate an undelivered recovery code.");
      }
    } catch (error) {
      console.error("Could not invalidate an undelivered recovery code.", {
        name: error.name || "Error",
      });
    }
  }
}

export async function requestAdminRecovery(request, response) {
  const startedAt = Date.now();
  const email = normalizeEmail(request.body.email || request.body.contact);
  const user = await User.findOne({
    email,
    adminRole: { $type: "string" },
    status: "active",
    isDeleted: false,
  });

  if (user) {
    const recentCode = await RecoveryCode.findOne({
      userId: user.userId,
      purpose: "admin_password_reset",
      usedAt: null,
      createdAt: { $gt: new Date(Date.now() - recoveryRequestCooldownMs) },
    });

    if (!recentCode) {
      await RecoveryCode.deleteMany({
        userId: user.userId,
        purpose: "admin_password_reset",
        usedAt: null,
      });

      const code = generateRecoveryCode();
      const recovery = await RecoveryCode.create({
        userId: user.userId,
        codeHash: hashOneTimeToken(code),
        purpose: "admin_password_reset",
        expiresAt: new Date(Date.now() + recoveryLifetimeMs),
      });

      void deliverRecoveryCode(recovery._id, email, code);
    }
  }

  const remainingDelay = minimumRequestDurationMs - (Date.now() - startedAt);
  if (remainingDelay > 0) await delay(remainingDelay);
  response.status(202).json({ message: genericRequestMessage });
}

export async function resetAdminPassword(request, response) {
  const email = normalizeEmail(request.body.email || request.body.contact);
  const code = typeof request.body.code === "string" ? request.body.code : "";
  const newPassword = validatePassword(request.body.newPassword);

  if (!/^\d{6}$/.test(code)) {
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }

  const user = await User.findOne({
    email,
    adminRole: { $type: "string" },
    status: "active",
    isDeleted: false,
  }).select("+authVersion +passwordHash");
  const recovery = user
    ? await RecoveryCode.findOne({
        userId: user.userId,
        purpose: "admin_password_reset",
        usedAt: null,
        expiresAt: { $gt: new Date() },
        attemptsRemaining: { $gt: 0 },
      }).select("+codeHash")
    : null;

  if (!user || !recovery) {
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new HttpError(400, "Choose a password you have not used before.");
  }

  if (!hashesMatch(recovery.codeHash, hashOneTimeToken(code))) {
    await RecoveryCode.updateOne(
      { _id: recovery._id, usedAt: null, attemptsRemaining: { $gt: 0 } },
      { $inc: { attemptsRemaining: -1 } },
    );
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }

  const consumed = await RecoveryCode.updateOne(
    {
      _id: recovery._id,
      usedAt: null,
      expiresAt: { $gt: new Date() },
      attemptsRemaining: { $gt: 0 },
    },
    { $set: { usedAt: new Date() } },
  );
  if (consumed.modifiedCount !== 1) {
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.authVersion += 1;
  await user.save();

  response.json({ message: "Password reset. Please sign in with your new password." });
}