import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Dashboard de Inteligência de Mercado: agrega contratos públicos recentes do
// PNCP para revelar quem compra, o que compra, onde e quem são os fornecedores
// que mais vencem — visão de mercado que a Settle vende como diferencial.

const CONSULTA = "https://pncp.gov.br/api/consulta/v1/contratos";
const CACHE_TTL_MINUTES = 180;
const PAGINAS = 10;
const TAMANHO_PAGINA = 50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtData = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function fetchRetry(url: string, tries = 5): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 Intelicite/1.0" } });
      if (r.status === 502 || r.status === 503) { await new Promise((s) => setTimeout(s, 600 * (i + 1))); continue; }
      return r;
    } catch (_e) { await new Promise((s) => setTimeout(s, 600 * (i + 1))); }
  }
  return null;
}

// Acumula soma de valor e contagem por chave, devolve top N ordenado por valor.
function topPor(
  // deno-lint-ignore no-explicit-any
  itens: any[], chave: (c: any) => string, n = 10,
) {
  const mapa = new Map<string, { nome: string; count: number; valor: number }>();
  for (const c of itens) {
    const nome = chave(c);
    if (!nome) continue;
    const at = mapa.get(nome) || { nome, count: 0, valor: 0 };
    at.count++;
    at.valor += Number(c.valorGlobal) || 0;
    mapa.set(nome, at);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, n);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const uf = (url.searchParams.get("uf") || "").toUpperCase();
  const q = url.searchParams.get("q")?.trim() || "";
  const dias = Math.min(90, Math.max(7, Number(url.searchParams.get("dias")) || 30));
  const qNorm = norm(q);

  const cacheKey = `mercado|${qNorm}|${uf}|${dias}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cached } = await supabase
    .from("pncp_cache").select("payload, created_at").eq("cache_key", cacheKey).single();
  if (cached) {
    const age = (Date.now() - new Date(cached.created_at).getTime()) / 60000;
    if (age < CACHE_TTL_MINUTES) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }
  }

  const hoje = new Date();
  const ini = new Date(hoje.getTime() - dias * 86400000);

  // deno-lint-ignore no-explicit-any
  const brutos: any[] = [];
  for (let p = 1; p <= PAGINAS; p++) {
    const pncpUrl = `${CONSULTA}?dataInicial=${fmtData(ini)}&dataFinal=${fmtData(hoje)}&pagina=${p}&tamanhoPagina=${TAMANHO_PAGINA}`;
    const r = await fetchRetry(pncpUrl);
    if (!r || r.status !== 200) continue;
    // deno-lint-ignore no-explicit-any
    let j: any;
    try { j = await r.json(); } catch { continue; }
    const data = j.data || [];
    if (data.length === 0) break;
    brutos.push(...data);
  }

  if (brutos.length === 0) {
    return new Response(JSON.stringify({ error: "PNCP indisponível no momento. Tente novamente em instantes." }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const itens = brutos
    .filter((c) => !uf || c.unidadeOrgao?.ufSigla === uf)
    .filter((c) => !qNorm || norm(`${c.objetoContrato} ${c.orgaoEntidade?.razaoSocial}`).includes(qNorm));

  const valorTotal = itens.reduce((s, c) => s + (Number(c.valorGlobal) || 0), 0);
  const orgaosUnicos = new Set(itens.map((c) => c.orgaoEntidade?.cnpj).filter(Boolean)).size;
  const fornecedoresUnicos = new Set(itens.map((c) => c.niFornecedor).filter(Boolean)).size;

  const payload = {
    resumo: {
      contratos: itens.length,
      valorTotal,
      ticketMedio: itens.length ? valorTotal / itens.length : 0,
      orgaosUnicos,
      fornecedoresUnicos,
    },
    porUF: topPor(itens, (c) => c.unidadeOrgao?.ufSigla, 12),
    porCategoria: topPor(itens, (c) => c.categoriaProcesso?.nome, 8),
    topOrgaos: topPor(itens, (c) => c.orgaoEntidade?.razaoSocial, 10),
    topFornecedores: topPor(itens, (c) => c.nomeRazaoSocialFornecedor, 10),
    janela: { dias, ini: fmtData(ini), fim: fmtData(hoje) },
    varridos: brutos.length,
    geradoEm: new Date().toISOString(),
    source: "pncp-consulta-contratos",
  };

  await supabase.from("pncp_cache").upsert({
    cache_key: cacheKey, payload, created_at: new Date().toISOString(),
  }, { onConflict: "cache_key" });

  return new Response(JSON.stringify(payload), {
    headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
});
