import mongoose from "mongoose";

const adminInvitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["editor", "publisher", "support"],
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

adminInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AdminInvitation ||
  mongoose.model("AdminInvitation", adminInvitationSchema);