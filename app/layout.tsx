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
    title: "Nexora | Seu negócio, em perspectiva",
    description: "Centro financeiro para pequenas empresas transformarem movimentações em decisões mais claras.",
    icons: {
      icon: "/og.png",
      shortcut: "/og.png",
    },
    openGraph: {
      title: "Nexora",
      description: "Seu negócio, em perspectiva.",
      type: "website",
      locale: "pt_BR",
      images: [{ url: new URL("/og.png", baseUrl), width: 1734, height: 907, alt: "Nexora — Seu negócio, em perspectiva." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Nexora",
      description: "Seu negócio, em perspectiva.",
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
