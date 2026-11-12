import "dotenv/config";
import { startServer } from "./server/index.js";

startServer().catch((error) => {
  console.error("Sign-in service could not start.", {
    message: error.name === "HttpError"
      ? error.message
      : "Check the database connection and required configuration.",
  });
  process.exitCode = 1;
});