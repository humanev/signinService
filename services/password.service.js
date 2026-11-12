import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const workFactor = 12;
let dummyHashPromise;

export function hashPassword(password) {
  return bcrypt.hash(password, workFactor);
}

async function compareWithDummy(password) {
  dummyHashPromise ||= bcrypt.hash(randomBytes(32).toString("hex"), workFactor);
  await bcrypt.compare(password, await dummyHashPromise);
  return false;
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
    return compareWithDummy("");
  }
  if (passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }

  return compareWithDummy(password);
}
