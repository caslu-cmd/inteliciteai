import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Radar de oportunidades: consulta a busca do PNCP (API usada pelo próprio
// portal) com retry, timeout e fallback. A API do PNCP oscila com frequência
// (502/503), então quando ela falha servimos a última resposta em cache,
// mesmo vencida, em vez de devolver erro — e registramos a causa no log.

const PNCP_SEARCH = "https://pncp.gov.br/api/search";
const ITEMS_PER_PAGE = 10; // PNCP search always returns 10 per page
const CACHE_TTL_MINUTES = 30;
const TRIES = 4;
const TIMEOUT_MS = 12_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonRes = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

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

// deno-lint-ignore no-explicit-any
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

// Uma tentativa contra o PNCP; devolve o JSON ou lança com a causa (status + trecho do corpo)
// deno-lint-ignore no-explicit-any
async function pncpOnce(params: URLSearchParams): Promise<any> {
  const res = await fetch(`${PNCP_SEARCH}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Intelicite/1.0)",
      "Accept-Language": "pt-BR,pt;q=0.9",
      Referer: "https://pncp.gov.br/app/editais",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
    const err = new Error(`PNCP ${res.status}${snippet ? `: ${snippet}` : ""}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// Retry com backoff em falha de rede, timeout, 429 e 5xx
// deno-lint-ignore no-explicit-any
async function pncpWithRetry(params: URLSearchParams): Promise<any> {
  let lastErr: unknown = null;
  for (let i = 0; i < TRIES; i++) {
    try {
      return await pncpOnce(params);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status ?? 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable) break;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!req.headers.get("Authorization")) return jsonRes({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "licitação").trim().slice(0, 200);
  const uf = url.searchParams.get("uf") || "";
  const modalidadeId = url.searchParams.get("modalidadeId") || "";
  const pagina = url.searchParams.get("pagina") || "1";

  // Cache key
  const cacheKey = `search|${search}|${uf}|${modalidadeId}|${pagina}`;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check cache (fresco → responde; vencido → guarda como fallback)
  const { data: cached } = await supabaseClient
    .from("pncp_cache")
    .select("payload, created_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const age = (Date.now() - new Date(cached.created_at).getTime()) / 60000;
    if (age < CACHE_TTL_MINUTES) return jsonRes(cached.payload, 200, { "X-Cache": "HIT" });
  }

  const buildParams = (q: string) => {
    const params = new URLSearchParams({ q, tipos_documento: "edital", pagina });
    if (uf) params.set("uf", uf.toUpperCase());
    if (modalidadeId) params.set("modalidade_licitacao_id", modalidadeId);
    return params;
  };

  // deno-lint-ignore no-explicit-any
  let pncpData: any;
  try {
    pncpData = await pncpWithRetry(buildParams(search));
  } catch (err1) {
    // Segunda chance: a busca do PNCP já engasgou com acentos; tenta sem eles
    const plain = semAcento(search);
    if (plain !== search) {
      try {
        pncpData = await pncpWithRetry(buildParams(plain));
        console.warn(`pncp-proxy: "${search}" falhou (${(err1 as Error).message}); "${plain}" funcionou`);
      } catch (err2) {
        console.error(`pncp-proxy: falha em "${search}" e "${plain}": ${(err2 as Error).message}`);
      }
    } else {
      console.error(`pncp-proxy: falha em "${search}": ${(err1 as Error).message}`);
    }

    if (!pncpData) {
      // PNCP fora do ar: serve o cache vencido, se houver, em vez de erro
      if (cached) {
        return jsonRes({ ...cached.payload, stale: true, fetchedAt: cached.created_at }, 200, { "X-Cache": "STALE" });
      }
      return jsonRes({ error: "O Portal Nacional de Contratações Públicas (PNCP) está instável no momento. Tente novamente em instantes.", detail: String((err1 as Error).message) }, 502);
    }
  }

  // deno-lint-ignore no-explicit-any
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

  return jsonRes(payload, 200, { "X-Cache": "MISS" });
});
