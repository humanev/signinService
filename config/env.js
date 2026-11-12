import HttpError from "../utils/httpError.js";

export function validateEnvironment() {
  const requiredValues = [
    "MONGODB_URI",
    "SESSION_SECRET",
    "TOKEN_PEPPER",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "MAIL_FROM",
  ];
  const missing = requiredValues.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new HttpError(500, `Missing required environment settings: ${missing.join(", ")}.`);
  }
  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_ORIGINS) {
    throw new HttpError(500, "FRONTEND_ORIGINS must be configured in production.");
  }
  if (Buffer.byteLength(process.env.SESSION_SECRET, "utf8") < 32) {
    throw new HttpError(500, "SESSION_SECRET must contain at least 32 bytes.");
  }
  if (Buffer.byteLength(process.env.TOKEN_PEPPER, "utf8") < 32) {
    throw new HttpError(500, "TOKEN_PEPPER must contain at least 32 bytes.");
  }

  const port = Number(process.env.PORT || 5000);
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(500, "PORT must be a valid TCP port.");
  }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new HttpError(500, "SMTP_PORT must be a valid TCP port.");
  }
  if (
    process.env.SMTP_SECURE !== undefined &&
    !["true", "false"].includes(process.env.SMTP_SECURE)
  ) {
    throw new HttpError(500, "SMTP_SECURE must be true or false.");
  }
}
