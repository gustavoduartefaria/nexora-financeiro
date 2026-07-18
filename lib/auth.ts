import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SessionPayload = {
  email: string;
  expiresAt: number;
};

function config() {
  const values = env as unknown as Record<string, string | undefined>;
  const email = values.NEXORA_ADMIN_EMAIL;
  const passwordHash = values.NEXORA_PASSWORD_HASH;
  const sessionSecret = values.NEXORA_SESSION_SECRET;
  if (!email || !passwordHash || !sessionSecret) {
    throw new Error("A autenticação da Nexora ainda não foi configurada.");
  }
  return { email, passwordHash, sessionSecret };
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

async function sign(value: string) {
  const { sessionSecret } = config();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function verifyCredentials(email: string, password: string) {
  const auth = config();
  if (!constantTimeEqual(email.trim().toLocaleLowerCase("pt-BR"), auth.email.toLocaleLowerCase("pt-BR"))) return false;
  const [saltHex, expectedHash] = auth.passwordHash.split(":");
  if (!saltHex || !expectedHash) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: 150_000 },
    key,
    256,
  );
  return constantTimeEqual(bytesToHex(new Uint8Array(derived)), expectedHash);
}

export async function createSessionToken(email: string) {
  const payload: SessionPayload = {
    email,
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
    if (!data.email || data.expiresAt <= Date.now()) return null;
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
