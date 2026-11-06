import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const key = process.env.AI_ENCRYPTION_KEY;

  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Invalid AI_ENCRYPTION_KEY");
  }

  return Buffer.from(key, "hex");
}

export function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptApiKey(value: string): string {
  const [iv, tag, encrypted] = value.split(":");

  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted API key");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(tag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]).toString("utf8");
}