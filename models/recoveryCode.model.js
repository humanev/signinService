import mongoose from "mongoose";

const recoveryCodeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    codeHash: { type: String, required: true, select: false },
    purpose: {
      type: String,
      enum: ["admin_password_reset"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    attemptsRemaining: { type: Number, default: 5, min: 0, max: 5 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

recoveryCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RecoveryCode ||
  mongoose.model("RecoveryCode", recoveryCodeSchema);