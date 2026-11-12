import HttpError from "./httpError.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedAdminRoles = new Set(["editor", "publisher", "supporter"]);

export function normalizeEmail(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Enter a valid email address.");
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }

  return email;
}

export function validatePassword(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Password is required.");
  }

  const byteLength = Buffer.byteLength(value, "utf8");
  if ([...value].length < 12 || byteLength > 72) {
    throw new HttpError(
      400,
      "Password must be at least 12 characters and no more than 72 UTF-8 bytes.",
    );
  }

  return value;
}

export function validateFullName(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Enter your full name.");
  }

  const fullName = value.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 100) {
    throw new HttpError(400, "Name must be between 2 and 100 characters.");
  }

  return fullName;
}

export function validateAdminRole(value) {
  if (typeof value !== "string" || !allowedAdminRoles.has(value)) {
    throw new HttpError(400, "Choose a valid team role.");
  }

  return value;
}
