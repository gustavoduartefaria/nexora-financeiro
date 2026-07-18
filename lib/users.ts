import { env } from "cloudflare:workers";

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export async function ensureUsersTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)").run();

  const values = env as unknown as Record<string, string | undefined>;
  if (values.NEXORA_ADMIN_EMAIL && values.NEXORA_PASSWORD_HASH) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).bind(
      "Administrador",
      values.NEXORA_ADMIN_EMAIL.toLocaleLowerCase("pt-BR"),
      values.NEXORA_PASSWORD_HASH,
      new Date().toISOString(),
    ).run();
  }
}

export async function findUserByEmail(email: string) {
  await ensureUsersTable();
  return env.DB.prepare(
    "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?"
  ).bind(email.trim().toLocaleLowerCase("pt-BR")).first<UserRecord>();
}

export async function createUser(name: string, email: string, passwordHash: string) {
  await ensureUsersTable();
  const normalizedEmail = email.trim().toLocaleLowerCase("pt-BR");
  const result = await env.DB.prepare(
    "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
  ).bind(name.trim(), normalizedEmail, passwordHash, new Date().toISOString()).run();
  return {
    id: Number(result.meta.last_row_id),
    name: name.trim(),
    email: normalizedEmail,
  };
}

export function isBootstrapAdmin(email: string) {
  const values = env as unknown as Record<string, string | undefined>;
  return Boolean(values.NEXORA_ADMIN_EMAIL && email.toLocaleLowerCase("pt-BR") === values.NEXORA_ADMIN_EMAIL.toLocaleLowerCase("pt-BR"));
}
