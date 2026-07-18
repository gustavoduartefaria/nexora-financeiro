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

type MonthSummary = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
};

type FinancialSummary = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  previousRevenue: number;
  previousExpenses: number;
  previousProfit: number;
};

type DashboardData = {
  transactions: Transaction[];
  summary: FinancialSummary;
  months: MonthSummary[];
};

type Insight = {
  tone: "attention" | "warning" | "positive";
  eyebrow: string;
  title: string;
  text: string;
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

function buildInsights(transactions: Transaction[], summary: FinancialSummary): Insight[] {
  if (!transactions.length) {
    return [
      {
        tone: "positive",
        eyebrow: "Primeiro passo",
        title: "Seu espaço financeiro está pronto",
        text: "Registre a primeira receita ou despesa para receber leituras personalizadas sobre o negócio.",
      },
      {
        tone: "attention",
        eyebrow: "Boa prática",
        title: "Mantenha os lançamentos atualizados",
        text: "Uma rotina semanal de cinco minutos já melhora a qualidade das decisões e das projeções.",
      },
    ];
  }

  const expenseGroups = transactions
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.category] = (accumulator[item.category] ?? 0) + item.amount;
      return accumulator;
    }, {});
  const topExpense = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1])[0];
  const expenseChange = percentChange(summary.expenses, summary.previousExpenses);
  const revenueChange = percentChange(summary.revenue, summary.previousRevenue);
  const insights: Insight[] = [];

  if (topExpense) {
    const share = summary.expenses ? (topExpense[1] / summary.expenses) * 100 : 0;
    insights.push({
      tone: "attention",
      eyebrow: "Maior oportunidade",
      title: `${topExpense[0]} concentra ${share.toFixed(0)}% dos gastos`,
      text: `Uma redução de 8% nessa categoria economizaria ${money.format(topExpense[1] * 0.08)} no período.`,
    });
  }

  insights.push(
    expenseChange > 5
      ? {
          tone: "warning",
          eyebrow: "Alerta de custos",
          title: `Despesas subiram ${Math.abs(expenseChange).toFixed(1).replace(".", ",")}%`,
          text: "Revise os lançamentos recorrentes e negocie os maiores fornecedores antes do próximo fechamento.",
        }
      : {
          tone: "positive",
          eyebrow: "Custos controlados",
          title: "As despesas estão dentro de uma faixa saudável",
          text: "Continue acompanhando gastos variáveis semanalmente para proteger sua margem.",
        },
  );

  insights.push({
    tone: summary.margin >= 20 ? "positive" : "attention",
    eyebrow: "Leitura da margem",
    title: `Sua margem atual é de ${summary.margin.toFixed(1).replace(".", ",")}%`,
    text:
      summary.margin >= 20
        ? `A receita está ${revenueChange >= 0 ? "crescendo" : "recuando"}, e o negócio mantém boa capacidade de gerar resultado.`
        : "Considere revisar preços e priorizar produtos ou serviços com maior contribuição para o lucro.",
  });
  return insights.slice(0, 3);
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function Dashboard({ user }: { user: { name: string; email: string } }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/finance", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowForm(false);
      setPendingDelete(null);
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
      setProfileOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const periodTransactions = useMemo(() => {
    if (!data) return [];
    const effectiveMonth =
      selectedMonth === "all" ? data.months.at(-1)?.key : selectedMonth;
    return data.transactions.filter(
      (item) => !effectiveMonth || item.date.startsWith(effectiveMonth),
    );
  }, [data, selectedMonth]);

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return periodTransactions.filter(
      (item) =>
        !normalizedSearch ||
        `${item.description} ${item.category} ${item.paymentMethod}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch),
    );
  }, [periodTransactions, search]);

  const selectedSummary = useMemo<FinancialSummary>(() => {
    if (!data) {
      return {
        revenue: 0,
        expenses: 0,
        profit: 0,
        margin: 0,
        previousRevenue: 0,
        previousExpenses: 0,
        previousProfit: 0,
      };
    }
    if (selectedMonth === "all") return data.summary;
    const index = data.months.findIndex((month) => month.key === selectedMonth);
    const current = data.months[index] ?? { revenue: 0, expenses: 0, profit: 0 };
    const previous = data.months[index - 1] ?? { revenue: 0, expenses: 0, profit: 0 };
    return {
      revenue: current.revenue,
      expenses: current.expenses,
      profit: current.profit,
      margin: current.revenue ? (current.profit / current.revenue) * 100 : 0,
      previousRevenue: previous.revenue,
      previousExpenses: previous.expenses,
      previousProfit: previous.profit,
    };
  }, [data, selectedMonth]);

  const insights = useMemo(
    () => buildInsights(periodTransactions, selectedSummary),
    [periodTransactions, selectedSummary],
  );
  const chartMonths = data?.months.slice(-6) ?? [];
  const chartMax = Math.max(1, ...chartMonths.flatMap((month) => [month.revenue, month.expenses]));
  const periodLabel =
    selectedMonth === "all"
      ? data?.months.at(-1)?.label ?? "Período atual"
      : data?.months.find((month) => month.key === selectedMonth)?.label ?? "Período selecionado";
  const averageTicket =
    periodTransactions.filter((item) => item.type === "income").length > 0
      ? selectedSummary.revenue / periodTransactions.filter((item) => item.type === "income").length
      : 0;

  function openTransactionForm(nextType: "income" | "expense" = "income") {
    setType(nextType);
    setShowForm(true);
    setMobileMenuOpen(false);
  }

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
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      setShowForm(false);
      await loadData();
      setToast(type === "income" ? "Receita adicionada com sucesso." : "Despesa adicionada com sucesso.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/finance?id=${pendingDelete.id}`, { method: "DELETE" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Não foi possível excluir o lançamento.");
      setPendingDelete(null);
      await loadData();
      setToast("Lançamento excluído.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado.");
    } finally {
      setDeleting(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function exportCsv() {
    const rows = visibleTransactions.map((item) => [
      item.date,
      item.type === "income" ? "Receita" : "Despesa",
      item.description,
      item.category,
      item.paymentMethod,
      item.amount.toFixed(2).replace(".", ","),
    ]);
    const csv = [
      ["Data", "Tipo", "Descrição", "Categoria", "Pagamento", "Valor (R$)"],
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const exportPeriod =
      selectedMonth === "all" ? data?.months.at(-1)?.key ?? "lancamentos" : selectedMonth;
    link.download = `nexora-${exportPeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setToast(`${visibleTransactions.length} lançamento(s) exportado(s).`);
  }

  function closeNavigation() {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="app-shell">
      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nexora</span>
          <button className="sidebar-close" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        <nav aria-label="Menu principal">
          <a className="nav-item active" href="#visao-geral" onClick={closeNavigation}><span>◫</span>Visão geral</a>
          <a className="nav-item" href="#lancamentos" onClick={closeNavigation}><span>↕</span>Lançamentos</a>
          <a className="nav-item" href="#analises" onClick={closeNavigation}><span>⌁</span>Análises</a>
          <a className="nav-item" href="#relatorios" onClick={closeNavigation}><span>▤</span>Relatórios</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-label">CENTRAL NEXORA</span>
            <strong>Decisões com contexto</strong>
            <small>Seu negócio visto por inteiro</small>
          </div>
          <div className="profile">
            <span className="avatar">{initials}</span>
            <span><strong>{user.name}</strong><small>{user.email}</small></span>
            <button
              className="profile-menu-button"
              aria-label="Abrir opções da conta"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((current) => !current)}
            >•••</button>
            {profileOpen && (
              <div className="profile-menu">
                <span>Conta conectada</span>
                <strong>{user.email}</strong>
                <button onClick={signOut}>Sair com segurança</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button
            className="mobile-brand"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >N</button>
          <div className="today-label">
            <span className="today-dot" /> Hoje, {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}
          </div>
          <div className="top-actions">
            <div className="notifications-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Abrir notificações"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
              >
                <span>●</span>
                {insights.length > 0 && <b>{insights.length}</b>}
              </button>
              {notificationsOpen && (
                <div className="notifications-panel" role="status">
                  <div className="notifications-heading"><strong>Leituras recentes</strong><span>{periodLabel}</span></div>
                  {insights.slice(0, 3).map((insight) => (
                    <a href="#analises" key={insight.title} onClick={() => setNotificationsOpen(false)}>
                      <i className={insight.tone} />
                      <span><strong>{insight.title}</strong><small>{insight.eyebrow}</small></span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <button className="signout-button" onClick={signOut}>Sair</button>
            <button className="primary-button" onClick={() => openTransactionForm()}>＋ Novo lançamento</button>
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
              <option value="all">Período atual</option>
              {data?.months.slice().reverse().map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
            </select>
          </div>

          {error && <div className="error-banner" role="alert">{error} <button onClick={loadData}>Tentar novamente</button></div>}

          <section className="metrics-grid" aria-label="Resumo financeiro">
            <article className="metric-card revenue">
              <div className="metric-heading"><span>RECEITA</span><span className="metric-icon">↗</span></div>
              <strong>{loading ? "—" : money.format(selectedSummary.revenue)}</strong>
              <small className="change positive">{formatChange(percentChange(selectedSummary.revenue, selectedSummary.previousRevenue))} <span>vs. período anterior</span></small>
            </article>
            <article className="metric-card expenses">
              <div className="metric-heading"><span>DESPESAS</span><span className="metric-icon">↘</span></div>
              <strong>{loading ? "—" : money.format(selectedSummary.expenses)}</strong>
              <small className="change neutral">{formatChange(percentChange(selectedSummary.expenses, selectedSummary.previousExpenses))} <span>vs. período anterior</span></small>
            </article>
            <article className="metric-card profit">
              <div className="metric-heading"><span>LUCRO LÍQUIDO</span><span className="metric-icon">◇</span></div>
              <strong>{loading ? "—" : money.format(selectedSummary.profit)}</strong>
              <small className="change positive">{formatChange(percentChange(selectedSummary.profit, selectedSummary.previousProfit))} <span>vs. período anterior</span></small>
            </article>
            <article className="metric-card margin">
              <div className="metric-heading"><span>MARGEM</span><span className="metric-icon">%</span></div>
              <strong>{loading ? "—" : `${selectedSummary.margin.toFixed(1).replace(".", ",")}%`}</strong>
              <small>Eficiência do resultado em {periodLabel}</small>
            </article>
          </section>

          <section className="main-grid">
            <article className="panel chart-panel">
              <div className="panel-header">
                <div><p className="eyebrow">DESEMPENHO</p><h2>Receitas e despesas</h2></div>
                <div className="legend"><span><i className="legend-revenue" />Receitas</span><span><i className="legend-expense" />Despesas</span></div>
              </div>
              {chartMonths.length ? (
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
              ) : (
                <div className="chart-empty">
                  <span>↗</span>
                  <strong>Seu gráfico aparecerá aqui</strong>
                  <p>Adicione movimentações para acompanhar a evolução mensal.</p>
                  <button className="secondary-button" onClick={() => openTransactionForm()}>Adicionar primeiro lançamento</button>
                </div>
              )}
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
              <div><p className="eyebrow">MOVIMENTAÇÃO</p><h2>Últimos lançamentos <span className="result-count">{visibleTransactions.length}</span></h2></div>
              <div className="table-actions">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lançamento..." aria-label="Buscar lançamento" />
                <button className="secondary-button" onClick={() => openTransactionForm()}>＋ Adicionar</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Lançamentos financeiros do período selecionado</caption>
                <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Pagamento</th><th>Valor</th><th aria-label="Ações" /></tr></thead>
                <tbody>
                  {visibleTransactions.slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td><span className={`transaction-badge ${item.type}`}>{item.type === "income" ? "↗" : "↘"}</span><strong>{item.description}</strong></td>
                      <td><span className="category-pill">{item.category}</span></td>
                      <td>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td>{item.paymentMethod}</td>
                      <td className={item.type}>{item.type === "expense" ? "− " : "+ "}{money.format(item.amount)}</td>
                      <td><button className="delete-button" onClick={() => setPendingDelete(item)} aria-label={`Excluir ${item.description}`}>×</button></td>
                    </tr>
                  ))}
                  {!loading && !visibleTransactions.length && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        <strong>{search ? "Nenhum resultado para sua busca." : "Nenhum lançamento neste período."}</strong>
                        {!search && <button onClick={() => openTransactionForm()}>Adicionar movimentação</button>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel report-panel" id="relatorios">
            <div className="report-copy">
              <p className="eyebrow">RELATÓRIO DO PERÍODO</p>
              <h2>Resumo pronto para compartilhar</h2>
              <p>Exporte os lançamentos filtrados em CSV para abrir no Excel, enviar à contabilidade ou guardar como histórico.</p>
              <button className="primary-button export-button" onClick={exportCsv} disabled={!visibleTransactions.length}>↓ Exportar CSV</button>
            </div>
            <div className="report-stats">
              <div><span>Lançamentos</span><strong>{periodTransactions.length}</strong></div>
              <div><span>Ticket médio</span><strong>{money.format(averageTicket)}</strong></div>
              <div><span>Resultado</span><strong className={selectedSummary.profit >= 0 ? "positive-text" : "negative-text"}>{money.format(selectedSummary.profit)}</strong></div>
              <div><span>Período</span><strong className="period-name">{periodLabel}</strong></div>
            </div>
          </section>

          <footer>Nexora • Seu negócio, em perspectiva.</footer>
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
              <button type="button" className={type === "income" ? "selected" : ""} onClick={() => setType("income")}>↗ Receita</button>
              <button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => setType("expense")}>↘ Despesa</button>
            </div>
            <form onSubmit={addTransaction}>
              <label>Descrição<input name="description" required autoFocus maxLength={120} placeholder={type === "income" ? "Ex.: Venda de consultoria" : "Ex.: Conta de energia"} /></label>
              <div className="form-row">
                <label>Valor (R$)<input name="amount" required type="number" min="0.01" max="999999999" step="0.01" inputMode="decimal" placeholder="0,00" /></label>
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

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPendingDelete(null)}>
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <span className="confirm-icon">×</span>
            <p className="eyebrow">CONFIRMAR EXCLUSÃO</p>
            <h2 id="delete-title">Excluir “{pendingDelete.description}”?</h2>
            <p>Essa ação remove o lançamento do seu resultado e não pode ser desfeita.</p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={() => setPendingDelete(null)}>Cancelar</button>
              <button className="danger-button" onClick={confirmDelete} disabled={deleting}>{deleting ? "Excluindo..." : "Sim, excluir"}</button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
    </main>
  );
}
