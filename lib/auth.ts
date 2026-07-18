import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SessionPayload = {
  userId: number;
  name: string;
  email: string;
  expiresAt: number;
};

function sessionSecret() {
  const values = env as unknown as Record<string, string | undefined>;
  if (!values.NEXORA_SESSION_SECRET) {
    throw new Error("A autenticação da Nexora ainda não foi configurada.");
  }
  return values.NEXORA_SESSION_SECRET;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2) return new Uint8Array();
  return new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array(Array.from(binary, (character) => character.charCodeAt(0)));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function derivePassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: 100_000 },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(derived));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  return `${saltHex}:${await derivePassword(password, saltHex)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, expectedHash] = storedHash.split(":");
  if (!saltHex || !expectedHash) return false;
  return constantTimeEqual(await derivePassword(password, saltHex), expectedHash);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionToken(user: { id: number; name: string; email: string }) {
  const payload: SessionPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function readSessionToken(token?: string) {
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !constantTimeEqual(await sign(payload), signature)) return null;
    const data = JSON.parse(decoder.decode(fromBase64Url(payload))) as SessionPayload;
    if (!Number.isInteger(data.userId) || !data.name || !data.email || data.expiresAt <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function readSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("nexora_session="))
    ?.slice("nexora_session=".length);
  return readSessionToken(token);
}

export function sessionCookie(token: string) {
  return `nexora_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}
