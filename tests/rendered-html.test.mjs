import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the multi-account Nexora financial product", async () => {
  const [page, dashboard, login, register, registerApi, auth, users, finance, layout, css, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cadastro/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/users.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/finance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /readSessionToken/);
  assert.match(page, /redirect\("\/login"\)/);
  assert.match(dashboard, /Nexora/);
  assert.match(dashboard, /Receitas e despesas/);
  assert.match(dashboard, /CONSULTOR NEXORA/);
  assert.match(dashboard, /Novo lançamento/);
  assert.match(dashboard, /exportCsv/);
  assert.match(dashboard, /notificationsOpen/);
  assert.match(dashboard, /mobileMenuOpen/);
  assert.match(dashboard, /pendingDelete/);
  assert.match(dashboard, /Resumo pronto para compartilhar/);
  assert.match(dashboard, /role="alertdialog"/);
  assert.match(login, /Entre na sua conta/);
  assert.match(login, /\/cadastro/);
  assert.match(register, /Crie seu acesso/);
  assert.match(registerApi, /hashPassword/);
  assert.match(auth, /PBKDF2/);
  assert.match(auth, /HMAC/);
  assert.match(users, /CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx/);
  assert.match(finance, /WHERE user_id = \?/);
  assert.match(layout, /lang="pt-BR"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.login-shell/);
  assert.match(css, /\.account-switch/);
  assert.match(css, /\.notifications-panel/);
  assert.match(css, /\.report-panel/);
  assert.match(css, /\.sidebar-open/);
  assert.match(css, /\.toast/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
