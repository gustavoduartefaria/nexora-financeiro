import { env } from "cloudflare:workers";
import { createSessionToken, sessionCookie, verifyPassword } from "../../../../lib/auth";
import { findUserByEmail } from "../../../../lib/users";

export const runtime = "edge";

async function checkRateLimit(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
  const fingerprintHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const fingerprint = Array.from(new Uint8Array(fingerprintHash), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      successful INTEGER NOT NULL
    )
  `).run();
  await env.DB.prepare("DELETE FROM auth_attempts WHERE attempted_at < ?").bind(Date.now() - 24 * 60 * 60 * 1000).run();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM auth_attempts WHERE fingerprint = ? AND successful = 0 AND attempted_at > ?"
  ).bind(fingerprint, Date.now() - 15 * 60 * 1000).first<{ total: number }>();
  return { fingerprint, blocked: (recent?.total ?? 0) >= 5 };
}

export async function POST(request: Request) {
  try {
    const { fingerprint, blocked } = await checkRateLimit(request);
    if (blocked) {
      return Response.json({ error: "Muitas tentativas. Aguarde 15 minutos para tentar novamente." }, { status: 429 });
    }
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const user = await findUserByEmail(email);
    const authenticated = Boolean(user && (await verifyPassword(password, user.password_hash)));
    await env.DB.prepare(
      "INSERT INTO auth_attempts (fingerprint, attempted_at, successful) VALUES (?, ?, ?)"
    ).bind(fingerprint, Date.now(), authenticated ? 1 : 0).run();
    if (!authenticated || !user) {
      return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    const token = await createSessionToken(user);
    return Response.json(
      { success: true, user: { name: user.name, email: user.email } },
      { headers: { "set-cookie": sessionCookie(token), "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível entrar." },
      { status: 500 },
    );
  }
}
