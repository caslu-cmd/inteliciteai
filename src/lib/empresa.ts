import { supabase } from "@/integrations/supabase/client";

// Dados da empresa vindos da Receita Federal (cnpj-proxy → BrasilAPI) e o
// texto de perfil consolidado que o Match IA e os alertas usam.

export interface CnaeInfo { codigo: string; descricao: string }

export interface EmpresaDados {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  situacaoCod?: number;        // 2=Ativa, 3=Suspensa, 4=Inapta, 8=Baixada
  ativo: boolean;
  dataAbertura: string | null;
  capitalSocial: number;
  naturezaJuridica: string;
  porte: string;
  atividadePrincipal: string;
  cnaePrincipal: CnaeInfo | null;
  cnaesSecundarios: CnaeInfo[];
  email: string;
  municipio: string;
  uf: string;
  logradouro: string;
  cep: string;
  socios: { nome: string; qualificacao: string }[];
  consultadoEm?: string;       // ISO — quando buscamos na Receita
}

export const somenteDigitos = (s: string) => s.replace(/\D/g, "");

export const formatarCnpj = (raw: string) =>
  somenteDigitos(raw).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export const formatarMoeda = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const formatarData = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};

// Consulta a Receita Federal pelo cnpj-proxy (mesmos dados do cartão CNPJ).
export async function consultarCnpj(cnpj: string): Promise<EmpresaDados> {
  const raw = somenteDigitos(cnpj);
  if (raw.length !== 14) throw new Error("Digite os 14 dígitos do CNPJ.");
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cnpj-proxy?cnpj=${raw}`,
    { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
  );
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || `Erro ${res.status}`);
  return { ...d, cnaesSecundarios: d.cnaesSecundarios || [], socios: d.socios || [], consultadoEm: new Date().toISOString() };
}

// Texto consolidado: bloco da Receita + o que a pessoa escreveu. É o que o
// Match IA lê (ele reconhece os códigos CNAE e busca a atividade no IBGE).
export function montarPerfilEmpresa(d: EmpresaDados | null, complemento: string): string {
  const partes: string[] = [];
  if (d) {
    const nome = [d.razaoSocial, d.nomeFantasia && d.nomeFantasia !== d.razaoSocial ? `(${d.nomeFantasia})` : ""]
      .filter(Boolean).join(" ");
    const local = [d.municipio, d.uf].filter(Boolean).join("/");
    const linhas = [`${nome} — CNPJ ${formatarCnpj(d.cnpj)}${local ? `, ${local}` : ""}${d.porte ? `, porte ${d.porte}` : ""}.`];
    if (d.cnaePrincipal?.codigo) linhas.push(`Atividade principal: CNAE ${d.cnaePrincipal.codigo} — ${d.cnaePrincipal.descricao}.`);
    if (d.cnaesSecundarios.length) {
      linhas.push(`Atividades secundárias: ${d.cnaesSecundarios.map((c) => `CNAE ${c.codigo} — ${c.descricao}`).join("; ")}.`);
    }
    partes.push(linhas.join("\n"));
  }
  if (complemento.trim()) partes.push(complemento.trim());
  return partes.join("\n\n");
}
