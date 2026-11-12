import { randomInt } from "node:crypto";

export default function generateRecoveryCode() {
  return String(randomInt(100000, 1000000));
}