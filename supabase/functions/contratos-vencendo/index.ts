import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Radar de contratos vencendo: usa a API pública de consulta do PNCP para
// encontrar contratos cuja vigência está para acabar — sinal de que uma nova
// licitação (renovação) vem por aí. Mostra o fornecedor atual (o concorrente).

const CONSULTA = "https://pncp.gov.br/api/consulta/v1/contratos";
const CACHE_TTL_MINUTES = 120;
const PAGINAS = 8;            // páginas de 50 = até 400 contratos varridos
const TAMANHO_PAGINA = 50;
const JANELA_PUBLICACAO_DIAS = 60; // varre contratos publicados nos últimos N dias

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtData = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

function normalizar(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function fetchRetry(url: string, tries = 5): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 Intelicite/1.0" },
      });
      if (r.status === 502 || r.status === 503) {
        await new Promise((s) => setTimeout(s, 600 * (i + 1)));
        continue;
      }
      return r;
    } catch (_e) {
      await new Promise((s) => setTimeout(s, 600 * (i + 1)));
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
function normalizarContrato(c: any, hoje: Date) {
  const fim = c.dataVigenciaFim ? new Date(c.dataVigenciaFim + "T00:00:00") : null;
  const diasRestantes = fim ? Math.ceil((fim.getTime() - hoje.getTime()) / 86400000) : null;
  const valor = Number(c.valorGlobal) || 0;
  const cnpj = c.orgaoEntidade?.cnpj || "";
  const ano = c.anoContrato || "";
  const seq = c.sequencialContrato || "";
  const link = cnpj && ano && seq
    ? `https://pncp.gov.br/app/contratos/${cnpj}/${ano}/${seq}`
    : "https://pncp.gov.br";

  return {
    id: c.numeroControlePNCP || `${cnpj}-${seq}`,
    objeto: c.objetoContrato || "Sem descrição",
    orgao: c.orgaoEntidade?.razaoSocial || "Órgão não informado",
    unidade: c.unidadeOrgao?.nomeUnidade || "",
    uf: c.unidadeOrgao?.ufSigla || "",
    municipio: c.unidadeOrgao?.municipioNome || "",
    fornecedor: c.nomeRazaoSocialFornecedor || "",
    valor,
    valorFmt: valor > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor)
      : "Não informado",
    dataVigenciaFim: c.dataVigenciaFim || null,
    diasRestantes,
    tipo: c.tipoContrato?.nome || "",
    link,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const uf = (url.searchParams.get("uf") || "").toUpperCase();
  const horizonte = Math.min(365, Math.max(15, Number(url.searchParams.get("horizonte")) || 90));

  const cacheKey = `contratos|${normalizar(q)}|${uf}|${horizonte}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cache
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
  const ini = new Date(hoje.getTime() - JANELA_PUBLICACAO_DIAS * 86400000);
  const qNorm = normalizar(q);

  // deno-lint-ignore no-explicit-any
  const brutos: any[] = [];
  for (let p = 1; p <= PAGINAS; p++) {
    const pncpUrl = `${CONSULTA}?dataInicial=${fmtData(ini)}&dataFinal=${fmtData(hoje)}&pagina=${p}&tamanhoPagina=${TAMANHO_PAGINA}`;
    const r = await fetchRetry(pncpUrl);
    if (!r || r.status !== 200) continue;
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

  const contratos = brutos
    .map((c) => normalizarContrato(c, hoje))
    .filter((c) => c.diasRestantes !== null && c.diasRestantes >= 0 && c.diasRestantes <= horizonte)
    .filter((c) => !uf || c.uf === uf)
    .filter((c) => !qNorm || normalizar(`${c.objeto} ${c.orgao} ${c.fornecedor}`).includes(qNorm))
    // dedup por id
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .sort((a, b) => (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999));

  const payload = {
    contratos: contratos.slice(0, 60),
    total: contratos.length,
    varridos: brutos.length,
    horizonte,
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
