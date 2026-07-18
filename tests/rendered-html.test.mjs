import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the finished Portuguese financial product", async () => {
  const [page, layout, css, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Lúmina/);
  assert.match(page, /Receitas e despesas/);
  assert.match(page, /ANÁLISE INTELIGENTE/);
  assert.match(page, /Novo lançamento/);
  assert.match(layout, /lang="pt-BR"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
