"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível entrar.");
      window.location.href = "/";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">N</span><strong>Nexora</strong></div>
        <div className="story-copy">
          <span className="story-kicker">GESTÃO FINANCEIRA, SEM DISTRAÇÕES</span>
          <h1>Seu negócio tem um ritmo.<br /><em>A Nexora revela.</em></h1>
          <p>Transforme lançamentos em clareza, sinais em decisões e números em próximos passos.</p>
        </div>
        <div className="story-signal">
          <span>PULSO FINANCEIRO</span>
          <div className="signal-bars" aria-hidden="true">
            {[26, 41, 33, 62, 48, 77, 68, 92].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <small>Visão contínua do seu resultado</small>
        </div>
        <div className="story-footer"><span>● Sistema protegido</span><span>NEXORA / 2026</span></div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <span className="login-seal">NX</span>
          <p className="eyebrow">ÁREA DE GESTÃO</p>
          <h2>Entre na sua conta</h2>
          <p className="login-intro">Acesse o centro financeiro da sua empresa.</p>
          <form onSubmit={submit}>
            <label>
              E-mail
              <input name="email" type="email" autoComplete="username" required placeholder="seuemail@empresa.com.br" />
            </label>
            <label>
              Senha
              <span className="password-field">
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Digite sua senha" />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
              </span>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" disabled={loading}>{loading ? "Validando..." : "Acessar painel"}<span>→</span></button>
          </form>
          <div className="login-help"><span>Ambiente privado da sua empresa</span><span>Suporte Nexora</span></div>
        </div>
      </section>
    </main>
  );
}
