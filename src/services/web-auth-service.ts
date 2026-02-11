import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Setting } from "@/types/setting.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_HASH_KEYLEN = 64;
const PASSWORD_SALT_BYTES = 16;

interface WebAuthSession {
  username: string;
  expiresAt: number;
}

const sessions = new Map<string, WebAuthSession>();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredSessions, 60_000);
cleanupTimer.unref();

function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex
    ? Buffer.from(saltHex, "hex")
    : randomBytes(PASSWORD_SALT_BYTES);
  const hash = scryptSync(password, salt, PASSWORD_HASH_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const parts = encodedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, saltHex, hashHex] = parts;
  const expectedHash = Buffer.from(hashHex, "hex");
  const actualHash = Buffer.from(
    hashPassword(password, saltHex).split("$")[2] || "",
    "hex"
  );

  if (expectedHash.length !== actualHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, actualHash);
}

export const WEB_AUTH_COOKIE_NAME = "tgdl_web_auth";
export const WEB_AUTH_SESSION_MAX_AGE_SECONDS = Math.floor(
  SESSION_TTL_MS / 1000
);

export function hasWebAuthCredentialConfigured(
  setting: Setting | null
): boolean {
  return Boolean(
    setting?.webUsername?.trim() && setting?.webPasswordHash?.trim()
  );
}

export function createWebAuthCredential(username: string, password: string) {
  return {
    webUsername: username.trim(),
    webPasswordHash: hashPassword(password),
  };
}

export function verifyWebAuthLogin(
  setting: Setting,
  username: string,
  password: string
): boolean {
  if (!hasWebAuthCredentialConfigured(setting)) {
    return false;
  }
  const normalizedUsername = username.trim();
  if (normalizedUsername !== setting.webUsername) {
    return false;
  }
  return verifyPassword(password, setting.webPasswordHash!);
}

export function createWebAuthSession(username: string): string {
  cleanupExpiredSessions();
  const token = randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function validateWebAuthSession(
  sessionToken: string,
  username: string
): boolean {
  cleanupExpiredSessions();
  const session = sessions.get(sessionToken);
  if (!session) {
    return false;
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionToken);
    return false;
  }
  return session.username === username;
}

export function revokeWebAuthSession(sessionToken: string) {
  sessions.delete(sessionToken);
}

export function revokeAllWebAuthSessions() {
  sessions.clear();
}
