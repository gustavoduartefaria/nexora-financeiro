# Nexora

Painel financeiro para pequenas empresas acompanharem receitas, despesas, lucro, margem e oportunidades de economia em um só lugar.

## Recursos

- Cadastro e autenticação de contas
- Dados financeiros separados por usuário
- Registro de receitas e despesas
- Indicadores de receita, custos, lucro e margem
- Comparativo mensal em gráficos
- Recomendações automáticas baseadas nos lançamentos
- Busca, filtros e exclusão de movimentações
- Interface responsiva para computador e celular
- Sessões protegidas e limite de tentativas de acesso

## Tecnologias

- React e Next.js
- Vinext e Cloudflare Workers
- Cloudflare D1
- Drizzle ORM
- TypeScript

## Executar localmente

Requisitos: Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e defina uma chave longa e aleatória em `NEXORA_SESSION_SECRET`. As credenciais administrativas são opcionais; novas contas podem ser criadas pela página `/cadastro`.

## Comandos

```bash
npm run dev
npm run build
npm test
npm run db:generate
```

## Segurança

As senhas são derivadas com PBKDF2 e salt individual. As sessões utilizam cookies `HttpOnly`, `Secure` e `SameSite=Lax`. Nenhuma senha ou chave de produção é armazenada no repositório.

## Banco de dados

As tabelas e migrações ficam em `db/` e `drizzle/`. O sistema cria estruturas essenciais no primeiro uso e mantém cada lançamento associado ao usuário autenticado.
