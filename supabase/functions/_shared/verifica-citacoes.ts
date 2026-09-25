// Verificação determinística das citações legais que a IA produz.
//
// A IA pode errar número de artigo mesmo com a base no contexto (já citou o
// "Art. 37, §1º" para vistoria, que é do Art. 63). Por isso nenhuma citação é
// aceita pela palavra da IA: o código localiza o dispositivo na ÍNTEGRA oficial
// indexada (legal_knowledge) e confere se o TRECHO literal que a IA transcreveu
// está mesmo naquele artigo. Número inexistente ou trecho de outro artigo = reprovado.

import { buscarConstituicao, buscarNoPlanalto, confirmarNoSenado, gravarNaBase, nomeNorma, type TipoNorma } from "./planalto.ts";
import { type ItemRevisao, type Revisao, revisarPertinencia, type Veredito } from "./revisor.ts";

export type Status = "conferida" | "sem_trecho" | "nao_confere";
export interface Citacao {
  rotulo: string;          // "Art. 63, § 3º — Lei 14.133/2021"
  lei: string;             // chave da lei ("14133")
  art: number;
  artFim?: number;         // "Arts. 40 a 41": o trecho pode estar em qualquer artigo do intervalo
  par?: string;            // "3" | "unico"
  inciso?: string;         // "VI"
  trecho?: string;         // trecho literal que a IA atribuiu ao dispositivo
  status: Status;
  motivo: string;
  ocorrencias?: string[];  // texto exato da citação na resposta (para remover se não conferir)
  link?: string;           // endereço oficial montado pelo código (Planalto com âncora no dispositivo)
  pertinencia?: Veredito | "nao_revisado";   // o texto oficial sustenta a afirmação feita com ele?
  pertinenciaMotivo?: string;
  removidoPor?: "pertinencia";
}

// ---------- links oficiais de verificação ----------
// Montados pelo código a partir do endereço oficial da norma; a IA não escreve links.
// Planalto tem âncora por dispositivo: #art63, #art63§2, #art63iii, #art164p (parágrafo único).
const urlsNorma = new Map<string, string>();
export const URL_CF = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
export function linkCitacao(c: { lei: string; art: number; par?: string; inciso?: string }): string | undefined {
  const base = urlsNorma.get(c.lei);
  if (!base) return undefined;
  if (!/planalto\.gov\.br/.test(base)) return base;                 // Portal de Compras: sem âncora por artigo
  const ancora = `art${c.art}${c.par ? (c.par === "unico" ? "p" : `%C2%A7${c.par}`) : ""}${!c.par && c.inciso ? c.inciso.toLowerCase() : ""}`;
  return `${base}#${ancora}`;
}
export const linkNorma = (chave: string) => urlsNorma.get(chave);

// ---------- leis indexadas ----------
const LEIS: { chave: string; nome: string; titulo: RegExp; menciona: RegExp }[] = [
  { chave: "14133", nome: "Lei 14.133/2021", titulo: /14\.133/, menciona: /14\.?133|nova lei de licita/i },
  { chave: "8666", nome: "Lei 8.666/1993", titulo: /8\.666/, menciona: /8\.?666/ },
  { chave: "10520", nome: "Lei 10.520/2002", titulo: /10\.520/, menciona: /10\.?520/ },
  { chave: "lc123", nome: "LC 123/2006", titulo: /Complementar nº 123/, menciona: /LC\s*n?º?\s*123|Complementar\s*n?º?\s*123|123\/2006/i },
  { chave: "d10024", nome: "Decreto 10.024/2019", titulo: /10\.024/, menciona: /10\.?024/ },
  { chave: "d11462", nome: "Decreto 11.462/2023", titulo: /11\.462/, menciona: /11\.?462/ },
  { chave: "d11246", nome: "Decreto 11.246/2022", titulo: /11\.246/, menciona: /11\.?246/ },
  { chave: "in58", nome: "IN SEGES/ME 58/2022", titulo: /IN SEGES\/ME nº 58/, menciona: /IN\s*(SEGES(\/ME)?\s*)?n?º?\s*58\b/i },
  { chave: "in65", nome: "IN SEGES/ME 65/2021", titulo: /IN SEGES\/ME nº 65/, menciona: /IN\s*(SEGES\/ME\s*)?n?º?\s*65/i },
];

interface Artigo { texto: string; norm: string; pars: Map<string, string>; incisos: Set<string> }
export type Indice = Map<string, Map<number, Artigo>>;

// Marcadores de inciso ("I -") e alínea ("a)") não são texto: quem transcreve um trecho
// costuma omiti-los, e isso não é paráfrase. Todo o resto é comparado palavra por palavra.
export function normalizar(s: string): string {
  return s.replace(/(^|[\s:;.])[IVXLC]{1,7}\s*[-–]\s/g, "$1 ").replace(/(^|[\s:;])[a-z]\)\s/g, "$1 ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[º°ª]/g, "o").replace(/[^a-z0-9]+/g, " ").trim();
}

function indexarLei(conteudo: string): Map<number, Artigo> {
  const txt = conteudo.replace(/\s+/g, " ");
  // Cabeçalho de artigo: "Art. 63." / "Art. 1º" / "Art. 75-A". Referências no meio do
  // texto vêm em minúscula ("art. 26 desta Lei") e não quebram o artigo.
  const cab = /Art\. ?(\d{1,4})(?:º|o)?(?:-[A-Z])?\.? /g;
  const pos: { n: number; i: number }[] = [];
  for (const m of txt.matchAll(cab)) pos.push({ n: Number(m[1]), i: m.index! });
  const arts = new Map<number, Artigo>();
  pos.forEach((p, k) => {
    const texto = txt.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : txt.length);
    const a = arts.get(p.n);
    const junto = a ? a.texto + " " + texto : texto;   // artigo que aparece em mais de uma redação
    const pars = new Map<string, string>();
    // Cabeçalho de parágrafo vem seguido de maiúscula ("§ 3º Para os fins...") ou "(VETADO)";
    // a menção no meio do texto ("no § 2º deste artigo") não abre parágrafo novo.
    const pcab = /§ ?(\d{1,2}) ?(?:º|°|o)?(?:-[A-Z])?\.? (?=[A-ZÀ-Ý(])|Parágrafo único/g;
    const pp = [...junto.matchAll(pcab)];
    pp.forEach((m, j) => {
      const chave = m[1] ?? "unico";
      const t = junto.slice(m.index!, j + 1 < pp.length ? pp[j + 1].index! : junto.length);
      pars.set(chave, (pars.get(chave) ?? "") + " " + t);
    });
    const incisos = new Set([...junto.matchAll(/(?:^|[ .;:])([IVXLC]{1,7}) ?[-–]/g)].map((m) => m[1]));
    arts.set(p.n, { texto: junto, norm: normalizar(junto), pars, incisos });
  });
  return arts;
}

let cache: Indice | null = null;
// deno-lint-ignore no-explicit-any
export async function carregarIndice(supabase: any): Promise<Indice> {
  if (cache) return cache;
  const { data } = await supabase.from("legal_knowledge").select("id, title, content, url").eq("active", true);
  const idx: Indice = new Map();
  // atos infralegais do Portal de Compras: existência, vigência e (com texto importado) artigos
  const { data: at } = await supabase.from("atos_compras").select("tipo, numero, ano, titulo, vigente, knowledge_id, url");
  if (at) {
    atos = at;
    const porId = new Map((data || []).map((d: { id: string; content: string }) => [d.id, d.content]));
    for (const a of at as Ato[]) {
      const txt = a.knowledge_id ? porId.get(a.knowledge_id) as string | undefined : undefined;
      if (txt && a.vigente) idx.set(chaveAto(a.tipo, a.numero, a.ano), indexarLei(txt));
      if (a.url) urlsNorma.set(chaveAto(a.tipo, a.numero, a.ano), a.url);
    }
  }
  for (const lei of LEIS) {
    const doc = (data || []).filter((d: { title: string; content: string }) => lei.titulo.test(d.title))
      .sort((a: { content: string }, b: { content: string }) => (b.content?.length || 0) - (a.content?.length || 0))[0];
    if (doc?.content && doc.content.length > 5000) idx.set(lei.chave, indexarLei(doc.content));
    if (doc?.url) urlsNorma.set(lei.chave, doc.url);
  }
  catalogo = catalogoNormas((data || []).map((d: { title: string; content: string }) => `${d.title}\n${d.content || ""}`));
  // Núcleo = a base curada (sem o que a conferência importou do Planalto/Portal de Compras):
  // só as normas citadas por ele entram na pré-carga, senão a fila segue a cadeia de citações
  // de toda a legislação federal.
  catalogoNucleo = catalogoNormas((data || []).filter((d: { title: string }) => !/íntegra do (Planalto|Portal de Compras)/.test(d.title))
    .map((d: { title: string; content: string }) => `${d.title}\n${d.content || ""}`));
  // Normas que a conferência já trouxe do Planalto em consultas anteriores: artigos indexados.
  for (const d of (data || []) as { title: string; content: string; url?: string }[]) {
    if (!/íntegra do Planalto/.test(d.title) || !d.content) continue;
    if (/^Constitui[çc][ãa]o Federal/.test(d.title)) { if (!idx.has("cf")) idx.set("cf", indexarLei(d.content)); urlsNorma.set("cf", d.url || URL_CF); continue; }
    const m = [...d.title.matchAll(RE_NORMA)][0];
    if (m) {
      const k = chaveNorma(m[1], m[2]);
      if (!FIXAS[k] && !idx.has(k)) idx.set(k, indexarLei(d.content));
      if (d.url && !FIXAS[k]) urlsNorma.set(k, d.url);
    }
  }
  cache = idx;
  return idx;
}
export function indiceDeTextos(docs: { title: string; content: string; url?: string }[]): Indice {
  const idx: Indice = new Map();
  for (const lei of LEIS) {
    const doc = docs.filter((d) => lei.titulo.test(d.title)).sort((a, b) => b.content.length - a.content.length)[0];
    if (doc?.url) urlsNorma.set(lei.chave, doc.url);
    if (doc && doc.content.length > 5000) idx.set(lei.chave, indexarLei(doc.content));
  }
  catalogo = catalogoNormas(docs.map((d) => `${d.title}\n${d.content}`));
  return idx;
}

// ---------- extração ----------
const RE_CIT = /\b[Aa]rt(?:igo)?s?\.?\s*(\d{1,4})\s*(?:º|°|o\b)?(?:-[A-Z])?((?:\s*(?:,|\be\b)?\s*(?:caput\b|§§?\s*\d{1,2}\s*[º°o]?(?:\s*(?:,|e|a)\s*\d{1,2}\s*[º°o]?)*|par[áa]grafo\s+[úu]nico|(?:inc(?:iso|\.)?\s*)?\b[IVXLC]{1,7}\b(?![a-z])|al[íi]nea\s+["“]?[a-z]["”]?))*)/g;

function leiDaVizinhanca(texto: string, ini: number, fim: number, padrao: string): string {
  // Lei na MESMA linha: primeiro depois da citação (até 160 caracteres), depois antes dela.
  const fimLinha = texto.indexOf("\n", fim);
  // A lei "depois" da citação nunca é procurada DENTRO do trecho entre aspas: a transcrição
  // pode mencionar outra lei ("... art. 40 da Lei nº 13.303 ...") e não é ela a citada.
  let depois = texto.slice(fim, Math.min(fim + 160, fimLinha < 0 ? texto.length : fimLinha));
  const aspas = depois.search(/["“]/);
  if (aspas >= 0) depois = depois.slice(0, aspas);
  // Nem atravessa o fim da frase: a lei citada na frase seguinte não é a deste artigo
  // ("Impugnação: Art. 164. ... Lei 13.303/2016" não é o Art. 164 da Lei 13.303).
  const fimFrase = depois.search(/[.;!?]\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ\[(])/);
  if (fimFrase >= 0) depois = depois.slice(0, fimFrase);
  const iniLinha = texto.lastIndexOf("\n", ini) + 1;
  let antes = texto.slice(Math.max(iniLinha, ini - 80), ini);
  const cortes = [...antes.matchAll(/[.;!?]\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ\[(])/g)];
  if (cortes.length) { const u = cortes[cortes.length - 1]; antes = antes.slice(u.index! + u[0].length); }
  const achar = (alvo: string, doFim: boolean): { k: string; d: number } | undefined => {
    let melhor: { k: string; d: number } | null = null;
    // Constituição Federal ("art. 173, § 1º, da Constituição Federal", "CF/88")
    const cfs = [...alvo.matchAll(RE_CF)];
    const cf = doFim ? cfs[cfs.length - 1] : cfs[0];
    if (cf?.index !== undefined) melhor = { k: "cf", d: doFim ? alvo.length - cf.index : cf.index };
    for (const l of LEIS) {
      const ms = [...alvo.matchAll(new RegExp(l.menciona.source, l.menciona.flags.includes("i") ? "gi" : "g"))];
      const m = doFim ? ms[ms.length - 1] : ms[0];
      if (m?.index === undefined) continue;
      const d = doFim ? alvo.length - m.index : m.index;
      if (!melhor || d < melhor.d) melhor = { k: l.chave, d };
    }
    // Qualquer outra lei/LC/decreto citado ("Art. 3º da Lei 13.303/2016"): chave genérica,
    // que o Planalto resolve na hora.
    const gs = [...alvo.matchAll(RE_NORMA)];
    const g = doFim ? gs[gs.length - 1] : gs[0];
    if (g?.index !== undefined) {
      const d = (doFim ? alvo.length - g.index : g.index) + 0.5;
      if (!melhor || d < melhor.d) melhor = { k: chaveNorma(g[1], g[2]), d };
    }
    // IN / portaria / ON / resolução ("Art. 5º da IN SEGES/ME nº 73/2022")
    const as = [...alvo.matchAll(RE_ATO)];
    const a = doFim ? as[as.length - 1] : as[0];
    if (a?.index !== undefined) {
      const d = (doFim ? alvo.length - a.index : a.index) + 0.5;
      const tipo = tipoAto(a[1]), numero = Number(a[3].replace(/\./g, ""));
      let ano = a[4] || a[5] ? Number(a[4] || a[5]) : undefined;
      if (!ano) {            // sem ano: se o catálogo tiver uma só vigente com esse número, é ela
        const vig = (atos || []).filter((x) => x.tipo === tipo && x.numero === numero && x.vigente);
        if (vig.length === 1) ano = vig[0].ano ?? undefined;
      }
      if (!melhor || d < melhor.d) melhor = { k: chaveAto(tipo, numero, ano), d };
    }
    return melhor ? { k: FIXAS[melhor.k] ?? melhor.k, d: melhor.d } : undefined;
  };
  // Vale a lei mencionada MAIS PERTO: "Art. 24 do Decreto 10.024" (logo depois) ou
  // "Decreto nº 10.024/2019, Art. 1º, § 2º" (logo antes). Empate: a de depois.
  const dp = achar(depois, false), an = achar(antes, true);
  if (dp && an) return dp.d <= an.d ? dp.k : an.k;
  return dp?.k ?? an?.k ?? padrao;
}

// Constituição Federal: não é "Lei nº", tem padrão próprio de menção.
const RE_CF = /Constitui[çc][ãa]o(?:\s+Federal|\s+da\s+Rep[úu]blica)?|\bCF(?:\/88|\/1988)?\b|\bCRFB(?:\/88)?\b/gi;

// Trecho literal atribuído à citação: texto entre aspas logo depois dela (mesma linha/frase).
function trechoProximo(texto: string, fim: number): string | undefined {
  const janela = texto.slice(fim, fim + 400).split(/\n\s*[•\-*]|\n\n/)[0];
  const m = janela.match(/["“]([^"”]{25,600})["”]/);
  return m?.[1];
}

// "§ 3º do Art. 63" -> "Art. 63, § 3º" (a mesma forma na extração e ao sanear o texto)
export function inverterForma(texto: string): string {
  return texto.replace(/(§§?\s*\d{1,2}\s*[º°o]?|par[áa]grafo\s+[úu]nico|inciso\s+[IVXLC]{1,7})\s+do\s+([Aa]rt(?:igo)?\.?\s*\d{1,4}\s*[º°o]?)/g, "$2, $1");
}

export function extrairCitacoes(texto: string, leiPadrao = "14133") {
  texto = inverterForma(texto);
  const out: Omit<Citacao, "status" | "motivo">[] = [];
  const faixas = new Map<number, number>();
  for (const f of texto.matchAll(/\bArts\.?\s*(\d{1,4})\s*[º°o]?\s*(?:a|e)\s*(\d{1,4})/g)) faixas.set(f.index!, Number(f[2]));
  // Menção a artigo DENTRO de um trecho transcrito ("... art. 40 da Lei nº 13.303 ...") é parte
  // do texto oficial, não citação da IA: não é conferida à parte.
  const transcricoes = [...texto.matchAll(/["“][^"”]{25,1200}["”]/g)].map((q) => [q.index!, q.index! + q[0].length]);
  for (const m of texto.matchAll(RE_CIT)) {
    if (transcricoes.some(([i, f]) => m.index! > i && m.index! < f)) continue;
    const art = Number(m[1]);
    const fimFaixa = faixas.get(m.index!);
    const artFim = fimFaixa && fimFaixa > art && fimFaixa - art <= 6 ? fimFaixa : undefined;
    const cauda = m[2] || "";
    const lei = leiDaVizinhanca(texto, m.index!, m.index! + m[0].length, leiPadrao);
    const pars = [...cauda.matchAll(/(\d{1,2})\s*[º°o]?/g)].filter(() => /§/.test(cauda)).map((x) => x[1]);
    if (/par[áa]grafo\s+[úu]nico/i.test(cauda)) pars.push("unico");
    const inc = cauda.match(/\b([IVXLC]{1,7})\b(?![a-z])/)?.[1];
    const trecho = trechoProximo(texto, m.index! + m[0].length);
    const nome = LEIS.find((l) => l.chave === lei)?.nome || nomeDaChave(lei);
    const base = { lei, art, artFim, inciso: inc, trecho, ocorrencias: [m[0].trim()] };
    if (pars.length) for (const p of pars) out.push({ ...base, par: p, rotulo: `Art. ${art}, ${p === "unico" ? "parágrafo único" : `§ ${p}º`}${inc ? `, ${inc}` : ""} · ${nome}` });
    else out.push({ ...base, rotulo: `${artFim ? `Arts. ${art} a ${artFim}` : `Art. ${art}`}${inc ? `, ${inc}` : ""} · ${nome}` });
  }
  return out;
}

// ---------- conferência ----------
export function contem(alvo: string, trecho: string): boolean {
  const pedacos = trecho.split(/\.\.\.|…|\[\.\.\.\]|\(\.\.\.\)/).map(normalizar).filter((p) => p.split(" ").length >= 3);
  if (!pedacos.length) return false;
  let de = 0;
  for (const p of pedacos) {
    const i = alvo.indexOf(p, de);
    if (i < 0) return false;
    de = i + p.length;
  }
  return true;
}

export function conferir(texto: string, idx: Indice, leiPadrao = "14133"): Citacao[] {
  const grupos = new Map<string, Omit<Citacao, "status" | "motivo">[]>();
  for (const c of extrairCitacoes(texto, leiPadrao)) {
    const chave = `${c.lei}|${c.art}-${c.artFim ?? ""}|${c.par ?? ""}|${c.inciso ?? ""}`;
    grupos.set(chave, [...(grupos.get(chave) || []), c]);
  }
  const out: Citacao[] = [];
  for (const lista of grupos.values()) {
    const c = { ...lista[0], ocorrencias: [...new Set(lista.flatMap((x) => x.ocorrencias || []))] };
    const lei = idx.get(c.lei);
    let a = lei?.get(c.art);
    if (lei && c.artFim) {
      // intervalo: junta o texto dos artigos que existem nele
      const partes = Array.from({ length: c.artFim - c.art + 1 }, (_, k) => lei.get(c.art + k)).filter(Boolean) as Artigo[];
      a = partes.length ? { texto: "", norm: partes.map((x) => x.norm).join(" "), pars: new Map(), incisos: new Set() } : undefined;
    }
    const res = (status: Status, motivo: string, trecho = c.trecho) =>
      out.push({ ...c, trecho, status, motivo, link: status === "nao_confere" ? undefined : linkCitacao(c) });
    if (!lei) { res("sem_trecho", "o texto oficial desta norma não pôde ser obtido agora para conferir o artigo"); continue; }
    if (!a) { res("nao_confere", `o Art. ${c.art} não existe nessa norma`); continue; }
    if (c.par && !a.pars.has(c.par)) { res("nao_confere", `o Art. ${c.art} não tem ${c.par === "unico" ? "parágrafo único" : `§ ${c.par}º`}`); continue; }
    if (c.inciso && !a.incisos.has(c.inciso)) { res("nao_confere", `o Art. ${c.art} não tem inciso ${c.inciso}`); continue; }
    // Qualquer trecho que não esteja no artigo reprova: é o sinal de artigo trocado.
    const comTrecho = lista.filter((x) => x.trecho);
    const falho = comTrecho.find((x) => !contem(a.norm, x.trecho!));
    if (falho) { res("nao_confere", `o trecho citado não está no Art. ${c.art}`, falho.trecho); continue; }
    if (comTrecho.length) { res("conferida", "trecho confere com o texto oficial", comTrecho[0].trecho); continue; }
    res("sem_trecho", "dispositivo existe; a resposta não transcreveu o trecho");
  }
  // Menção solta ("o Art. 67") já coberta por citação conferida do mesmo artigo
  // ("Art. 67, IV" com trecho) não precisa de aviso.
  return out.filter((c) => !(c.status === "sem_trecho" && !c.par && !c.inciso &&
    out.some((o) => o !== c && o.lei === c.lei && o.art === c.art && o.status === "conferida")));
}

// Acórdão/súmula só vale se o número aparecer no contexto recuperado (base ou busca ao vivo).
export type Juris = {
  rotulo: string; ok: boolean; motivo?: string; ocorrencias?: string[]; link?: string;
  pertinencia?: Veredito | "nao_revisado"; pertinenciaMotivo?: string; removidoPor?: "pertinencia";
};

// Súmulas do TCU: conferidas na API pública de jurisprudência do TCU (número, vigência e
// enunciado oficial). STF e STJ bloqueiam consulta automática: súmula deles só vale se
// estiver nas fontes consultadas.
type InfoSumula = { existe: boolean; vigente?: boolean; enunciado?: string; key?: string } | "indisponivel";
const sumulasTCU = new Map<number, InfoSumula>();
const RE_SUMULA = /S[úu]mula\s*(?:Vinculante\s*)?(?:do\s+|da\s+)?(TCU|STF|STJ|TST|TSE)?\s*(?:n[º°o.]?\s*)?(\d{1,4})(?:\s*,?\s*(?:do|da)\s+(TCU|STF|STJ|TST|TSE|Tribunal de Contas da Uni[ãa]o|Supremo|Superior Tribunal))?/gi;
const tribunal = (m: RegExpMatchArray) => {
  const t = (m[1] || m[3] || "").toUpperCase();
  return /^TCU|TRIBUNAL DE CONTAS/.test(t) ? "TCU" : t ? "OUTRO" : (/vinculante/i.test(m[0]) ? "OUTRO" : "");
};

async function buscarSumulaTCU(num: number, tentativa = 0): Promise<InfoSumula> {
  // o TCU às vezes demora na primeira consulta: uma segunda tentativa antes de desistir
  const r1 = await buscarSumulaTCU1(num);
  return r1 === "indisponivel" && tentativa === 0 ? buscarSumulaTCU1(num) : r1;
}
async function buscarSumulaTCU1(num: number): Promise<InfoSumula> {
  try {
    const r = await fetch(`https://pesquisa.apps.tcu.gov.br/rest/publico/base/sumula/documentosResumidos?termo=NUMERO%3A${num}&quantidade=3&inicio=0`,
      { headers: { "User-Agent": "Mozilla/5.0 Intelicite/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return "indisponivel";
    const d = await r.json();
    const doc = (d.documentos || []).find((x: { NUMERO?: string }) => String(x.NUMERO || "").replace(/<[^>]+>/g, "").trim() === String(num));
    if (!doc) return { existe: false };
    const limpa = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { existe: true, vigente: String(doc.VIGENTE) !== "false", enunciado: limpa(doc.ENUNCIADO || doc.CABECALHO), key: doc.KEY };
  } catch { return "indisponivel"; }
}

export async function prepararSumulas(texto: string): Promise<void> {
  const nums = new Set<number>();
  for (const m of texto.matchAll(RE_SUMULA)) if (tribunal(m) !== "OUTRO") nums.add(Number(m[2]));
  await Promise.all([...nums].filter((n) => !sumulasTCU.has(n) || sumulasTCU.get(n) === "indisponivel").slice(0, 8)
    .map(async (n) => sumulasTCU.set(n, await buscarSumulaTCU(n))));
}

// Acórdãos do TCU: espelho próprio (tabela tcu_acordaos, sincronizada da API de dados
// abertos do TCU, que cobre de ago/2023 em diante). Acórdão de TCE/TCM/tribunal judicial
// não é conferido aqui (fica a regra das fontes consultadas).
const RE_ACORDAO = /Ac[óo]rd[ãa]o(?:\s+de\s+Rela[çc][ãa]o)?\s*(?:n[º°o.]?\s*)?(\d[\d.]{0,6})\/(\d{4})((?:\s*[-–—,]?\s*(?:TCU|do\s+TCU|da\s+|do\s+)?\s*[-–—]?\s*(?:Plen[áa]rio|1[ªa]\s*C[âa]mara|Primeira\s+C[âa]mara|2[ªa]\s*C[âa]mara|Segunda\s+C[âa]mara|TCE[-\s/]?[A-Z]{2}|TCM[-\s/]?[A-Z]{0,2}|TCU|STJ|STF|TRF\d?))*)/gi;
const acordaosTCU = new Map<string, { colegiado: string; url: string | null }[] | null>();         // "numero/ano" -> colegiados; null = não está no espelho
let coberturaTCU: { anoMin: number; completo: boolean } | null = null;
const colegiadoDe = (s: string) => /plen/i.test(s) ? "Plenário" : /(1[ªa]|primeira)/i.test(s) ? "Primeira Câmara" : /(2[ªa]|segunda)/i.test(s) ? "Segunda Câmara" : "";
const outroTribunal = (s: string) => /TCE|TCM|STJ|STF|TRF/i.test(s);

// deno-lint-ignore no-explicit-any
export async function prepararAcordaos(texto: string, supabase?: any): Promise<void> {
  if (!supabase) return;
  const pedidos = [...texto.matchAll(RE_ACORDAO)].filter((m) => !outroTribunal(m[3] || ""))
    .map((m) => ({ numero: Number(m[1].replace(/\./g, "")), ano: Number(m[2]) }))
    .filter((p) => !acordaosTCU.has(`${p.numero}/${p.ano}`));
  if (!pedidos.length) return;
  if (!coberturaTCU) {
    const { data: min } = await supabase.from("tcu_acordaos").select("ano").order("data_sessao", { ascending: true }).limit(1).maybeSingle();
    const { data: cur } = await supabase.from("internal_config").select("value").eq("key", "tcu_acordaos_cursor").maybeSingle();
    coberturaTCU = { anoMin: min?.ano ?? 9999, completo: !!(cur?.value && JSON.parse(cur.value).concluido) };
  }
  const { data } = await supabase.from("tcu_acordaos").select("numero, ano, colegiado, url")
    .in("numero", [...new Set(pedidos.map((p) => p.numero))]).in("ano", [...new Set(pedidos.map((p) => p.ano))]);
  for (const p of pedidos) {
    const achados = (data || []).filter((d: { numero: number; ano: number }) => d.numero === p.numero && d.ano === p.ano)
      .map((d: { colegiado: string; url: string | null }) => ({ colegiado: d.colegiado, url: d.url }));
    acordaosTCU.set(`${p.numero}/${p.ano}`, achados.length ? achados : null);
  }
}

export function conferirJurisprudencia(texto: string, contexto: string): Juris[] {
  const ctx = normalizar(contexto).replace(/ /g, "");
  const noContexto = (num: string) => ctx.includes(normalizar(num).replace(/ /g, ""));
  const out = new Map<string, Juris>();
  const add = (rotulo: string, ocorr: string, ok: boolean, motivo?: string, link?: string) => {
    const j = out.get(rotulo) || { rotulo, ok, motivo, ocorrencias: [], link: ok ? link : undefined };
    if (!ok && j.ok) { j.ok = false; j.motivo = motivo; }
    j.ocorrencias!.push(ocorr);
    out.set(rotulo, j);
  };
  for (const m of texto.matchAll(RE_ACORDAO)) {
    const numero = Number(m[1].replace(/\./g, "")), ano = Number(m[2]);
    const rotulo = m[0].replace(/\s+/g, " ").trim().replace(/[\s,–—-]+$/, "");
    const cauda = m[3] || "";
    const fontes = noContexto(`${numero}/${ano}`);
    if (outroTribunal(cauda)) { add(rotulo, m[0], fontes, "acórdão de outro tribunal fora das fontes consultadas"); continue; }
    const col = colegiadoDe(cauda);
    const espelho = acordaosTCU.get(`${numero}/${ano}`);
    // Só conclui "não existe" / "colegiado errado" em ano que o espelho cobre por completo.
    const coberto = coberturaTCU && coberturaTCU.completo && ano > coberturaTCU.anoMin;
    if (espelho) {
      const cols = espelho.map((e) => e.colegiado);
      const certo = espelho.find((e) => !col || e.colegiado === col) ?? espelho[0];
      if (col && !cols.includes(col) && coberto) add(rotulo, m[0], false, `o Acórdão ${numero}/${ano} do TCU é do(a) ${cols.join(" / ")}, não do(a) ${col}`);
      else add(rotulo, m[0], true, undefined, certo.url ?? undefined);
      continue;
    }
    if (espelho === null && coberto && !fontes) { add(rotulo, m[0], false, `não existe Acórdão ${numero}/${ano} no TCU`); continue; }
    add(rotulo, m[0], fontes, "número não localizado nas fontes consultadas nem no espelho do TCU");
  }
  for (const m of texto.matchAll(RE_SUMULA)) {
    const num = Number(m[2]);
    const rotulo = m[0].replace(/\s+/g, " ").trim();
    const info = tribunal(m) === "OUTRO" ? undefined : sumulasTCU.get(num);
    if (!info || info === "indisponivel") {
      add(rotulo, m[0], noContexto(String(num)), tribunal(m) === "OUTRO"
        ? "súmula de outro tribunal fora das fontes consultadas (STF/STJ bloqueiam a consulta automática)"
        : "não foi possível consultar o TCU agora e a súmula não está nas fontes");
      continue;
    }
    if (!info.existe) { add(rotulo, m[0], false, `não existe Súmula TCU nº ${num}`); continue; }
    if (info.vigente === false) { add(rotulo, m[0], false, `a Súmula TCU nº ${num} não está vigente`); continue; }
    // texto entre aspas logo depois da súmula tem de ser o enunciado oficial
    const trecho = trechoProximo(texto, m.index! + m[0].length);
    if (trecho && info.enunciado && !contem(normalizar(info.enunciado), trecho)) {
      add(rotulo, m[0], false, `o texto citado não é o enunciado da Súmula TCU nº ${num}`); continue;
    }
    add(rotulo, m[0], true, undefined, info.key ? `https://pesquisa.apps.tcu.gov.br/documento/sumula/*/KEY%253A${info.key}/%2520` : undefined);
  }
  return [...out.values()];
}

// ---------- normas (lei, LC, decreto, decreto-lei) ----------
// Lista de normas REAIS: as que estão indexadas e as que as próprias íntegras oficiais
// citam com número (o Planalto referencia centenas de leis e decretos). Norma citada
// pela IA que não está nessa lista nem nas fontes da consulta não é mostrada como fato.
// ok=false: removida do texto. aviso=true: fica no texto, marcada como não conferida.
// anotacao: fica no texto com a marca (ex.: "[revogada]").
export type Norma = { rotulo: string; ok: boolean; motivo: string; ocorrencias: string[]; aviso?: boolean; anotacao?: string; link?: string };

// ---------- atos infralegais de compras (IN, portaria, ON, resolução) ----------
// Catálogo oficial do Portal de Compras (tabela atos_compras, com vigência). Escopo: atos
// dos órgãos de compras do governo federal. Ato desse escopo que não está no catálogo é
// removido; revogado fica marcado; ato de outro órgão fica como "não conferido".
type Ato = { tipo: string; numero: number; ano: number | null; titulo: string; vigente: boolean; knowledge_id: string | null; url?: string | null };
let atos: Ato[] | null = null;
const RE_ATO = /(\b[Ii]nstru[çc][ãa]o\s+[Nn]ormativa|\bIN\b|\b[Pp]ortaria|\b[Oo]rienta[çc][ãa]o\s+[Nn]ormativa|\bON\b|\b[Rr]esolu[çc][ãa]o)(?:\s+[Cc]onjunta)?\s*((?:SEGES|SLTI|SGD|MGI|MPDG|MARE|MP|ME|AGU|CGU|RFB|INSS|ANVISA|ANP|ANEEL|BACEN|CVM|[A-Z]{2,8})(?:\s*\/\s*(?:SEGES|SLTI|MGI|MPDG|MARE|MP|ME|GM|[A-Z]{2,6}))*)?\s*n?[º°o.]?\s*(\d{1,2}\.\d{3}|\d{1,5})(?:\s*\/\s*(\d{4})\b|,?\s+de\s+\d{1,2}[º°o]?\s+de\s+[a-zç]+\s+de\s+(\d{4}))?/g;
const ORGAOS_COMPRAS = /^(SEGES|SLTI|SGD|MGI|MPDG|MARE|MP|ME)(\/|$)/;
const tipoAto = (t: string) => /^(IN|instru)/i.test(t) ? "IN" : /^portaria/i.test(t) ? "Portaria" : /^(ON|orienta)/i.test(t) ? "ON" : "Resolução";
const chaveAto = (tipo: string, numero: number, ano?: number | null) => `ato|${tipo}|${numero}|${ano ?? ""}`;

// testes fora do servidor: carrega o catálogo e o texto dos atos sem passar pelo banco
export function definirAtos(lista: Ato[], idx?: Indice, textos?: Record<string, string>) {
  atos = lista;
  if (idx && textos) for (const a of lista) if (a.knowledge_id && textos[a.knowledge_id] && a.vigente) idx.set(chaveAto(a.tipo, a.numero, a.ano), indexarLei(textos[a.knowledge_id]));
}

function conferirAtos(texto: string): Norma[] {
  const out = new Map<string, Norma>();
  for (const m of texto.matchAll(RE_ATO)) {
    const tipo = tipoAto(m[1]), numero = Number(m[3].replace(/\./g, "")), ano = m[4] || m[5] ? Number(m[4] || m[5]) : undefined;
    const orgao = (m[2] || "").replace(/\s+/g, "");
    const rotulo = m[0].replace(/\s+/g, " ").trim();
    const doCatalogo = (atos || []).filter((a) => a.tipo === tipo && a.numero === numero && (!ano || a.ano === ano));
    let n: Norma;
    const oficial = (doCatalogo.find((a) => a.vigente) ?? doCatalogo[0])?.url ?? undefined;
    if (doCatalogo.some((a) => a.vigente)) n = { rotulo, ok: true, motivo: "ato vigente no catálogo oficial do Portal de Compras", ocorrencias: [], link: oficial };
    else if (doCatalogo.length) n = { rotulo, ok: true, motivo: "ato REVOGADO segundo o Portal de Compras", ocorrencias: [], anotacao: "[revogada]", link: oficial };
    else if (atos && ORGAOS_COMPRAS.test(orgao)) n = { rotulo, ok: false, motivo: "não existe no catálogo oficial do Portal de Compras", ocorrencias: [] };
    else n = { rotulo, ok: true, aviso: true, motivo: orgao ? `ato de outro órgão (${orgao}): não conferido` : "órgão não informado: não conferido", ocorrencias: [] };
    const atual = out.get(rotulo) || n;
    atual.ocorrencias.push(m[0].trim());
    out.set(rotulo, atual);
  }
  return [...out.values()];
}
const RE_NORMA = /\b(Lei\s+Complementar|LC|Decreto-Lei|Decreto|Lei)(?:\s+Federal)?\s*(?:n[º°o.]?\s*)?(\d{1,2}\.\d{3}|\d{2,5})(?:\s*\/\s*(\d{4}|\d{2})\b|,?\s+de\s+\d{1,2}[º°o]?\s+de\s+[a-zç]+\s+de\s+(\d{4}))?/gi;
function chaveNorma(tipo: string, num: string) {
  const t = /^(lei\s+complementar|lc)$/i.test(tipo) ? "lc" : /^decreto-lei$/i.test(tipo) ? "dl" : /^decreto$/i.test(tipo) ? "dec" : "lei";
  return `${t}|${Number(num.replace(/\./g, ""))}`;
}
function anoCompleto(a?: string) { return !a ? undefined : a.length === 2 ? (Number(a) > 30 ? 1900 : 2000) + Number(a) : Number(a); }
export function catalogoNormas(textos: string[]): Map<string, Set<number>> {
  const cat = new Map<string, Set<number>>();
  for (const t of textos) {
    for (const m of t.replace(/\s+/g, " ").matchAll(RE_NORMA)) {
      const k = chaveNorma(m[1], m[2]);
      const ano = anoCompleto(m[3] || m[4]);
      const anos = cat.get(k) || new Set<number>();
      if (ano) anos.add(ano);
      cat.set(k, anos);
    }
  }
  return cat;
}
let catalogo: Map<string, Set<number>> | null = null;
let catalogoNucleo: Map<string, Set<number>> | null = null;
export function conferirNormas(texto: string, contexto = ""): Norma[] {
  return [...conferirLeis(texto, contexto), ...conferirAtos(texto)];
}
function conferirLeis(texto: string, contexto = ""): Norma[] {
  const cat = catalogo || new Map();
  const doContexto = catalogoNormas([contexto]);
  const out = new Map<string, Norma>();
  for (const m of texto.matchAll(RE_NORMA)) {
    const num = Number(m[2].replace(/\./g, ""));
    if (/^(lei|decreto)$/i.test(m[1]) && num < 100) continue;          // "lei 8" solto não é citação de norma
    const k = chaveNorma(m[1], m[2]);
    const ano = anoCompleto(m[3] || m[4]);
    const conhecida = cat.get(k) || doContexto.get(k);
    const noPlanalto = planalto.get(`${k}|${ano ?? ""}`) ?? planalto.get(`${k}|`);
    let ok = !!conhecida, motivo = conhecida ? "norma localizada"
      : noPlanalto === "inexistente" ? `não existe no Planalto${ano ? ` com esse número e ano` : ""}`
      : noPlanalto === "indisponivel" ? "não foi possível confirmar no Planalto agora"
      : "número não localizado nas fontes oficiais";
    if (conhecida && ano && conhecida.size && !conhecida.has(ano)) { ok = false; motivo = `o ano não confere (${[...conhecida].join(", ")})`; }
    const rotulo = m[0].replace(/\s+/g, " ").trim();
    const n = out.get(rotulo) || { rotulo, ok, motivo, ocorrencias: [], link: ok ? linkNorma(FIXAS[k] ?? k) : undefined };
    n.ocorrencias.push(m[0].trim());
    out.set(rotulo, n);
  }
  return [...out.values()];
}

// ---------- Planalto ao vivo ----------
// As 8 normas indexadas têm chave própria; a chave genérica delas aponta para a mesma.
const FIXAS: Record<string, string> = {
  "lei|14133": "14133", "lei|8666": "8666", "lei|10520": "10520", "lc|123": "lc123",
  "dec|10024": "d10024", "dec|11462": "d11462", "dec|11246": "d11246",
  "ato|IN|58|2022": "in58", "ato|IN|65|2021": "in65",
};
function nomeDaChave(k: string): string {
  if (k === "cf") return "Constituição Federal";
  if (k.startsWith("ato|")) { const [, t, n, a] = k.split("|"); return `${t} ${n}${a ? `/${a}` : ""}`; }
  const [t, n] = k.split("|");
  return t && n ? nomeNorma(t as TipoNorma, Number(n), anosDoCatalogo(k)[0]) : k;
}
function anosDoCatalogo(k: string): number[] { return [...(catalogo?.get(k) ?? [])]; }
// "chave|ano" -> resultado da consulta ao Planalto nesta instância
const planalto = new Map<string, "encontrada" | "inexistente" | "indisponivel">();

// Ano provável de uma norma citada sem ano, pela vizinhança numérica das normas já conhecidas
// do mesmo tipo (a numeração de leis e decretos cresce com o tempo).
function anosProvaveis(k: string): (number | undefined)[] {
  const conhecidos = anosDoCatalogo(k);
  if (conhecidos.length) return conhecidos;
  const [t, n] = k.split("|"); const num = Number(n);
  const pares = [...(catalogo ?? new Map()).entries()]
    .filter(([c, anos]) => c.startsWith(t + "|") && anos.size)
    .map(([c, anos]) => [Number(c.split("|")[1]), Math.min(...anos)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const abaixo = pares.filter((p) => p[0] <= num).pop(), acima = pares.find((p) => p[0] >= num);
  let g: number | undefined;
  if (abaixo && acima && acima[0] !== abaixo[0]) g = Math.round(abaixo[1] + (acima[1] - abaixo[1]) * (num - abaixo[0]) / (acima[0] - abaixo[0]));
  else g = (abaixo ?? acima)?.[1];
  return g ? [g, g - 1, g + 1, g - 2, g + 2, undefined] : [undefined];
}

// Antes de conferir: toda norma citada que não está na base é buscada no Planalto. Encontrada,
// seus artigos entram no índice (o artigo citado passa a ser conferido) e a íntegra é gravada
// na base; inexistente, fica registrada para ser removida do texto.
// deno-lint-ignore no-explicit-any
export async function prepararComPlanalto(texto: string, idx: Indice, supabase?: any, limite = 6): Promise<void> {
  const sumulas = Promise.all([prepararSumulas(texto), prepararAcordaos(texto, supabase)]).catch(() => {});   // TCU, em paralelo
  const pedidos = new Map<string, { tipo: TipoNorma; num: number; ano?: number }>();
  for (const m of texto.replace(/\s+/g, " ").matchAll(RE_NORMA)) {
    const num = Number(m[2].replace(/\./g, ""));
    if (/^(lei|decreto)$/i.test(m[1]) && num < 100) continue;
    const k = chaveNorma(m[1], m[2]);
    if (FIXAS[k]) continue;
    const ano = anoCompleto(m[3] || m[4]);
    const anosConhecidos = anosDoCatalogo(k);
    const precisaTexto = !idx.has(k);                               // para conferir artigo desta norma
    const precisaExistencia = !anosConhecidos.length || (ano !== undefined && !anosConhecidos.includes(ano));
    if (!precisaTexto && !precisaExistencia) continue;
    if (planalto.has(`${k}|${ano ?? ""}`)) continue;
    pedidos.set(`${k}|${ano ?? ""}`, { tipo: k.split("|")[0] as TipoNorma, num, ano });
  }
  // Constituição citada: íntegra do Planalto, só a parte permanente (o ADCT repete a numeração
  // de artigos e misturaria "Art. 1º" da CF com "Art. 1º" do ADCT).
  // A CF tem 1,8 MB e o Planalto leva ~18 s: na primeira vez fica gravada na base e daí em
  // diante carrega do banco (carregarIndice).
  const cf = !idx.has("cf") && new RegExp(RE_CF.source, "i").test(texto)
    ? buscarConstituicao().then(async (t) => {
      if (!t) return;
      idx.set("cf", indexarLei(t));
      urlsNorma.set("cf", URL_CF);
      if (supabase) {
        const { data: existe } = await supabase.from("legal_knowledge").select("id").eq("reference", "Constituição Federal").maybeSingle();
        if (!existe) await supabase.from("legal_knowledge").insert({ title: "Constituição Federal (íntegra do Planalto, importada na conferência automática)", source_type: "lei", reference: "Constituição Federal", year: 1988, content: t, active: true, url: URL_CF });
      }
    }).catch(() => {})
    : null;
  if (cf) await cf;
  await Promise.all([...pedidos.entries()].slice(0, limite).map(async ([chave, p]) => {
    const k = `${p.tipo}|${p.num}`;
    const r = await buscarNoPlanalto(p.tipo, p.num, p.ano ? [p.ano] : anosProvaveis(k)).catch(() => ({ situacao: "indisponivel" as const }));
    planalto.set(chave, r.situacao);
    if (r.situacao === "indisponivel") {
      // Planalto fora do ar: o Senado confirma se a norma existe (sem texto: artigo fica ⚠️)
      const s = await confirmarNoSenado(p.tipo, p.num, p.ano);
      if (s === "existe") {
        const anos = catalogo?.get(k) ?? new Set<number>();
        if (p.ano) anos.add(p.ano);
        catalogo?.set(k, anos);
        planalto.set(chave, "encontrada");
      } else if (s === "inexistente") planalto.set(chave, "inexistente");
      return;
    }
    if (r.situacao !== "encontrada") return;
    idx.set(k, indexarLei(r.texto));
    urlsNorma.set(k, r.url);
    const anos = catalogo?.get(k) ?? new Set<number>();
    if (r.ano) anos.add(r.ano);
    catalogo?.set(k, anos);
    if (supabase) await gravarNaBase(supabase, p.tipo, p.num, r.ano, r.texto, r.url).catch(() => {});
  }));
  await sumulas;
}

// Pré-carga: normas que as íntegras da base citam e que ainda não têm íntegra na base
// (e a Constituição). A rotina noturna traz essas do Planalto aos poucos.
export function normasParaAquecer(idx: Indice): { tipo: TipoNorma; num: number; ano?: number }[] {
  const out: { tipo: TipoNorma; num: number; ano?: number }[] = [];
  for (const [k, anos] of catalogoNucleo ?? new Map<string, Set<number>>()) {
    if (FIXAS[k] || idx.has(k) || !/^(lei|lc|dec|dl)\|/.test(k)) continue;
    const [t, n] = k.split("|");
    out.push({ tipo: t as TipoNorma, num: Number(n), ano: [...anos].sort((a, b) => b - a)[0] });
  }
  return out.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
}

// ---------- remoção do que não confere ----------
export const REMOVIDO_ART = "[citação removida: dispositivo não confere com a lei]";
export const REMOVIDO_NORMA = "[norma removida: não localizada nas fontes oficiais]";
export const REMOVIDO_JURIS = "[jurisprudência removida: número não localizado nas fontes]";
export const REMOVIDO_PERTINENCIA = "[fundamento removido: o texto oficial citado não sustenta esta afirmação]";
// Tira do texto toda citação reprovada: o usuário nunca vê artigo ou norma inexistente como fato.
export function sanear(texto: string, cits: Citacao[], juris: Juris[] = [], normas: Norma[] = []): string {
  // Link escrito pela IA sai do texto: o único link que vale é o oficial montado pelo código.
  let t = inverterForma(texto)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/\s*[—–-]?\s*<?https?:\/\/[^\s)>\]]+>?/g, "");
  const trocas: [string, string][] = [
    ...cits.filter((c) => c.status === "nao_confere").flatMap((c) => (c.ocorrencias || []).map((o) => [o, c.removidoPor ? REMOVIDO_PERTINENCIA : REMOVIDO_ART] as [string, string])),
    ...normas.filter((n) => !n.ok).flatMap((n) => n.ocorrencias.map((o) => [o, REMOVIDO_NORMA] as [string, string])),
    ...juris.filter((j) => !j.ok).flatMap((j) => (j.ocorrencias || []).map((o) => [o, j.removidoPor ? REMOVIDO_PERTINENCIA : REMOVIDO_JURIS] as [string, string])),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [de, para] of trocas) if (de) t = t.split(de).join(para);
  // ato revogado: fica no texto, com a marca logo depois (uma vez só)
  for (const n of normas.filter((x) => x.ok && x.anotacao)) {
    for (const o of n.ocorrencias) t = t.split(o).join(`${o} ${n.anotacao}`).split(`${o} ${n.anotacao} ${n.anotacao}`).join(`${o} ${n.anotacao}`);
  }
  return t;
}

// Rodapé em markdown com o resultado da conferência.
// Fontes oficiais, com link montado pelo código. Cada item diz o que foi conferido.
export function fontesOficiais(cits: Citacao[], juris: Juris[] = [], normas: Norma[] = []): { rotulo: string; url?: string; nota: string }[] {
  const out: { rotulo: string; url?: string; nota: string }[] = [];
  for (const c of cits.filter((x) => x.status !== "nao_confere")) {
    out.push({ rotulo: c.rotulo, url: c.link, nota: (c.status === "conferida" ? "trecho conferido no texto oficial" : "dispositivo existe; trecho não transcrito") + notaPertinencia(c) });
  }
  for (const j of juris.filter((x) => x.ok)) out.push({ rotulo: j.rotulo, url: j.link, nota: (/s[úu]mula/i.test(j.rotulo) ? "súmula existente e vigente" : "acórdão existente") + notaPertinencia(j) });
  // norma citada sem artigo: só entra se nenhuma citação de artigo dela já trouxe o link
  const bases = new Set(out.map((o) => (o.url || "").split("#")[0]).filter(Boolean));
  for (const n of normas.filter((x) => x.ok && !x.aviso)) {
    if (n.link && bases.has(n.link)) continue;
    out.push({ rotulo: n.rotulo, url: n.link, nota: n.anotacao ? "ato revogado" : "norma existente" });
    if (n.link) bases.add(n.link);
  }
  return out;
}

const notaPertinencia = (x: { pertinencia?: string; pertinenciaMotivo?: string }) =>
  x.pertinencia === "sustenta" ? "; sustenta a afirmação" : x.pertinencia === "parcial" ? `; ⚠️ sustenta só em parte: ${x.pertinenciaMotivo}` : "";

export function rodapeVerificacao(cits: Citacao[], juris: Juris[] = [], normas: Norma[] = []): string {
  const nNao = normas.filter((n) => !n.ok);
  const nRev = normas.filter((n) => n.ok && n.anotacao);
  const nAviso = normas.filter((n) => n.ok && n.aviso);
  const fontes = fontesOficiais(cits, juris, normas);
  const nao = cits.filter((c) => c.status === "nao_confere" && !c.removidoPor);
  const jNao = juris.filter((j) => !j.ok && !j.removidoPor);
  const semSustentar = [...cits.filter((c) => c.removidoPor), ...juris.filter((j) => j.removidoPor)];
  if (!fontes.length && !nao.length && !jNao.length && !nNao.length && !nAviso.length && !semSustentar.length) return "";
  const linhas = ["", "---", "**📌 Fontes oficiais (conferidas automaticamente)**"];
  if (fontes.length) linhas.push(fontes.map((f) => `- ${f.url ? `[${f.rotulo}](${f.url})` : f.rotulo} · ${f.nota}`).join("\n"));
  if (nRev.length) linhas.push(`⚠️ Ato revogado (marcado no texto): ${nRev.map((n) => n.rotulo).join(" · ")}`);
  if (nAviso.length) linhas.push(`⚠️ Não conferido automaticamente: ${nAviso.map((n) => `${n.rotulo} (${n.motivo})`).join(" · ")}`);
  if (nao.length) linhas.push(`❌ Removido do texto por não conferir com a lei: ${nao.map((c) => `${c.rotulo} (${c.motivo})`).join(" · ")}`);
  if (nNao.length) linhas.push(`❌ Norma removida do texto, não localizada nas fontes oficiais: ${nNao.map((n) => `${n.rotulo} (${n.motivo})`).join(" · ")}`);
  if (jNao.length) linhas.push(`❌ Jurisprudência removida do texto: ${jNao.map((j) => `${j.rotulo} (${j.motivo || "número não localizado nas fontes consultadas"})`).join(" · ")}`);
  if (semSustentar.length) linhas.push(`❌ Fundamento removido: existe, mas o texto oficial não sustenta o que foi afirmado: ${semSustentar.map((x) => `${x.rotulo} (${x.pertinenciaMotivo})`).join(" · ")}`);
  return linhas.join("\n\n");
}

// Pipeline único das respostas em texto: confere, deixa a IA reescrever UMA vez com a
// lista do que falhou e, no fim, remove do texto o que ainda não conferir.
export async function respostaSegura(
  texto: string, idx: Indice, fontes: string,
  reescrever?: (falhas: string[], anterior: string) => Promise<string>,
  // deno-lint-ignore no-explicit-any
  supabase?: any,
  // revisor de pertinência (padrão: a 2ª chamada à IA; nos testes, uma função simulada)
  revisar: ((itens: ItemRevisao[]) => Promise<Revisao[] | null>) | null = revisarPertinencia,
): Promise<{ texto: string; citacoes: Citacao[]; jurisprudencia: Juris[]; normas: Norma[]; rodape: string; reescrita: boolean }> {
  const avaliar = async (t: string) => {
    await prepararComPlanalto(t, idx, supabase).catch(() => {});   // norma fora da base: Planalto ao vivo
    const citacoes = conferir(t, idx), jurisprudencia = conferirJurisprudencia(t, fontes), normas = conferirNormas(t, fontes);
    const falhas = [
      ...citacoes.filter((c) => c.status === "nao_confere").map((c) => `${c.rotulo}: ${c.motivo}`),
      ...normas.filter((n) => !n.ok).map((n) => `${n.rotulo}: ${n.motivo}`),
      ...jurisprudencia.filter((j) => !j.ok).map((j) => `${j.rotulo}: ${j.motivo || "número não consta nas fontes fornecidas"}`),
    ];
    return { citacoes, jurisprudencia, normas, falhas };
  };
  // Pertinência: o texto oficial de cada dispositivo citado sustenta a afirmação feita com ele?
  const revisarTexto = async (t: string, r0: Awaited<ReturnType<typeof avaliar>>) => {
    if (!revisar) return { naoSustenta: [] as string[] };
    const itens = itensParaRevisao(t, r0.citacoes, r0.jurisprudencia, idx);
    const rev = itens.length ? await revisar(itens) : [];
    if (rev === null) { revisaoIndisponivel = true; return { naoSustenta: [] as string[] }; }
    const porId = new Map(rev.map((x) => [x.id, x]));
    const naoSustenta: string[] = [];
    for (const it of itens) {
      const v = porId.get(it.id);
      const alvo = it.ref;
      alvo.pertinencia = v?.veredito ?? "nao_revisado";
      alvo.pertinenciaMotivo = v?.motivo;
      if (v?.veredito === "nao_sustenta") naoSustenta.push(`${it.citacao}: o texto oficial não sustenta a afirmação "${it.afirmacao.slice(0, 160)}" (${v.motivo})`);
    }
    return { naoSustenta };
  };
  let revisaoIndisponivel = false;

  let r = await avaliar(texto);
  let p = await revisarTexto(texto, r);
  let reescrita = false;
  if ((r.falhas.length || p.naoSustenta.length) && reescrever) {
    try {
      const novo = await reescrever([...r.falhas, ...p.naoSustenta], texto);
      if (novo?.trim()) { texto = novo; r = await avaliar(texto); p = await revisarTexto(texto, r); reescrita = true; }
    } catch { /* fica com a primeira versão, saneada abaixo */ }
  }
  // O que ainda não é sustentado pelo texto oficial sai do texto, como citação reprovada.
  for (const c of r.citacoes) if (c.pertinencia === "nao_sustenta") { c.status = "nao_confere"; c.removidoPor = "pertinencia"; c.motivo = `o texto oficial não sustenta a afirmação: ${c.pertinenciaMotivo}`; }
  for (const j of r.jurisprudencia) if (j.pertinencia === "nao_sustenta") { j.ok = false; j.removidoPor = "pertinencia"; j.motivo = `o enunciado não sustenta a afirmação: ${j.pertinenciaMotivo}`; }
  const limpo = sanear(texto, r.citacoes, r.jurisprudencia, r.normas);
  let rodape = rodapeVerificacao(r.citacoes, r.jurisprudencia, r.normas);
  if (revisaoIndisponivel && rodape) rodape += "\n\n⚠️ A revisão de pertinência (se o texto oficial sustenta cada afirmação) ficou indisponível nesta resposta.";
  return { texto: limpo, citacoes: r.citacoes, jurisprudencia: r.jurisprudencia, normas: r.normas, rodape, reescrita };
}

// Texto oficial exato do dispositivo citado, para o revisor: o parágrafo, se citado; com
// inciso, o começo do caput (o que dá sentido à lista) + o próprio inciso. Sem isso um
// artigo longo (Art. 75) era cortado antes do inciso e o revisor julgava sem vê-lo.
function textoDispositivo(c: Citacao, idx: Indice): string | undefined {
  const art = idx.get(c.lei)?.get(c.art);
  if (!art) return undefined;
  const base = c.par ? art.pars.get(c.par) : art.texto;
  if (!base) return undefined;
  if (!c.inciso) return base.slice(0, 2500);
  const cabs = [...base.matchAll(/(?:^|[ .;:])([IVXLC]{1,7}) ?[-–] /g)];
  const k = cabs.findIndex((m) => m[1] === c.inciso);
  if (k < 0) return base.slice(0, 2500);
  const ini = cabs[k].index!, fim = k + 1 < cabs.length ? cabs[k + 1].index! : base.length;
  const caput = base.slice(0, Math.min(cabs[0].index!, 600));
  return `${caput} [...] ${base.slice(ini, Math.min(fim, ini + 1800)).trim()}`;
}

// Itens para o revisor: cada citação que existe e cujo texto oficial está na base, com a
// frase da resposta onde ela aparece. Súmula do TCU entra com o enunciado oficial.
type AlvoRevisao = { pertinencia?: Veredito | "nao_revisado"; pertinenciaMotivo?: string };
function itensParaRevisao(texto: string, cits: Citacao[], juris: Juris[], idx: Indice) {
  const t = inverterForma(texto);
  const frase = (oc?: string) => {
    const i = oc ? t.indexOf(oc) : -1;
    if (i < 0) return "";
    const ini = Math.max(0, ...[". ", "\n", "; "].map((s) => t.lastIndexOf(s, i) + s.length).filter((x) => x > 0), i - 400);
    const fimCands = [". ", "\n"].map((s) => t.indexOf(s, i + oc!.length)).filter((x) => x > 0);
    const fim = Math.min(t.length, fimCands.length ? Math.min(...fimCands) + 1 : t.length, i + oc!.length + 500);
    return t.slice(ini, fim).trim();
  };
  const itens: (ItemRevisao & { ref: AlvoRevisao })[] = [];
  for (const c of cits) {
    if (c.status === "nao_confere" || itens.length >= 10) continue;
    const oficial = textoDispositivo(c, idx);
    const afirmacao = frase(c.ocorrencias?.[0]);
    if (!oficial || !afirmacao) continue;
    itens.push({ id: `c${itens.length}`, citacao: c.rotulo, afirmacao, textoOficial: oficial, ref: c });
  }
  for (const j of juris) {
    const num = Number(j.rotulo.match(/\d+/)?.[0]);
    const info = /s[úu]mula/i.test(j.rotulo) ? sumulasTCU.get(num) : undefined;
    const afirmacao = frase(j.ocorrencias?.[0]);
    if (!j.ok || !info || info === "indisponivel" || !info.enunciado || !afirmacao || itens.length >= 10) continue;
    itens.push({ id: `j${itens.length}`, citacao: j.rotulo, afirmacao, textoOficial: info.enunciado, ref: j });
  }
  return itens;
}

// Pertinência nas respostas em JSON (achado do Parecer, risco da análise de edital): cada
// entrada traz a afirmação e as citações já conferidas; tudo vai numa chamada só ao revisor.
// Devolve, por entrada, o pior veredito (nao_sustenta > parcial > sustenta), ou null se o
// revisor ficou indisponível (quem chama marca "não revisado", nunca aprovado).
export async function revisarEntradas(
  entradas: { afirmacao: string; cits: Citacao[] }[], idx: Indice,
  revisar: ((itens: ItemRevisao[]) => Promise<Revisao[] | null>) = revisarPertinencia,
): Promise<({ veredito: Veredito; motivo: string } | undefined)[] | null> {
  const itens: (ItemRevisao & { e: number; c: Citacao })[] = [];
  entradas.forEach((en, e) => {
    for (const c of en.cits) {
      if (c.status === "nao_confere" || !en.afirmacao.trim() || itens.length >= 16) continue;
      const oficial = textoDispositivo(c, idx);
      if (oficial) itens.push({ id: `e${e}c${itens.length}`, citacao: c.rotulo, afirmacao: en.afirmacao.slice(0, 900), textoOficial: oficial, e, c });
    }
  });
  if (!itens.length) return entradas.map(() => undefined);
  const rev = await revisar(itens.map(({ id, citacao, afirmacao, textoOficial }) => ({ id, citacao, afirmacao, textoOficial })));
  if (rev === null) return null;
  const porId = new Map(rev.map((x) => [x.id, x]));
  const ordem: Record<Veredito, number> = { sustenta: 0, parcial: 1, nao_sustenta: 2 };
  const out: ({ veredito: Veredito; motivo: string } | undefined)[] = entradas.map(() => undefined);
  for (const it of itens) {
    const v = porId.get(it.id);
    it.c.pertinencia = v?.veredito ?? "nao_revisado";
    it.c.pertinenciaMotivo = v?.motivo;
    if (v && (!out[it.e] || ordem[v.veredito] > ordem[out[it.e]!.veredito])) out[it.e] = { veredito: v.veredito, motivo: v.motivo };
  }
  return out;
}

// Respostas em JSON (Parecer, análise de edital): remove de cada campo de texto a
// citação/norma/jurisprudência que não confere. Não mexe no que é transcrição do
// documento do usuário ("trecho", "excerpt") nem nos próprios resultados da conferência.
const NAO_SANEAR = new Set(["trecho", "excerpt", "textoLegal", "verificacao", "citacoes", "url"]);
export function sanearProfundo(obj: unknown, idx: Indice, fontes: string, removidas: string[] = []): unknown {
  if (typeof obj === "string") {
    const cits = conferir(obj, idx), juris = conferirJurisprudencia(obj, fontes), normas = conferirNormas(obj, fontes);
    for (const c of cits) if (c.status === "nao_confere") removidas.push(`${c.rotulo} (${c.motivo})`);
    for (const n of normas) if (!n.ok) removidas.push(`${n.rotulo} (${n.motivo})`);
    for (const j of juris) if (!j.ok) removidas.push(`${j.rotulo} (${j.motivo || "número não localizado nas fontes"})`);
    return sanear(obj, cits, juris, normas);
  }
  if (Array.isArray(obj)) return obj.map((x) => sanearProfundo(x, idx, fontes, removidas));
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = NAO_SANEAR.has(k) ? v : sanearProfundo(v, idx, fontes, removidas);
    return out;
  }
  return obj;
}

export const PEDIDO_REESCRITA =(falhas: string[]) =>
  `A conferência automática no texto oficial REPROVOU estas citações:\n- ${falhas.join("\n- ")}\n\nReescreva a resposta COMPLETA corrigindo-as: use só dispositivos e normas presentes na BASE JURÍDICA, com o trecho literal entre aspas, ou retire a citação. Não comente a correção.`;

export const REGRA_TRECHO = `
PROVA DE CADA CITAÇÃO (a plataforma confere automaticamente, e o que não conferir é marcado como inválido para o usuário):
- Toda vez que citar um dispositivo (Art. N, §, inciso), escreva logo depois, entre aspas, um trecho LITERAL de 8 a 30 palavras copiado do texto desse dispositivo na BASE JURÍDICA. Ex.: Art. 63, § 3º — Lei 14.133/2021: "o edital de licitação sempre deverá prever a possibilidade de substituição da vistoria por declaração formal".
- Copie o trecho exatamente como está, sem parafrasear. Se não tiver o texto do dispositivo na base, não cite o número.
- Acórdão ou súmula só se o número aparecer no contexto fornecido.`;
