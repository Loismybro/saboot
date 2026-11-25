import mongoose from "mongoose";

const READY_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function getDbState() {
  return READY_STATES[mongoose.connection.readyState] || "unknown";
}

export async function connectDB(maxRetries = 3) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI is not set. Database remains disconnected.");
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
      });
      console.log(`[db] MongoDB connected (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (err) {
      console.error(
        `[db] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  return false;
}
