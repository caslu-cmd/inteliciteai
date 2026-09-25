// Planalto (planalto.gov.br/ccivil_03) como fonte oficial ao vivo da conferência:
// quando a IA cita uma lei/decreto que não está na base, o texto oficial é buscado
// na hora. Página inexistente = norma inexistente. Página encontrada = a íntegra é
// usada para conferir o artigo citado e fica gravada na base para as próximas vezes.

const BASE = "https://www.planalto.gov.br/ccivil_03";
const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ", "&sect;": "§", "&ordm;": "º", "&ordf;": "ª", "&deg;": "°",
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

export function htmlParaTexto(html: string): string {
  let s = html
    .replace(/\r/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = s.replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
  for (const [k, v] of Object.entries(ENTIDADES)) s = s.split(k).join(v);
  return s.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type TipoNorma = "lei" | "lc" | "dec" | "dl";
const NOME: Record<TipoNorma, string> = { lei: "Lei", lc: "Lei Complementar", dec: "Decreto", dl: "Decreto-Lei" };
const CABECALHO: Record<TipoNorma, string> = { lei: "LEI", lc: "LEI COMPLEMENTAR", dec: "DECRETO", dl: "DECRETO-LEI" };

function bloco(ano: number): string | null {
  const blocos = [[2004, 2006], [2007, 2010], [2011, 2014], [2015, 2018], [2019, 2022], [2023, 2026], [2027, 2030]];
  const b = blocos.find(([i, f]) => ano >= i && ano <= f);
  return b ? `_ato${b[0]}-${b[1]}` : null;
}

// Endereços possíveis, na ordem mais provável (o Planalto muda o padrão por época).
export function candidatos(tipo: TipoNorma, num: number, ano?: number): string[] {
  const u: string[] = [];
  if (tipo === "lc") u.push(`leis/lcp/lcp${num}.htm`, `leis/lcp/Lcp${num}.htm`, `leis/lcp/lcp${num}compilado.htm`);
  if (tipo === "dl") u.push(`decreto-lei/del${num}.htm`, `decreto-lei/Del${num}.htm`, `decreto-lei/del${num}compilado.htm`);
  if (tipo === "lei") {
    if (ano && ano >= 2004 && bloco(ano)) u.push(`${bloco(ano)}/${ano}/lei/l${num}.htm`, `${bloco(ano)}/${ano}/lei/L${num}.htm`);
    if (ano && ano >= 2001 && ano <= 2003) u.push(`leis/${ano}/l${num}.htm`, `leis/${ano}/L${num}.htm`, `leis/LEIS_${ano}/L${num}.htm`, `leis/${ano}/L${num}compilada.htm`);
    if (!ano || ano <= 2000) u.push(`leis/l${num}.htm`, `leis/L${num}.htm`, `leis/l${num}cons.htm`, `leis/l${num}compilada.htm`);
  }
  if (tipo === "dec") {
    if (ano && ano >= 2004 && bloco(ano)) u.push(`${bloco(ano)}/${ano}/decreto/d${num}.htm`, `${bloco(ano)}/${ano}/decreto/D${num}.htm`);
    if (ano && ano >= 2001 && ano <= 2003) u.push(`decreto/${ano}/d${num}.htm`, `decreto/${ano}/D${num}.htm`);
    if (!ano || ano <= 2000) u.push(`decreto/d${num}.htm`, `decreto/D${num}.htm`, `decreto/Antigos/D${num}.htm`);
  }
  return u.map((x) => `${BASE}/${x}`);
}

export type ResultadoPlanalto =
  | { situacao: "encontrada"; url: string; texto: string; ano?: number; titulo: string }
  | { situacao: "inexistente" }
  | { situacao: "indisponivel" };

async function baixar(url: string, ms: number): Promise<{ status: number; texto?: string }> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Intelicite/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) { await r.body?.cancel(); return { status: r.status }; }
  const buf = await r.arrayBuffer();
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  const charset = /charset=([^;]+)/.exec(ct)?.[1]?.trim();
  return { status: r.status, texto: htmlParaTexto(new TextDecoder(charset === "utf-8" ? "utf-8" : "iso-8859-1").decode(buf)) };
}

const fmtNum = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// A página precisa SER daquela norma: o cabeçalho oficial traz "LEI Nº 13.303, DE 30 DE JUNHO DE 2016".
function confereCabecalho(texto: string, tipo: TipoNorma, num: number): { ok: boolean; ano?: number } {
  const topo = texto.slice(0, 4000).replace(/\s+/g, " ");
  const n = `(?:${fmtNum(num).replace(/\./g, "\\.")}|${num})`;
  // "LEI Nº 13.303", "LEI No 10.257" e "LEI N o 10.257" (o "o" sobrescrito vem separado)
  const re = new RegExp(`${CABECALHO[tipo]}\\s+N\\s*[º°oO.]?\\s*${n}(?:[^0-9]|$)[^.]{0,60}?DE\\s+(\\d{4})`, "i");
  const m = topo.match(re);
  if (m) return { ok: true, ano: Number(m[1]) };
  // alguns cabeçalhos quebram o ano em outra linha: aceita número + tipo sem o ano
  return { ok: new RegExp(`${CABECALHO[tipo]}\\s+N\\s*[º°oO.]?\\s*${n}(?:[^0-9]|$)`, "i").test(topo) };
}

// Busca a norma no Planalto. "inexistente" só quando TODOS os endereços respondem 404;
// qualquer falha de rede/tempo vira "indisponivel" (não confirmada, nunca "existe").
export async function buscarNoPlanalto(tipo: TipoNorma, num: number, anos: (number | undefined)[]): Promise<ResultadoPlanalto> {
  const urls = [...new Set(anos.flatMap((a) => candidatos(tipo, num, a)))];
  let so404 = true;
  for (const url of urls) {
    try {
      const r = await baixar(url, 12000);
      if (r.status === 404 || r.status === 410) continue;
      if (!r.texto) { so404 = false; continue; }
      const cab = confereCabecalho(r.texto, tipo, num);
      // A página existe, mas não deu para confirmar que é esta norma: nunca conclui "inexistente".
      if (!cab.ok) { so404 = false; continue; }
      if (anos[0] && cab.ano && cab.ano !== anos[0]) continue;          // mesmo número, outro ano
      return { situacao: "encontrada", url, texto: r.texto, ano: cab.ano, titulo: `${NOME[tipo]} nº ${fmtNum(num)}${cab.ano ? `/${cab.ano}` : ""}` };
    } catch { so404 = false; }
  }
  return so404 ? { situacao: "inexistente" } : { situacao: "indisponivel" };
}

// ---------- gravação na base (a próxima consulta já encontra a norma indexada) ----------
function fatiar(text: string, size = 800, overlap = 120): string[] {
  const out: string[] = [];
  let ini = 0;
  while (ini < text.length) {
    let fim = Math.min(ini + size, text.length);
    if (fim < text.length) {
      const corte = Math.max(text.lastIndexOf("\n", fim), text.lastIndexOf(". ", fim), text.lastIndexOf("Art. ", fim));
      if (corte > ini + size - 200) fim = corte + 1;
    }
    const c = text.slice(ini, fim).trim();
    if (c.length > 30) out.push(c);
    if (fim >= text.length) break;
    ini = Math.max(fim - overlap, ini + 1);
  }
  return out;
}

// deno-lint-ignore no-explicit-any
export async function gravarNaBase(supabase: any, tipo: TipoNorma, num: number, ano: number | undefined, texto: string) {
  const reference = nomeNorma(tipo, num, ano);
  const { data: existe } = await supabase.from("legal_knowledge").select("id").eq("reference", reference).maybeSingle();
  if (existe) return;
  const { data: novo } = await supabase.from("legal_knowledge").insert({
    title: `${reference} (íntegra do Planalto, importada na conferência automática)`,
    source_type: tipo === "dec" || tipo === "dl" ? "outro" : "lei", reference, year: ano ?? null, content: texto, active: true,
  }).select("id").single();
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (!novo?.id || !openai) return;
  // Trechos + embeddings em segundo plano: não atrasa a resposta ao usuário.
  const tarefa = (async () => {
    const pedacos = fatiar(texto);
    for (let i = 0; i < pedacos.length; i += 40) {
      const lote = pedacos.slice(i, i + 40);
      const r = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST", headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: lote, dimensions: 1536 }),
      });
      if (!r.ok) return;
      const emb = ((await r.json()).data as { index: number; embedding: number[] }[]).sort((a, b) => a.index - b.index);
      await supabase.from("legal_knowledge_chunks").upsert(
        lote.map((c, j) => ({ knowledge_id: novo.id, chunk_index: i + j, content: c, embedding: JSON.stringify(emb[j].embedding) })),
        { onConflict: "knowledge_id,chunk_index" });
    }
  })().catch(() => {});
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(tarefa);
}

// Constituição Federal (parte permanente, sem o ADCT, que repete a numeração dos artigos).
export async function buscarConstituicao(): Promise<string | null> {
  const r = await baixar(`${BASE}/constituicao/constituicao.htm`, 45000);
  if (!r.texto || r.texto.length < 100000) return null;
  // o título do ADCT também aparece no sumário do topo: vale a última ocorrência
  const corte = r.texto.search(/\n\s*ATO DAS DISPOSI[ÇC][ÕO]ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS\s*\n(?![\s\S]*\n\s*ATO DAS DISPOSI[ÇC][ÕO]ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS\s*\n)/i);
  return corte > r.texto.length * 0.5 ? r.texto.slice(0, corte) : r.texto;
}

export const nomeNorma = (tipo: TipoNorma, num: number, ano?: number) => `${NOME[tipo]} ${fmtNum(num)}${ano ? `/${ano}` : ""}`;
