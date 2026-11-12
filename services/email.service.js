import nodemailer from "nodemailer";
import HttpError from "../utils/httpError.js";

function createTransporter() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !MAIL_FROM || !Number.isInteger(port)) {
    throw new HttpError(503, "Email delivery is not configured on the server.");
  }

  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendEmail({ to, subject, text }) {
  try {
    await createTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("Email delivery failed.", { code: error.code || "SMTP_ERROR" });
    throw new HttpError(503, "Email delivery is temporarily unavailable.");
  }
}

export function sendAdminInvitation({ email, code, role }) {
  return sendEmail({
    to: email,
    subject: "Your Humans of EV admin invitation",
    text: `You have been invited to join Humans of EV as ${role}.\n\nUse this one-time code to create your account: ${code}\n\nThe code expires in 24 hours. If you did not expect this invitation, you can ignore this email.`,
  });
}

export function sendAdminRecoveryCode({ email, code }) {
  return sendEmail({
    to: email,
    subject: "Your Humans of EV password recovery code",
    text: `Your password recovery code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request this, you can ignore this email.`,
  });
}
