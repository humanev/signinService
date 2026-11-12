import mongoose from "mongoose";
import HttpError from "../utils/httpError.js";

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new HttpError(500, "MONGODB_URI is not configured.");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

export async function disconnectFromDatabase() {
  await mongoose.disconnect();
}