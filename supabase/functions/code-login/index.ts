// Edge Function: code-login
// Ingreso al portal con correo + código de 6 números (para compradores sin Gmail).
// El código lo genera el vendedor con: select public.create_access_code('correo@cliente.com');
// Devuelve un token_hash de un solo uso que el portal canjea con supabase.auth.verifyOtp.
// No envía ningún mail. Deploy con "Verify JWT" desactivado.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_FAILED = 5;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const code = String(body?.code ?? "").replace(/\D/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || code.length !== 6) {
    return json(400, { error: "datos_invalidos" });
  }

  const { data: row, error } = await admin
    .from("access_codes").select("code_hash, failed_attempts").eq("email", email).maybeSingle();
  if (error) { console.error("lookup", error.message); return json(500, { error: "server" }); }
  if (!row || row.failed_attempts >= MAX_FAILED) return json(401, { error: "codigo_invalido" });

  if ((await sha256(code)) !== row.code_hash) {
    await admin.from("access_codes").update({ failed_attempts: row.failed_attempts + 1 }).eq("email", email);
    return json(401, { error: "codigo_invalido" });
  }

  const { data: buyer } = await admin
    .from("buyer_access").select("email").eq("email", email).eq("active", true).maybeSingle();
  if (!buyer) return json(403, { error: "sin_acceso" });

  // Crea el usuario si no existe (ya confirmado). Si ya existe, sigue.
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    console.error("createUser", createErr.message);
    return json(500, { error: "server" });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) { console.error("generateLink", linkErr?.message); return json(500, { error: "server" }); }

  await admin.from("access_codes")
    .update({ failed_attempts: 0, last_used_at: new Date().toISOString() }).eq("email", email);

  return json(200, { token_hash: tokenHash });
});
