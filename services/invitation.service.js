import User from "../models/globalUser.model.js";
import { sendAdminInvitation } from "./email.service.js";
import { generateOpaqueToken, hashOneTimeToken } from "./token.service.js";
import HttpError from "../utils/httpError.js";

const invitationLifetimeMs = 24 * 60 * 60 * 1000;

export async function createAdminInvitation({ email, role, invitedBy }) {
  const code = generateOpaqueToken();
  const now = new Date();
  const owner = await User.findOne({ userId: invitedBy, adminRole: "owner", isDeleted: false })
    .select("+adminInvitations.tokenHash");
  if (!owner) throw new HttpError(404, "The inviting owner account was not found.");

  owner.adminInvitations = owner.adminInvitations.filter((item) =>
    item.expiresAt > now && item.email !== email);
  owner.adminInvitations.push({
    email, role, tokenHash: hashOneTimeToken(code), invitedBy,
    expiresAt: new Date(now.getTime() + invitationLifetimeMs),
  });
  await owner.save();

  try {
    await sendAdminInvitation({ email, code, role });
  } catch (error) {
    owner.adminInvitations = owner.adminInvitations.filter((item) => item.email !== email);
    await owner.save();
    throw error;
  }
}

export async function consumeAdminInvitation({ email, code }) {
  const now = new Date();
  const invitationOwner = await User.findOne({
    adminRole: "owner", isDeleted: false,
    adminInvitations: { $elemMatch: {
      email, tokenHash: hashOneTimeToken(code), expiresAt: { $gt: now }, usedAt: null,
    } },
  }).select("+adminInvitations.tokenHash");
  const invitation = invitationOwner?.adminInvitations.find((item) =>
    item.email === email && item.tokenHash === hashOneTimeToken(code) &&
    item.usedAt === null && item.expiresAt > now);
  if (!invitation) throw new HttpError(400, "The invitation code is invalid or expired.");

  const updated = await User.updateOne(
    { _id: invitationOwner._id, adminInvitations: { $elemMatch: {
      _id: invitation._id, usedAt: null, expiresAt: { $gt: now },
    } } },
    { $set: { "adminInvitations.$.usedAt": now } },
  );
  if (updated.modifiedCount !== 1) throw new HttpError(400, "The invitation code is invalid or expired.");
  invitation.usedAt = now;
  return invitation;
}

export async function releaseAdminInvitation(invitation) {
  return User.updateOne(
    { "adminInvitations._id": invitation._id, "adminInvitations.usedAt": invitation.usedAt },
    { $set: { "adminInvitations.$.usedAt": null } },
  );
}
