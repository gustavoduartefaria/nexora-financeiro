import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  return {
    metadataBase: baseUrl,
    title: "Lúmina Financeiro | Clareza para sua empresa",
    description: "Painel financeiro inteligente para pequenas empresas acompanharem receitas, despesas, lucro e oportunidades de economia.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Lúmina Financeiro",
      description: "Clareza para decidir melhor.",
      type: "website",
      locale: "pt_BR",
      images: [{ url: new URL("/og.png", baseUrl), width: 1734, height: 907, alt: "Lúmina Financeiro — Clareza para decidir melhor." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Lúmina Financeiro",
      description: "Clareza para decidir melhor.",
      images: [new URL("/og.png", baseUrl)],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
