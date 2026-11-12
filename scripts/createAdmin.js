import "dotenv/config";
import User from "../models/globalUser.model.js";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../config/database.js";
import { hashPassword } from "../services/password.service.js";
import HttpError from "../utils/httpError.js";
import {
  normalizeEmail,
  validatePassword,
} from "../utils/validation.js";

function readHiddenPassword(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive terminal."));
      return;
    }

    const bytes = [];
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    function finish(error) {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(Buffer.from(bytes).toString("utf8"));
    }

    function onData(chunk) {
      for (const byte of chunk) {
        if (byte === 3) {
          finish(new Error("Password entry cancelled."));
          return;
        }
        if (byte === 10 || byte === 13) {
          finish();
          return;
        }
        if (byte === 8 || byte === 127) {
          if (bytes.length) {
            let removed = bytes.pop();
            while (bytes.length && (removed & 0xc0) === 0x80) {
              removed = bytes.pop();
            }
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (byte >= 32) {
          bytes.push(byte);
          if ((byte & 0xc0) !== 0x80) process.stdout.write("*");
        }
      }
    }

    input.on("data", onData);
  });
}

async function createOwner() {
  const email = normalizeEmail(process.argv[2]);
  const password = validatePassword(await readHiddenPassword("Owner password (hidden): "));

  await connectToDatabase();
  await User.init();
  if (await User.exists({ adminRole: "owner", isDeleted: false })) {
    throw new HttpError(409, "An active owner account already exists.");
  }

  const existingAdmin = await User.exists({
    email,
    adminRole: { $type: "string" },
  });
  if (existingAdmin) {
    throw new HttpError(409, "An administrator already uses this email.");
  }

  await User.create({
    fullName: email.split("@")[0].slice(0, 60),
    email,
    passwordHash: await hashPassword(password),
    adminRole: "owner",
    userScope: ["admin"],
  });
  console.log("Initial owner account created.");
}

try {
  if (!process.argv[2]) {
    throw new HttpError(400, "Usage: npm run create-admin -- owner@example.com");
  }
  await createOwner();
} catch (error) {
  console.error("Could not create the initial owner.", {
    message: error instanceof HttpError ? error.message : "Database operation failed.",
  });
  process.exitCode = 1;
} finally {
  await disconnectFromDatabase();
}
