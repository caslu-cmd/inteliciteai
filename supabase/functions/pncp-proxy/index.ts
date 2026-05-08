import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PNCP_BASE = "https://pncp.gov.br/api/pncp/v1";
const CACHE_TTL_MINUTES = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dateToYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function calcRiskLevel(valor: number, diasAbertura: number): "low" | "medium" | "high" {
  if (diasAbertura < 5 || valor > 5_000_000) return "high";
  if (diasAbertura < 15 || valor > 1_000_000) return "medium";
  return "low";
}

function calcScore(diasAbertura: number, valor: number): number {
  // Simple heuristic: more time + medium value = higher fit score
  let score = 60;
  if (diasAbertura >= 15) score += 15;
  if (diasAbertura >= 30) score += 5;
  if (valor > 500_000 && valor < 3_000_000) score += 10;
  if (valor >= 3_000_000) score -= 10;
  if (diasAbertura < 7) score -= 15;
  return Math.min(99, Math.max(5, score));
}

function normalizeOpportunity(item: any) {
  const abertura = item.dataAberturaProposta
    ? new Date(item.dataAberturaProposta)
    : item.dataEncerramentoProposta
    ? new Date(item.dataEncerramentoProposta)
    : null;

  const now = new Date();
  const diasAbertura = abertura
    ? Math.ceil((abertura.getTime() - now.getTime()) / 86400000)
    : 30;

  const valor = item.valorTotalEstimado || 0;
  const riskLevel = calcRiskLevel(valor, diasAbertura);
  const score = calcScore(diasAbertura, valor);

  const deadlineStr = abertura
    ? abertura.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const uf = item.unidadeOrgao?.ufSigla || "BR";
  const municipio = item.unidadeOrgao?.municipioNome || "";
  const location = municipio ? `${municipio}, ${uf}` : uf;

  return {
    id: item.numeroControlePNCP,
    title: item.objetoCompra || "Sem descrição",
    organ: item.orgaoEntidade?.razaoSocial || "Órgão não informado",
    location,
    deadline: deadlineStr,
    value: valor > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
      : "Valor sigiloso",
    score,
    risk: riskLevel,
    modalidade: item.modalidadeLicitacaoNome || "",
    situacao: item.situacaoCompraNome || "",
    link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.numeroControlePNCP}`,
    dataPublicacao: item.dataPublicacaoGlobal || null,
    dataAbertura: item.dataAberturaProposta || null,
    orgaoCnpj: item.orgaoEntidade?.cnpj || null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const uf = url.searchParams.get("uf") || "";
  const modalidadeId = url.searchParams.get("modalidadeId") || "";
  const pagina = url.searchParams.get("pagina") || "1";
  const tamanhoPagina = url.searchParams.get("tamanhoPagina") || "20";
  const search = url.searchParams.get("search") || "";

  // Date range: last 30 days to today + 90 days ahead
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 30);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 90);

  const dataInicial = url.searchParams.get("dataInicial") || dateToYYYYMMDD(inicio);
  const dataFinal   = url.searchParams.get("dataFinal")   || dateToYYYYMMDD(fim);

  // Check Supabase cache
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cacheKey = `${uf}|${modalidadeId}|${pagina}|${tamanhoPagina}|${dataInicial}|${dataFinal}`;
  const { data: cached } = await supabase
    .from("pncp_cache")
    .select("payload, created_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached) {
    const age = (Date.now() - new Date(cached.created_at).getTime()) / 60000;
    if (age < CACHE_TTL_MINUTES) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }
  }

  // Build PNCP query
  const params = new URLSearchParams({
    dataInicial,
    dataFinal,
    pagina,
    tamanhoPagina,
  });
  if (uf)          params.set("uf", uf.toUpperCase());
  if (modalidadeId) params.set("modalidadeId", modalidadeId);

  let pncpData: any;
  try {
    const pncpRes = await fetch(`${PNCP_BASE}/contratacoes/publicacoes?${params}`, {
      headers: { "Accept": "application/json", "User-Agent": "Intelicite/1.0" },
    });

    if (!pncpRes.ok) {
      throw new Error(`PNCP API error: ${pncpRes.status}`);
    }

    pncpData = await pncpRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao acessar PNCP", detail: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawItems: any[] = pncpData.data || [];

  // Filter by search term if provided
  const filtered = search
    ? rawItems.filter((item: any) =>
        (item.objetoCompra || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.orgaoEntidade?.razaoSocial || "").toLowerCase().includes(search.toLowerCase())
      )
    : rawItems;

  const opportunities = filtered.map(normalizeOpportunity);

  const payload = {
    opportunities,
    totalRegistros: pncpData.totalRegistros || 0,
    totalPaginas: pncpData.totalPaginas || 1,
    numeroPagina: Number(pagina),
    tamanhoPagina: Number(tamanhoPagina),
    source: "pncp",
    fetchedAt: new Date().toISOString(),
  };

  // Upsert to cache
  await supabase.from("pncp_cache").upsert({
    cache_key: cacheKey,
    payload,
    created_at: new Date().toISOString(),
  }, { onConflict: "cache_key" });

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
});
