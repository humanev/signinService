import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const addressSchema = new mongoose.Schema(
  {
    addressId: { type: String, default: uuidv4, immutable: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    email: { type: String, default: null, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: null, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    countryCode: { type: String, default: "India (+91)", trim: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const globalUserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: uuidv4,
      unique: true,
      immutable: true,
      index: true,
    },
    orgId: { type: String, default: null, index: true },
    profileId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      index: true,
    },

    firstName: { type: String, required: true, trim: true, lowercase: true },
    lastName: { type: String, required: true, trim: true, lowercase: true },
    fullName: { type: String, default: null, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, sparse: true, index: true },
    passwordHash: { type: String, select: false },
    adminRole: {
      type: String,
      enum: ["owner", "editor", "publisher", "support"],
      default: null,
    },
    authVersion: { type: Number, default: 0, select: false },
    passwordChangedAt: { type: Date, default: null },
    businessName: { type: String, default: null, trim: true },
    orgDept: { type: String, default: null, trim: true },

    alternateEmail: { type: String, trim: true, default: null },
    profileImage: { type: String, default: null },
    linkedProfileIds: { type: [String], default: [] },
    addresses: { type: [addressSchema], default: [] },

    userScope: {
      type: [String],
      enum: [
        "admin",
        "issuer",
        "earner",
        "vendor",
        "managing_editor",
        "reviewer",
        "author",
        "editor",
        "publisher",
        "supporter",
        "support",
      ],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "userScope must contain at least one role",
      },
    },

    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: String, default: null },
    lastUpdatedBy: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

globalUserSchema.index(
  { email: 1, userScope: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
globalUserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { adminRole: { $type: "string" } } },
);

export default mongoose.models.User || mongoose.model("User", globalUserSchema);