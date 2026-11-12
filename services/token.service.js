import { createHmac, randomBytes } from "node:crypto";
import HttpError from "../utils/httpError.js";

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOneTimeToken(token) {
  const secret = process.env.TOKEN_PEPPER;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new HttpError(503, "Token security is not configured on the server.");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}