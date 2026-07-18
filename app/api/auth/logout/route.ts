export async function POST() {
  return Response.json(
    { success: true },
    {
      headers: {
        "set-cookie": "nexora_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
        "cache-control": "no-store",
      },
    },
  );
}
