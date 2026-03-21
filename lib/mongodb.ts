import mongoose from "mongoose";

function normalizeMongoUri(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  return trimmed.length ? trimmed : null;
}

const rawUri = normalizeMongoUri(process.env.MONGODB_URI);

if (!rawUri) {
  throw new Error("Missing MONGODB_URI in environment variables.");
}

if (!rawUri.startsWith("mongodb://") && !rawUri.startsWith("mongodb+srv://")) {
  throw new Error(
    "MONGODB_URI must start with mongodb:// or mongodb+srv://. Check .env for a broken or multi-line value."
  );
}

/** Validated Atlas / Mongo connection string */
const MONGODB_URI: string = rawUri;

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const cached: Cached = (globalThis as unknown as { mongooseCache?: Cached }).mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!(globalThis as unknown as { mongooseCache?: Cached }).mongooseCache) {
  (globalThis as unknown as { mongooseCache?: Cached }).mongooseCache = cached;
}

export async function connectToDb(): Promise<typeof mongoose> {
  if (cached.conn && cached.conn.connection.readyState === 1) return cached.conn;
  if (cached.promise) return cached.promise;

  cached.promise = mongoose.connect(MONGODB_URI, {
    // Use defaults that work across local + Atlas.
    // Mongoose will handle timeouts/retries appropriately.
    maxPoolSize: 10,
  });

  cached.conn = await cached.promise;
  cached.promise = null;
  return cached.conn;
}

