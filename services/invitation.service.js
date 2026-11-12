import AdminInvitation from "../models/adminInvitation.model.js";
import { sendAdminInvitation } from "./email.service.js";
import {
  generateOpaqueToken,
  hashOneTimeToken,
} from "./token.service.js";
import HttpError from "../utils/httpError.js";

const invitationLifetimeMs = 24 * 60 * 60 * 1000;

export async function createAdminInvitation({ email, role, invitedBy }) {
  const code = generateOpaqueToken();
  const invitation = await AdminInvitation.create({
    email,
    role,
    tokenHash: hashOneTimeToken(code),
    invitedBy,
    expiresAt: new Date(Date.now() + invitationLifetimeMs),
  });

  try {
    await AdminInvitation.deleteMany({
      email,
      usedAt: null,
      _id: { $ne: invitation._id },
    });
    await sendAdminInvitation({ email, code, role });
  } catch (error) {
    try {
      await AdminInvitation.deleteOne({ _id: invitation._id });
    } catch (cleanupError) {
      console.error("Could not remove an unsent admin invitation.", {
        name: cleanupError.name || "Error",
      });
    }
    throw error;
  }
}

export async function consumeAdminInvitation({ email, code }) {
  const now = new Date();
  const invitation = await AdminInvitation.findOne({
    email,
    tokenHash: hashOneTimeToken(code),
    expiresAt: { $gt: now },
    usedAt: null,
  }).select("+tokenHash");

  if (!invitation) {
    throw new HttpError(400, "The invitation code is invalid or expired.");
  }

  const result = await AdminInvitation.updateOne(
    { _id: invitation._id, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (result.modifiedCount !== 1) {
    throw new HttpError(400, "The invitation code is invalid or expired.");
  }

  invitation.usedAt = now;
  return invitation;
}

export function releaseAdminInvitation(invitation) {
  return AdminInvitation.updateOne(
    { _id: invitation._id, usedAt: invitation.usedAt },
    { $set: { usedAt: null } },
  );
}