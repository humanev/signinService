const secureCookie = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = secureCookie ? "__Host-ev.sid" : "ev.sid";
export const sessionCookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 1000,
};
export const sessionCookieClearOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: "lax",
  path: "/",
};
