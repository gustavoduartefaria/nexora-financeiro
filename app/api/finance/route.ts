import { env } from "cloudflare:workers";
import { readSessionFromRequest } from "../../../lib/auth";
import { isBootstrapAdmin } from "../../../lib/users";

export const runtime = "edge";

type TransactionRow = {
  id: number;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string;
  payment_method: string;
  created_at: string;
  user_id: number | null;
};

const seedRows = [
  ["income", "Projeto de identidade visual", "Serviços", 4850, "2026-07-17", "Pix"],
  ["income", "Venda de plano Premium", "Assinaturas", 3290, "2026-07-15", "Cartão"],
  ["expense", "Anúncios nas redes sociais", "Marketing", 980, "2026-07-14", "Cartão"],
  ["expense", "Fornecedor de materiais", "Fornecedores", 2140, "2026-07-11", "Boleto"],
  ["income", "Consultoria estratégica", "Serviços", 6200, "2026-07-09", "Transferência"],
  ["expense", "Licenças de software", "Software", 640, "2026-07-08", "Cartão"],
  ["expense", "Aluguel do escritório", "Aluguel", 2800, "2026-07-05", "Boleto"],
  ["income", "Vendas da primeira semana", "Vendas", 7980, "2026-07-03", "Pix"],
  ["income", "Campanha de lançamento", "Serviços", 11600, "2026-06-19", "Transferência"],
  ["income", "Vendas online", "Vendas", 9840, "2026-06-08", "Cartão"],
  ["expense", "Folha e prestadores", "Equipe", 7920, "2026-06-06", "Transferência"],
  ["expense", "Tráfego pago", "Marketing", 2100, "2026-06-03", "Cartão"],
  ["income", "Projetos de maio", "Serviços", 18400, "2026-05-16", "Pix"],
  ["expense", "Custos operacionais", "Fornecedores", 8650, "2026-05-07", "Boleto"],
  ["income", "Projetos de abril", "Serviços", 15900, "2026-04-15", "Transferência"],
  ["expense", "Custos de abril", "Equipe", 8100, "2026-04-06", "Transferência"],
  ["income", "Projetos de março", "Serviços", 14200, "2026-03-13", "Pix"],
  ["expense", "Custos de março", "Fornecedores", 7800, "2026-03-04", "Boleto"],
  ["income", "Projetos de fevereiro", "Serviços", 12900, "2026-02-12", "Pix"],
  ["expense", "Custos de fevereiro", "Equipe", 7500, "2026-02-04", "Transferência"],
];

async function ensureDatabase(userId: number, bootstrapAdmin: boolean) {
  if (!env.DB) throw new Error("O banco de dados financeiro ainda não está conectado.");
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TEXT NOT NULL,
      user_id INTEGER
    )
  `).run();
  const columns = await env.DB.prepare("PRAGMA table_info(transactions)").all<{ name: string }>();
  if (!(columns.results ?? []).some((column) => column.name === "user_id")) {
    await env.DB.prepare("ALTER TABLE transactions ADD COLUMN user_id INTEGER").run();
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id)").run();
  if (bootstrapAdmin) {
    await env.DB.prepare("UPDATE transactions SET user_id = ? WHERE user_id IS NULL").bind(userId).run();
  }
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?"
  ).bind(userId).first<{ total: number }>();
  if (bootstrapAdmin && !count?.total) {
    const now = new Date().toISOString();
    await env.DB.batch(
      seedRows.map((row) =>
        env.DB.prepare(
          "INSERT INTO transactions (type, description, category, amount, date, payment_method, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(...row, now, userId)
      )
    );
  }
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export async function GET(request: Request) {
  try {
    const session = await readSessionFromRequest(request);
    if (!session) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    await ensureDatabase(session.userId, isBootstrapAdmin(session.email));
    const result = await env.DB.prepare(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC"
    ).bind(session.userId).all<TransactionRow>();
    const rows = result.results ?? [];
    const monthsMap = new Map<string, { revenue: number; expenses: number }>();
    for (const row of rows) {
      const key = row.date.slice(0, 7);
      const month = monthsMap.get(key) ?? { revenue: 0, expenses: 0 };
      if (row.type === "income") month.revenue += row.amount;
      else month.expenses += row.amount;
      monthsMap.set(key, month);
    }
    const months = Array.from(monthsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, month]) => ({ key, label: monthLabel(key), ...month, profit: month.revenue - month.expenses }));
    const currentMonth = months.at(-1) ?? { revenue: 0, expenses: 0, profit: 0 };
    const previousMonth = months.at(-2) ?? { revenue: 0, expenses: 0, profit: 0 };
    return Response.json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        description: row.description,
        category: row.category,
        amount: row.amount,
        date: row.date,
        paymentMethod: row.payment_method,
      })),
      summary: {
        revenue: currentMonth.revenue,
        expenses: currentMonth.expenses,
        profit: currentMonth.profit,
        margin: currentMonth.revenue ? (currentMonth.profit / currentMonth.revenue) * 100 : 0,
        previousRevenue: previousMonth.revenue,
        previousExpenses: previousMonth.expenses,
        previousProfit: previousMonth.profit,
      },
      months,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar o painel." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSessionFromRequest(request);
    if (!session) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    await ensureDatabase(session.userId, isBootstrapAdmin(session.email));
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type === "expense" ? "expense" : body.type === "income" ? "income" : "";
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "").trim();
    const amount = Number(body.amount);
    const date = String(body.date ?? "");
    const paymentMethod = String(body.paymentMethod ?? "").trim();
    if (!type || !description || !category || !paymentMethod || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Preencha todos os campos corretamente." }, { status: 400 });
    }
    const result = await env.DB.prepare(
      "INSERT INTO transactions (type, description, category, amount, date, payment_method, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(type, description, category, amount, date, paymentMethod, new Date().toISOString(), session.userId).run();
    return Response.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao salvar o lançamento." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await readSessionFromRequest(request);
    if (!session) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    await ensureDatabase(session.userId, isBootstrapAdmin(session.email));
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Lançamento inválido." }, { status: 400 });
    await env.DB.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").bind(id, session.userId).run();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao excluir." }, { status: 500 });
  }
}
