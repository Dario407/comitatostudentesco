import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function normalizePhone(input: string) {
  let value = input.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  if (/^3\d{9}$/.test(value)) value = "+39" + value;
  if (!/^\+\d{8,15}$/.test(value)) throw new Error("Numero di telefono non valido");
  return value;
}

export function phoneLookup(input: string) {
  return createHmac("sha256", env("PHONE_LOOKUP_SECRET"))
    .update(normalizePhone(input))
    .digest("hex");
}

export function hashAccessCode(code: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(code.trim(), salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyAccessCode(code: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(code.trim(), Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomAccessCode(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}
