import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const cnpj = new URL(req.url).searchParams.get("cnpj")?.replace(/\D/g, "") ?? "";
  if (cnpj.length !== 14) {
    return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(`${BRASILAPI}/${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": "Intelicite/1.0" },
    });

    if (res.status === 404) {
      return new Response(JSON.stringify({ error: "CNPJ não encontrado na Receita Federal" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) throw new Error(`BrasilAPI ${res.status}`);

    const d = await res.json();

    const payload = {
      cnpj: d.cnpj,
      razaoSocial: d.razao_social ?? "",
      nomeFantasia: d.nome_fantasia ?? "",
      situacaoCadastral: d.descricao_situacao_cadastral ?? "",
      situacaoCod: d.situacao_cadastral,          // 2=Ativa, 3=Suspensa, 4=Inapta, 8=Baixada
      ativo: d.situacao_cadastral === 2,
      dataAbertura: d.data_inicio_atividade ?? null,
      capitalSocial: d.capital_social ?? 0,
      naturezaJuridica: d.natureza_juridica ?? "",
      porte: d.porte ?? "",
      atividadePrincipal: d.cnae_fiscal_descricao ?? "",
      email: d.email ?? "",
      municipio: d.municipio ?? "",
      uf: d.uf ?? "",
      logradouro: [d.logradouro, d.numero, d.bairro].filter(Boolean).join(", "),
      cep: d.cep ?? "",
      socios: (d.qsa ?? []).map((s: any) => ({
        nome: s.nome_socio,
        qualificacao: s.qualificacao_socio,
      })),
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao consultar CNPJ", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
