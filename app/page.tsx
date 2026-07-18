import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard-client";
import { readSessionToken } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get("nexora_session")?.value);
  if (!session) redirect("/login");
  return <Dashboard />;
}
