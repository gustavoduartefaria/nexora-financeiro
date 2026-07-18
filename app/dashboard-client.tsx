"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Transaction = {
  id: number;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
};

type DashboardData = {
  transactions: Transaction[];
  summary: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    previousRevenue: number;
    previousExpenses: number;
    previousProfit: number;
  };
  months: { key: string; label: string; revenue: number; expenses: number; profit: number }[];
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const categories = {
  income: ["Vendas", "Serviços", "Assinaturas", "Outras receitas"],
  expense: ["Fornecedores", "Marketing", "Aluguel", "Impostos", "Equipe", "Software", "Outras despesas"],
};

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatChange(value: number) {
  const rounded = Math.abs(value).toFixed(1).replace(".", ",");
  return `${value >= 0 ? "↑" : "↓"} ${rounded}%`;
}

function buildInsights(data: DashboardData | null) {
  if (!data) return [];
  const { summary, transactions } = data;
  const expenseGroups = transactions
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + item.amount;
      return acc;
    }, {});
  const topExpense = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1])[0];
  const expenseChange = percentChange(summary.expenses, summary.previousExpenses);
  const revenueChange = percentChange(summary.revenue, summary.previousRevenue);
  const insights = [];

  if (topExpense) {
    const share = summary.expenses ? (topExpense[1] / summary.expenses) * 100 : 0;
    insights.push({
      tone: "attention",
      eyebrow: "Maior oportunidade",
      title: `${topExpense[0]} concentra ${share.toFixed(0)}% dos gastos`,
      text: `Uma redução de 8% nessa categoria economizaria ${money.format(topExpense[1] * 0.08)} neste mês.`,
    });
  }
  if (expenseChange > 5) {
    insights.push({
      tone: "warning",
      eyebrow: "Alerta de custos",
      title: `Despesas subiram ${Math.abs(expenseChange).toFixed(1).replace(".", ",")}%`,
      text: "Revise os lançamentos recorrentes e negocie os três maiores fornecedores antes do próximo fechamento.",
    });
  } else {
    insights.push({
      tone: "positive",
      eyebrow: "Custos controlados",
      title: "As despesas estão dentro de uma faixa saudável",
      text: "Continue acompanhando gastos variáveis semanalmente para proteger sua margem.",
    });
  }
  insights.push({
    tone: summary.margin >= 20 ? "positive" : "attention",
    eyebrow: "Leitura da margem",
    title: `Sua margem atual é de ${summary.margin.toFixed(1).replace(".", ",")}%`,
    text:
      summary.margin >= 20
        ? `A receita está ${revenueChange >= 0 ? "crescendo" : "recuando"}, mas o negócio mantém boa capacidade de gerar resultado.`
        : "Considere revisar preços e priorizar produtos ou serviços com maior contribuição para o lucro.",
  });
  return insights.slice(0, 3);
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/finance");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const visibleTransactions = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((item) => {
      const matchesMonth = selectedMonth === "all" || item.date.startsWith(selectedMonth);
      const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
      const matchesSearch =
        !normalizedSearch ||
        `${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      return matchesMonth && matchesSearch;
    });
  }, [data, search, selectedMonth]);

  const insights = buildInsights(data);
  const chartMonths = data?.months.slice(-6) ?? [];
  const chartMax = Math.max(1, ...chartMonths.flatMap((month) => [month.revenue, month.expenses]));
  const current = data?.summary;

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          description: form.get("description"),
          category: form.get("category"),
          amount: Number(form.get("amount")),
          date: form.get("date"),
          paymentMethod: form.get("paymentMethod"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      setShowForm(false);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTransaction(id: number) {
    if (!window.confirm("Deseja excluir este lançamento?")) return;
    const response = await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
    if (response.ok) await loadData();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nexora</span>
        </div>
        <nav aria-label="Menu principal">
          <a className="nav-item active" href="#visao-geral"><span>◫</span>Visão geral</a>
          <a className="nav-item" href="#lancamentos"><span>↕</span>Lançamentos</a>
          <a className="nav-item" href="#analises"><span>⌁</span>Análises</a>
          <a className="nav-item" href="#relatorios"><span>▤</span>Relatórios</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-label">CENTRAL NEXORA</span>
            <strong>Decisões com contexto</strong>
            <small>Seu negócio visto por inteiro</small>
          </div>
          <div className="profile">
            <span className="avatar">AM</span>
            <span><strong>Minha Empresa</strong><small>Administrador</small></span>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
            <button className="mobile-brand" aria-label="Abrir menu">N</button>
          <div>
            <span className="today-dot" /> Hoje, {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notificações">●</button>
            <button className="signout-button" onClick={signOut}>Sair</button>
            <button className="primary-button" onClick={() => setShowForm(true)}>＋ Novo lançamento</button>
          </div>
        </header>

        <div className="dashboard" id="visao-geral">
          <div className="hero-row">
            <div>
              <p className="eyebrow">PULSO DO NEGÓCIO</p>
              <h1>Seu resultado, <span>sem ruído.</span></h1>
              <p className="subtitle">Uma leitura direta do que entrou, do que saiu e do que merece sua atenção.</p>
            </div>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Período do painel">
              <option value="all">Todos os períodos</option>
              {data?.months.slice().reverse().map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
            </select>
          </div>

          {error && <div className="error-banner">{error} <button onClick={loadData}>Tentar novamente</button></div>}

          <section className="metrics-grid" aria-label="Resumo financeiro">
            <article className="metric-card revenue">
              <div className="metric-heading"><span>RECEITA</span><span className="metric-icon">↗</span></div>
              <strong>{loading ? "—" : money.format(current?.revenue ?? 0)}</strong>
              <small className="change positive">{formatChange(percentChange(current?.revenue ?? 0, current?.previousRevenue ?? 0))} <span>vs. mês anterior</span></small>
            </article>
            <article className="metric-card expenses">
              <div className="metric-heading"><span>DESPESAS</span><span className="metric-icon">↘</span></div>
              <strong>{loading ? "—" : money.format(current?.expenses ?? 0)}</strong>
              <small className="change neutral">{formatChange(percentChange(current?.expenses ?? 0, current?.previousExpenses ?? 0))} <span>vs. mês anterior</span></small>
            </article>
            <article className="metric-card profit">
              <div className="metric-heading"><span>LUCRO LÍQUIDO</span><span className="metric-icon">◇</span></div>
              <strong>{loading ? "—" : money.format(current?.profit ?? 0)}</strong>
              <small className="change positive">{formatChange(percentChange(current?.profit ?? 0, current?.previousProfit ?? 0))} <span>vs. mês anterior</span></small>
            </article>
            <article className="metric-card margin">
              <div className="metric-heading"><span>MARGEM</span><span className="metric-icon">%</span></div>
              <strong>{loading ? "—" : `${(current?.margin ?? 0).toFixed(1).replace(".", ",")}%`}</strong>
              <small>Saúde do resultado no mês atual</small>
            </article>
          </section>

          <section className="main-grid">
            <article className="panel chart-panel">
              <div className="panel-header">
                <div><p className="eyebrow">DESEMPENHO</p><h2>Receitas e despesas</h2></div>
                <div className="legend"><span><i className="legend-revenue" />Receitas</span><span><i className="legend-expense" />Despesas</span></div>
              </div>
              <div className="chart" role="img" aria-label="Gráfico comparativo de receitas e despesas dos últimos seis meses">
                <div className="axis-labels"><span>{money.format(chartMax)}</span><span>{money.format(chartMax / 2)}</span><span>R$ 0</span></div>
                <div className="chart-columns">
                  {chartMonths.map((month) => (
                    <div className="chart-column" key={month.key}>
                      <div className="bars">
                        <span className="bar revenue-bar" style={{ height: `${Math.max(5, (month.revenue / chartMax) * 100)}%` }} title={`Receita: ${money.format(month.revenue)}`} />
                        <span className="bar expense-bar" style={{ height: `${Math.max(5, (month.expenses / chartMax) * 100)}%` }} title={`Despesa: ${money.format(month.expenses)}`} />
                      </div>
                      <small>{month.label.slice(0, 3)}</small>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="panel intelligence-panel" id="analises">
              <div className="ai-title">
                <span className="ai-spark">✦</span>
                <div><p className="eyebrow">CONSULTOR NEXORA</p><h2>Sinais que merecem atenção</h2></div>
              </div>
              <div className="insight-list">
                {insights.map((insight) => (
                  <div className={`insight ${insight.tone}`} key={insight.title}>
                    <span className="insight-dot" />
                    <div><small>{insight.eyebrow}</small><strong>{insight.title}</strong><p>{insight.text}</p></div>
                  </div>
                ))}
              </div>
              <p className="ai-note">✦ Leituras atualizadas com base no comportamento real das suas contas.</p>
            </article>
          </section>

          <section className="panel transactions-panel" id="lancamentos">
            <div className="panel-header transactions-header">
              <div><p className="eyebrow">MOVIMENTAÇÃO</p><h2>Últimos lançamentos</h2></div>
              <div className="table-actions">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lançamento..." aria-label="Buscar lançamento" />
                <button className="secondary-button" onClick={() => setShowForm(true)}>＋ Adicionar</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Pagamento</th><th>Valor</th><th aria-label="Ações" /></tr></thead>
                <tbody>
                  {visibleTransactions.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <td><span className={`transaction-badge ${item.type}`}>{item.type === "income" ? "↗" : "↘"}</span><strong>{item.description}</strong></td>
                      <td><span className="category-pill">{item.category}</span></td>
                      <td>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td>{item.paymentMethod}</td>
                      <td className={item.type}>{item.type === "expense" ? "− " : "+ "}{money.format(item.amount)}</td>
                      <td><button className="delete-button" onClick={() => removeTransaction(item.id)} aria-label={`Excluir ${item.description}`}>×</button></td>
                    </tr>
                  ))}
                  {!loading && !visibleTransactions.length && <tr><td colSpan={6} className="empty-state">Nenhum lançamento encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <footer id="relatorios">Nexora • Seu negócio, em perspectiva.</footer>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Fechar">×</button>
            <p className="eyebrow">NOVO LANÇAMENTO</p>
            <h2 id="modal-title">Registre uma movimentação</h2>
            <p>Preencha os dados para atualizar seu resultado automaticamente.</p>
            <div className="type-toggle">
              <button className={type === "income" ? "selected" : ""} onClick={() => setType("income")}>↗ Receita</button>
              <button className={type === "expense" ? "selected expense-selected" : ""} onClick={() => setType("expense")}>↘ Despesa</button>
            </div>
            <form onSubmit={addTransaction}>
              <label>Descrição<input name="description" required placeholder={type === "income" ? "Ex.: Venda de consultoria" : "Ex.: Conta de energia"} /></label>
              <div className="form-row">
                <label>Valor (R$)<input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00" /></label>
                <label>Data<input name="date" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              </div>
              <div className="form-row">
                <label>Categoria<select name="category">{categories[type].map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Pagamento<select name="paymentMethod"><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></select></label>
              </div>
              <button className="primary-button submit-button" disabled={saving}>{saving ? "Salvando..." : "Salvar lançamento"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
