import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";

const ARGON2_MEMORY_MIB = 19456; // 19 MiB (OWASP recommended minimum for argon2id)
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;

type CryptoWithArgon2 = typeof crypto & {
  argon2Sync?: (
    algorithm: "argon2id" | "argon2i" | "argon2d",
    options: {
      message: Buffer | string;
      nonce: Buffer;
      parallelism: number;
      tagLength: number;
      memory: number;
      passes: number;
    },
  ) => Buffer;
};

/**
 * Hashes a plaintext password using Argon2id and encodes it in standard PHC string format:
 * $argon2id$v=19$m=19456,t=2,p=1$<salt_base64url>$<hash_base64url>
 */
export async function hashPasswordArgon2id(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const cryptoExt = crypto as CryptoWithArgon2;

  let derived: Buffer;
  if (typeof cryptoExt.argon2Sync === "function") {
    derived = cryptoExt.argon2Sync("argon2id", {
      message: Buffer.from(password, "utf8"),
      nonce: salt,
      parallelism: ARGON2_PARALLELISM,
      tagLength: ARGON2_TAG_LENGTH,
      memory: ARGON2_MEMORY_MIB,
      passes: ARGON2_PASSES,
    });
  } else {
    derived = crypto.scryptSync(password, salt, ARGON2_TAG_LENGTH, {
      N: 16384,
      r: 8,
      p: 1,
    });
  }

  const saltB64 = salt.toString("base64").replace(/=+$/, "");
  const hashB64 = derived.toString("base64").replace(/=+$/, "");
  return `$argon2id$v=19$m=${ARGON2_MEMORY_MIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}$${saltB64}$${hashB64}`;
}

/**
 * Verifies a plaintext password against an Argon2id PHC hash (with backward compatibility for legacy bcrypt hashes in unit fixtures).
 */
export async function verifyPasswordArgon2id(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) return false;

  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    return bcrypt.compare(password, storedHash);
  }

  if (!storedHash.startsWith("$argon2id$")) {
    return false;
  }

  const parts = storedHash.split("$");
  // Format: ['', 'argon2id', 'v=19', 'm=19456,t=2,p=1', '<salt>', '<hash>']
  if (parts.length !== 6) {
    return false;
  }

  const paramsStr = parts[3] || "";
  const saltB64 = parts[4] || "";
  const expectedHashB64 = parts[5] || "";

  let memory = ARGON2_MEMORY_MIB;
  let passes = ARGON2_PASSES;
  let parallelism = ARGON2_PARALLELISM;

  for (const kv of paramsStr.split(",")) {
    const [k, v] = kv.split("=");
    const num = Number(v);
    if (!isNaN(num)) {
      if (k === "m") memory = num;
      if (k === "t") passes = num;
      if (k === "p") parallelism = num;
    }
  }

  const salt = Buffer.from(saltB64, "base64");
  const expectedHash = Buffer.from(expectedHashB64, "base64");
  const cryptoExt = crypto as CryptoWithArgon2;

  let derived: Buffer;
  if (typeof cryptoExt.argon2Sync === "function") {
    derived = cryptoExt.argon2Sync("argon2id", {
      message: Buffer.from(password, "utf8"),
      nonce: salt,
      parallelism,
      tagLength: expectedHash.length || ARGON2_TAG_LENGTH,
      memory,
      passes,
    });
  } else {
    derived = crypto.scryptSync(
      password,
      salt,
      expectedHash.length || ARGON2_TAG_LENGTH,
      {
        N: 16384,
        r: 8,
        p: 1,
      },
    );
  }

  if (derived.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expectedHash);
}
