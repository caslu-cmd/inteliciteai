import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Real PNCP search API discovered via reverse engineering of pncp.gov.br frontend
const PNCP_SEARCH = "https://pncp.gov.br/api/search";
const ITEMS_PER_PAGE = 10; // PNCP search always returns 10 per page
const CACHE_TTL_MINUTES = 30;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function calcRiskLevel(valor: number, diasAbertura: number): "low" | "medium" | "high" {
  if (diasAbertura < 5 || valor > 5_000_000) return "high";
  if (diasAbertura < 15 || valor > 1_000_000) return "medium";
  return "low";
}

function calcScore(diasAbertura: number, valor: number): number {
  let score = 60;
  if (diasAbertura >= 15) score += 15;
  if (diasAbertura >= 30) score += 5;
  if (valor > 500_000 && valor < 3_000_000) score += 10;
  if (valor >= 3_000_000) score -= 10;
  if (diasAbertura < 7) score -= 15;
  return Math.min(99, Math.max(5, score));
}

function normalizeOpportunity(item: any) {
  const valor = Number(item.valor_global) || 0;

  // Estimate days from publication date (no abertura date in search results)
  const pub = item.data_publicacao_pncp ? new Date(item.data_publicacao_pncp) : new Date();
  const diasAbertura = Math.max(7, Math.ceil((pub.getTime() + 15 * 86400000 - Date.now()) / 86400000));

  const score = calcScore(diasAbertura, valor);
  const risk = calcRiskLevel(valor, diasAbertura);

  // Build PNCP portal link from item_url: /compras/{cnpj}/{ano}/{seq}
  const urlParts = (item.item_url || "").match(/\/(\d+)\/(\d+)\/(\d+)/);
  const cnpjUrl = urlParts?.[1] || "";
  const anoUrl = urlParts?.[2] || "";
  const seqUrl = urlParts?.[3] || "";
  const link = cnpjUrl
    ? `https://pncp.gov.br/app/editais/${cnpjUrl}/${anoUrl}/${seqUrl}`
    : `https://pncp.gov.br`;

  const municipio = item.municipio_nome || "";
  const uf = item.uf || "";
  const location = municipio ? `${municipio}, ${uf}` : (uf || "Brasil");

  const pubFormatted = pub.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return {
    id: item.numero_controle_pncp || item.id || String(Math.random()),
    title: item.description || item.title || "Sem descrição",
    organ: item.orgao_nome || "Órgão não informado",
    location,
    deadline: pubFormatted,
    value: valor > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
      : "Valor sigiloso",
    score,
    risk,
    modalidade: item.modalidade_licitacao_nome || "",
    situacao: item.situacao_nome || "",
    link,
    orgaoCnpj: (item.orgao_cnpj || "").replace(/\D/g, ""),
    dataPublicacao: item.data_publicacao_pncp || null,
    dataAbertura: null,
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
  const search = url.searchParams.get("search") || "licitação";
  const uf = url.searchParams.get("uf") || "";
  const modalidadeId = url.searchParams.get("modalidadeId") || "";
  const pagina = url.searchParams.get("pagina") || "1";

  // Cache key
  const cacheKey = `search|${search}|${uf}|${modalidadeId}|${pagina}`;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check cache
  const { data: cached } = await supabaseClient
    .from("pncp_cache")
    .select("payload, created_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached) {
    const age = (Date.now() - new Date(cached.created_at).getTime()) / 60000;
    if (age < CACHE_TTL_MINUTES) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }
  }

  // Build PNCP search query
  const params = new URLSearchParams({
    q: search,
    tipos_documento: "edital",
    pagina,
  });
  if (uf) params.set("uf", uf.toUpperCase());
  if (modalidadeId) params.set("modalidade_licitacao_id", modalidadeId);

  let pncpData: any;
  try {
    const res = await fetch(`${PNCP_SEARCH}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "Intelicite/1.0" },
    });

    if (!res.ok) throw new Error(`PNCP search error: ${res.status}`);
    pncpData = await res.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao acessar PNCP", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rawItems: any[] = pncpData.items || [];
  const total: number = pncpData.total || 0;
  const opportunities = rawItems.map(normalizeOpportunity);

  const payload = {
    opportunities,
    totalRegistros: total,
    totalPaginas: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
    numeroPagina: Number(pagina),
    tamanhoPagina: ITEMS_PER_PAGE,
    source: "pncp-search",
    fetchedAt: new Date().toISOString(),
  };

  // Store in cache
  await supabaseClient.from("pncp_cache").upsert({
    cache_key: cacheKey,
    payload,
    created_at: new Date().toISOString(),
  }, { onConflict: "cache_key" });

  return new Response(JSON.stringify(payload), {
    headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" },
  });
});
