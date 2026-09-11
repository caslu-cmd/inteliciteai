import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PNCP_SEARCH = "https://pncp.gov.br/api/search";
const MAX_NOVOS_POR_USUARIO = 5;

// deno-lint-ignore no-explicit-any
async function buscarEditais(keywords: string, uf?: string | null): Promise<any[]> {
  const params = new URLSearchParams({ q: keywords, tipos_documento: "edital", pagina: "1" });
  if (uf) params.set("uf", uf.toUpperCase());
  const res = await fetch(`${PNCP_SEARCH}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "Intelicite/1.0" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Autenticação: só o cron interno (segredo guardado em internal_config)
  const secret = req.headers.get("x-cron-secret") || "";
  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
  if (!cfg?.value || secret !== cfg.value) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });
  }

  const { data: users } = await supabase
    .from("profiles")
    .select("id, alerta_keywords, alerta_uf")
    .eq("alerta_ativo", true)
    .not("alerta_keywords", "is", null)
    .limit(300);

  let usuarios = 0, notificados = 0;

  for (const u of users ?? []) {
    const kw = (u.alerta_keywords || "").trim();
    if (!kw) continue;
    usuarios++;
    try {
      const items = await buscarEditais(kw, u.alerta_uf);
      if (items.length === 0) continue;

      const candidatos = items.slice(0, 15).map((it) => ({
        id: String(it.numero_controle_pncp || it.id || ""),
        titulo: it.description || it.title || "Novo edital",
        orgao: it.orgao_nome || "",
      })).filter((c) => c.id);

      const ids = candidatos.map((c) => c.id);
      const { data: enviados } = await supabase
        .from("alertas_enviados")
        .select("edital_id")
        .eq("user_id", u.id)
        .in("edital_id", ids);
      const jaEnviados = new Set((enviados ?? []).map((e: { edital_id: string }) => e.edital_id));

      const novos = candidatos.filter((c) => !jaEnviados.has(c.id)).slice(0, MAX_NOVOS_POR_USUARIO);

      for (const n of novos) {
        await supabase.from("notifications").insert({
          user_id: u.id,
          title: "Novo edital compatível 🎯",
          message: `${n.titulo}${n.orgao ? ` — ${n.orgao}` : ""}`.slice(0, 300),
          type: "info",
          action_url: "/licitante/radar",
          read: false,
        });
        await supabase.from("alertas_enviados").insert({ user_id: u.id, edital_id: n.id });
        notificados++;
      }
    } catch (_e) { /* falha de um usuário não interrompe os demais */ }
  }

  return new Response(JSON.stringify({ ok: true, usuarios, notificados }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
