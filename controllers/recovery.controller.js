import { timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import User from "../models/globalUser.model.js";
import { sendAdminRecoveryCode } from "../services/email.service.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import { hashOneTimeToken } from "../services/token.service.js";
import generateRecoveryCode from "../utils/generateRecoveryCode.js";
import HttpError from "../utils/httpError.js";
import { normalizeEmail, validatePassword } from "../utils/validation.js";

const recoveryLifetimeMs = 10 * 60 * 1000;
const recoveryRequestCooldownMs = 60 * 1000;
const genericRequestMessage = "If an active admin account matches those details, a recovery email can be sent.";

function normalizeRecoveryContact(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "Enter your email address or phone number.");
  }
  const contact = value.trim();
  if (contact.includes("@")) return { email: normalizeEmail(contact) };
  const phone = contact.replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone)) {
    throw new HttpError(400, "Enter a valid email address or phone number.");
  }
  return { phone };
}

function hashesMatch(storedHash, candidateHash) {
  const stored = Buffer.from(storedHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

async function deliverRecoveryCode(userId, email, code) {
  try {
    await sendAdminRecoveryCode({ email, code });
  } catch {
    try {
      await User.updateOne({ userId, "adminRecovery.usedAt": null }, { $unset: { adminRecovery: 1 } });
    } catch (error) {
      console.error("Could not invalidate an undelivered recovery code.", { name: error.name || "Error" });
    }
  }
}

export async function requestAdminRecovery(request, response) {
  const startedAt = Date.now();
  const contact = normalizeRecoveryContact(request.body.email || request.body.phone || request.body.contact);
  const user = await User.findOne({ ...contact, adminRole: { $type: "string" }, status: "active", isDeleted: false }).select("+adminRecovery.codeHash");

  if (user) {
    const recovery = user.adminRecovery;
    const isRecent = recovery?.usedAt === null && recovery.createdAt > new Date(Date.now() - recoveryRequestCooldownMs);
    if (!isRecent) {
      const code = generateRecoveryCode();
      user.adminRecovery = {
        codeHash: hashOneTimeToken(code),
        expiresAt: new Date(Date.now() + recoveryLifetimeMs),
        attemptsRemaining: 5,
        usedAt: null,
        createdAt: new Date(),
      };
      await user.save();
      void deliverRecoveryCode(user.userId, user.email, code);
    }
  }

  const remainingDelay = 250 - (Date.now() - startedAt);
  if (remainingDelay > 0) await delay(remainingDelay);
  response.status(202).json({ message: genericRequestMessage });
}

export async function resetAdminPassword(request, response) {
  const contact = normalizeRecoveryContact(request.body.email || request.body.phone || request.body.contact);
  const code = typeof request.body.code === "string" ? request.body.code : "";
  const newPassword = validatePassword(request.body.newPassword);
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, "The recovery code is invalid or expired.");

  const user = await User.findOne({ ...contact, adminRole: { $type: "string" }, status: "active", isDeleted: false }).select("+authVersion +passwordHash +adminRecovery.codeHash");
  const recovery = user?.adminRecovery;
  if (!user || !recovery || recovery.usedAt !== null || recovery.expiresAt <= new Date() || recovery.attemptsRemaining <= 0) {
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }
  if (await verifyPassword(newPassword, user.passwordHash)) throw new HttpError(400, "Choose a password you have not used before.");

  const recoveryFilter = {
    _id: user._id,
    "adminRecovery.usedAt": null,
    "adminRecovery.expiresAt": { $gt: new Date() },
    "adminRecovery.attemptsRemaining": { $gt: 0 },
    "adminRecovery.codeHash": recovery.codeHash,
  };
  if (!hashesMatch(recovery.codeHash, hashOneTimeToken(code))) {
    await User.updateOne(recoveryFilter, { $inc: { "adminRecovery.attemptsRemaining": -1 } });
    throw new HttpError(400, "The recovery code is invalid or expired.");
  }

  const consumed = await User.updateOne(recoveryFilter, { $set: { "adminRecovery.usedAt": new Date() } });
  if (consumed.modifiedCount !== 1) throw new HttpError(400, "The recovery code is invalid or expired.");

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.authVersion += 1;
  user.adminRecovery = undefined;
  await user.save();
  response.json({ message: "Password reset. Please sign in with your new password." });
}
