"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("As senhas não são iguais.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a conta.");
      window.location.href = "/";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell register-shell">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">N</span><strong>Nexora</strong></div>
        <div className="story-copy">
          <span className="story-kicker">COMECE COM CLAREZA</span>
          <h1>Organize hoje.<br /><em>Decida melhor amanhã.</em></h1>
          <p>Crie seu espaço financeiro em poucos segundos. Seus dados ficam separados e protegidos na sua conta.</p>
        </div>
        <div className="register-benefits">
          <span><b>01</b> Painel financeiro individual</span>
          <span><b>02</b> Receitas e despesas organizadas</span>
          <span><b>03</b> Leituras automáticas do resultado</span>
        </div>
        <div className="story-footer"><span>● Cadastro protegido</span><span>NEXORA / 2026</span></div>
      </section>

      <section className="login-form-side register-side">
        <div className="login-card">
          <span className="login-seal">NX</span>
          <p className="eyebrow">NOVA CONTA</p>
          <h2>Crie seu acesso</h2>
          <p className="login-intro">Comece a acompanhar o seu negócio com mais clareza.</p>
          <form onSubmit={submit}>
            <label>Nome completo<input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Como devemos chamar você?" /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="seuemail@empresa.com.br" /></label>
            <label>
              Senha
              <span className="password-field">
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
              </span>
            </label>
            <label>Confirmar senha<input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} placeholder="Digite a senha novamente" /></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={loading}>{loading ? "Criando conta..." : "Criar minha conta"}<span>→</span></button>
          </form>
          <div className="account-switch">Já possui acesso? <a href="/login">Entrar na conta</a></div>
        </div>
      </section>
    </main>
  );
}
