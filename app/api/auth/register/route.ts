import { hashPassword, createSessionToken, sessionCookie } from "../../../../lib/auth";
import { createUser, findUserByEmail } from "../../../../lib/users";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLocaleLowerCase("pt-BR");
    const password = String(body.password ?? "");

    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "Informe seu nome completo." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return Response.json({ error: "A senha precisa ter ao menos 8 caracteres, uma letra e um número." }, { status: 400 });
    }
    if (await findUserByEmail(email)) {
      return Response.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }

    const user = await createUser(name, email, await hashPassword(password));
    const token = await createSessionToken(user);
    return Response.json(
      { success: true, user: { name: user.name, email: user.email } },
      { status: 201, headers: { "set-cookie": sessionCookie(token), "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a conta.";
    if (message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
