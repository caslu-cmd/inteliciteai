import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Real PNCP search API discovered via reverse engineering of pncp.gov.br frontend
const PNCP_SEARCH = "https://pncp.gov.br/api/search";
// API oficial de consulta (backend diferente da busca; bem mais estável).
// Exige modalidade: sem filtro, usamos Pregão Eletrônico (6), a mais comum.
const PNCP_CONSULTA = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
// Sem filtro de modalidade: Pregão Eletrônico (6) + Dispensa (8), as mais
// relevantes para quem está começando.
const MODALIDADES_PADRAO = ["6", "8"];
const CONSULTA_PAGINA_BUSCA = 50; // com palavra-chave, pega mais itens para filtrar
const ITEMS_PER_PAGE = 10; // PNCP search always returns 10 per page
const CACHE_TTL_MINUTES = 30;

// O PNCP responde 5xx/timeout com frequência: tenta de novo com espera crescente.
async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let ultimo: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Intelicite/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status >= 500) { ultimo = new Error(`PNCP ${r.status}`); }
      else return r;
    } catch (e) { ultimo = e; }
    await new Promise((s) => setTimeout(s, 500 * (i + 1)));
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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

// Item da API de consulta → mesmo formato do Radar. Aqui temos a data real
// de encerramento das propostas, então o prazo é exato (não estimado).
function normalizeConsulta(c: any) {
  const valor = Number(c.valorTotalEstimado) || 0;
  const fim = c.dataEncerramentoProposta ? new Date(c.dataEncerramentoProposta) : null;
  const diasAbertura = fim ? Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 86400000)) : 7;
  const cnpj = c.orgaoEntidade?.cnpj || "";
  const link = cnpj && c.anoCompra && c.sequencialCompra
    ? `https://pncp.gov.br/app/editais/${cnpj}/${c.anoCompra}/${c.sequencialCompra}`
    : "https://pncp.gov.br";
  const municipio = c.unidadeOrgao?.municipioNome || "";
  const uf = c.unidadeOrgao?.ufSigla || "";
  return {
    id: c.numeroControlePNCP || String(Math.random()),
    title: c.objetoCompra || "Sem descrição",
    organ: [c.orgaoEntidade?.razaoSocial, c.unidadeOrgao?.nomeUnidade].filter(Boolean).join(" — ") || "Órgão não informado",
    location: municipio ? `${municipio}, ${uf}` : (uf || "Brasil"),
    deadline: fim
      ? `Propostas até ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : "",
    value: valor > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
      : "Valor sigiloso",
    score: calcScore(diasAbertura, valor),
    risk: calcRiskLevel(valor, diasAbertura),
    modalidade: c.modalidadeNome || "",
    situacao: c.situacaoCompraNome || "",
    link,
    orgaoCnpj: cnpj.replace(/\D/g, ""),
    dataPublicacao: c.dataPublicacaoPncp || null,
    dataAbertura: c.dataEncerramentoProposta || null,
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

  const termo = semAcento(search.trim());
  const comPalavraChave = !!termo && termo !== "licitacao";
  const palavras = termo.split(/\s+/).filter((w) => w.length > 2);
  const bateTermo = (c: any) => {
    if (!comPalavraChave) return true;
    const alvo = semAcento(`${c.objetoCompra || ""} ${c.orgaoEntidade?.razaoSocial || ""} ${c.unidadeOrgao?.nomeUnidade || ""}`);
    return palavras.some((w) => alvo.includes(w));
  };

  // Uma página da consulta oficial para uma modalidade.
  const consultar = async (modalidade: string) => {
    const fim = new Date(Date.now() + 365 * 86400000);
    const q = new URLSearchParams({
      dataFinal: fim.toISOString().slice(0, 10).replace(/-/g, ""),
      codigoModalidadeContratacao: modalidade,
      pagina,
      tamanhoPagina: String(comPalavraChave ? CONSULTA_PAGINA_BUSCA : ITEMS_PER_PAGE),
    });
    if (uf) q.set("uf", uf.toUpperCase());
    const res = await fetchRetry(`${PNCP_CONSULTA}?${q}`);
    if (!res.ok) throw new Error(`PNCP consulta error: ${res.status}`);
    const d = await res.json();
    return {
      itens: (d.data || []) as any[],
      total: Number(d.totalRegistros) || 0,
      paginas: Number(d.totalPaginas) || 1,
    };
  };

  let payload: any = null;
  let erroConsulta: unknown = null;

  // 1) Fonte principal: consulta oficial (só propostas abertas, UF e modalidade
  //    corretos, prazo real). Sem modalidade, junta pregão eletrônico + dispensa.
  try {
    const modalidades = modalidadeId ? [modalidadeId] : MODALIDADES_PADRAO;
    const resultados = await Promise.allSettled(modalidades.map(consultar));
    const ok = resultados.filter((r): r is PromiseFulfilledResult<{ itens: any[]; total: number; paginas: number }> => r.status === "fulfilled").map((r) => r.value);
    if (ok.length === 0) throw (resultados[0] as PromiseRejectedResult).reason;

    const itens = ok.flatMap((r) => r.itens).filter(bateTermo)
      .sort((a, b) => String(a.dataEncerramentoProposta || "").localeCompare(String(b.dataEncerramentoProposta || "")));

    payload = {
      opportunities: itens.map(normalizeConsulta),
      totalRegistros: ok.reduce((n, r) => n + r.total, 0),
      totalPaginas: Math.max(1, ...ok.map((r) => r.paginas)),
      numeroPagina: Number(pagina),
      tamanhoPagina: ITEMS_PER_PAGE,
      source: "pncp-consulta",
      fonte: "Consulta oficial do PNCP · somente editais com propostas abertas",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    erroConsulta = err;
    console.error(`pncp-proxy: consulta falhou (${String(err)}), tentando busca`);
  }

  // 2) Reserva: busca textual do PNCP (instável; pode ignorar filtros).
  if (!payload) {
    try {
      const params = new URLSearchParams({ q: search, tipos_documento: "edital", ordenacao: "-data", pagina, tam_pagina: String(ITEMS_PER_PAGE), status: "recebendo_proposta" });
      if (uf) { params.set("uf", uf.toUpperCase()); params.set("ufs", uf.toUpperCase()); }
      if (modalidadeId) { params.set("modalidade_licitacao_id", modalidadeId); params.set("modalidades", modalidadeId); }
      const res = await fetchRetry(`${PNCP_SEARCH}?${params}`);
      if (!res.ok) throw new Error(`PNCP search error: ${res.status}`);
      const d = await res.json();
      const rawItems: any[] = d.items || [];
      const total: number = d.total || 0;
      payload = {
        opportunities: rawItems.map(normalizeOpportunity),
        totalRegistros: total,
        totalPaginas: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
        numeroPagina: Number(pagina),
        tamanhoPagina: ITEMS_PER_PAGE,
        source: "pncp-search",
        fallback: true,
        fallbackNota: "A consulta oficial do PNCP falhou; usando a busca do portal, que pode trazer editais encerrados ou de outros estados. Confira o prazo antes de se animar.",
        fetchedAt: new Date().toISOString(),
      };
    } catch (errBusca) {
      console.error(`pncp-proxy: busca também falhou (${String(errBusca)})`);
      // 3) Tudo caiu: serve o cache antigo, se houver, marcado como "stale".
      if (cached?.payload) {
        const stale = { ...cached.payload, stale: true, cachedAt: cached.created_at };
        return new Response(JSON.stringify(stale), {
          headers: { ...cors, "Content-Type": "application/json", "X-Cache": "STALE" },
        });
      }
      return new Response(JSON.stringify({
        error: "O portal do PNCP (governo federal) está instável no momento. Não é um problema da Intelicite — tente novamente em alguns minutos.",
        detail: `${String(erroConsulta)} / ${String(errBusca)}`,
      }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

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
