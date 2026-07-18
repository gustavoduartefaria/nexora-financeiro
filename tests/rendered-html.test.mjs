import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the protected Nexora financial product", async () => {
  const [page, dashboard, login, auth, layout, css, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
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
  assert.match(login, /Entre na sua conta/);
  assert.match(auth, /PBKDF2/);
  assert.match(auth, /HMAC/);
  assert.match(layout, /lang="pt-BR"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.login-shell/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
