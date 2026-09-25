// Verificação determinística das citações legais que a IA produz.
//
// A IA pode errar número de artigo mesmo com a base no contexto (já citou o
// "Art. 37, §1º" para vistoria, que é do Art. 63). Por isso nenhuma citação é
// aceita pela palavra da IA: o código localiza o dispositivo na ÍNTEGRA oficial
// indexada (legal_knowledge) e confere se o TRECHO literal que a IA transcreveu
// está mesmo naquele artigo. Número inexistente ou trecho de outro artigo = reprovado.

import { buscarConstituicao, buscarNoPlanalto, gravarNaBase, nomeNorma, type TipoNorma } from "./planalto.ts";

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
}

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
    const pcab = /§ ?(\d{1,2})(?:º|o)?|Parágrafo único/g;
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
  const { data } = await supabase.from("legal_knowledge").select("title, content").eq("active", true);
  const idx: Indice = new Map();
  for (const lei of LEIS) {
    const doc = (data || []).filter((d: { title: string; content: string }) => lei.titulo.test(d.title))
      .sort((a: { content: string }, b: { content: string }) => (b.content?.length || 0) - (a.content?.length || 0))[0];
    if (doc?.content && doc.content.length > 5000) idx.set(lei.chave, indexarLei(doc.content));
  }
  catalogo = catalogoNormas((data || []).map((d: { title: string; content: string }) => `${d.title}\n${d.content || ""}`));
  // Normas que a conferência já trouxe do Planalto em consultas anteriores: artigos indexados.
  for (const d of (data || []) as { title: string; content: string }[]) {
    if (!/íntegra do Planalto/.test(d.title) || !d.content) continue;
    if (/^Constitui[çc][ãa]o Federal/.test(d.title)) { if (!idx.has("cf")) idx.set("cf", indexarLei(d.content)); continue; }
    const m = [...d.title.matchAll(RE_NORMA)][0];
    if (m) { const k = chaveNorma(m[1], m[2]); if (!FIXAS[k] && !idx.has(k)) idx.set(k, indexarLei(d.content)); }
  }
  cache = idx;
  return idx;
}
export function indiceDeTextos(docs: { title: string; content: string }[]): Indice {
  const idx: Indice = new Map();
  for (const lei of LEIS) {
    const doc = docs.filter((d) => lei.titulo.test(d.title)).sort((a, b) => b.content.length - a.content.length)[0];
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
  const iniLinha = texto.lastIndexOf("\n", ini) + 1;
  const antes = texto.slice(Math.max(iniLinha, ini - 80), ini);
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
    const res = (status: Status, motivo: string, trecho = c.trecho) => out.push({ ...c, trecho, status, motivo });
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
export type Juris = { rotulo: string; ok: boolean; ocorrencias?: string[] };
export function conferirJurisprudencia(texto: string, contexto: string): Juris[] {
  const re = /(Ac[óo]rd[ãa]o\s*(?:n[º°o]\s*)?[\d.]{2,6}\/\d{4}|S[úu]mula\s*(?:TCU\s*)?(?:n[º°o]\s*)?\d{1,4})/gi;
  const ctx = normalizar(contexto).replace(/ /g, "");
  const out = new Map<string, Juris>();
  for (const m of texto.matchAll(re)) {
    const num = m[0].match(/[\d.]+(?:\/\d{4})?/)![0].replace(/\./g, "");
    const rotulo = m[0].replace(/\s+/g, " ");
    const j = out.get(rotulo) || { rotulo, ok: ctx.includes(normalizar(num).replace(/ /g, "")), ocorrencias: [] };
    j.ocorrencias!.push(m[0]);
    out.set(rotulo, j);
  }
  return [...out.values()];
}

// ---------- normas (lei, LC, decreto, decreto-lei) ----------
// Lista de normas REAIS: as que estão indexadas e as que as próprias íntegras oficiais
// citam com número (o Planalto referencia centenas de leis e decretos). Norma citada
// pela IA que não está nessa lista nem nas fontes da consulta não é mostrada como fato.
export type Norma = { rotulo: string; ok: boolean; motivo: string; ocorrencias: string[] };
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
export function conferirNormas(texto: string, contexto = ""): Norma[] {
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
    const n = out.get(rotulo) || { rotulo, ok, motivo, ocorrencias: [] };
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
};
function nomeDaChave(k: string): string {
  if (k === "cf") return "Constituição Federal";
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
      if (supabase) {
        const { data: existe } = await supabase.from("legal_knowledge").select("id").eq("reference", "Constituição Federal").maybeSingle();
        if (!existe) await supabase.from("legal_knowledge").insert({ title: "Constituição Federal (íntegra do Planalto, importada na conferência automática)", source_type: "lei", reference: "Constituição Federal", year: 1988, content: t, active: true });
      }
    }).catch(() => {})
    : null;
  if (cf) await cf;
  await Promise.all([...pedidos.entries()].slice(0, limite).map(async ([chave, p]) => {
    const k = `${p.tipo}|${p.num}`;
    const r = await buscarNoPlanalto(p.tipo, p.num, p.ano ? [p.ano] : anosProvaveis(k)).catch(() => ({ situacao: "indisponivel" as const }));
    planalto.set(chave, r.situacao);
    if (r.situacao !== "encontrada") return;
    idx.set(k, indexarLei(r.texto));
    const anos = catalogo?.get(k) ?? new Set<number>();
    if (r.ano) anos.add(r.ano);
    catalogo?.set(k, anos);
    if (supabase) await gravarNaBase(supabase, p.tipo, p.num, r.ano, r.texto).catch(() => {});
  }));
}

// ---------- remoção do que não confere ----------
export const REMOVIDO_ART = "[citação removida: dispositivo não confere com a lei]";
export const REMOVIDO_NORMA = "[norma removida: não localizada nas fontes oficiais]";
export const REMOVIDO_JURIS = "[jurisprudência removida: número não localizado nas fontes]";
// Tira do texto toda citação reprovada: o usuário nunca vê artigo ou norma inexistente como fato.
export function sanear(texto: string, cits: Citacao[], juris: Juris[] = [], normas: Norma[] = []): string {
  let t = inverterForma(texto);
  const trocas: [string, string][] = [
    ...cits.filter((c) => c.status === "nao_confere").flatMap((c) => (c.ocorrencias || []).map((o) => [o, REMOVIDO_ART] as [string, string])),
    ...normas.filter((n) => !n.ok).flatMap((n) => n.ocorrencias.map((o) => [o, REMOVIDO_NORMA] as [string, string])),
    ...juris.filter((j) => !j.ok).flatMap((j) => (j.ocorrencias || []).map((o) => [o, REMOVIDO_JURIS] as [string, string])),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [de, para] of trocas) if (de) t = t.split(de).join(para);
  return t;
}

// Rodapé em markdown com o resultado da conferência.
export function rodapeVerificacao(cits: Citacao[], juris: Juris[] = [], normas: Norma[] = []): string {
  const nNao = normas.filter((n) => !n.ok);
  if (!cits.length && !juris.length && !nNao.length) return "";
  const ok = cits.filter((c) => c.status === "conferida");
  const sem = cits.filter((c) => c.status === "sem_trecho");
  const nao = cits.filter((c) => c.status === "nao_confere");
  const jNao = juris.filter((j) => !j.ok);
  const linhas = ["", "---", "**🔎 Conferência automática no texto oficial indexado**"];
  if (ok.length) linhas.push(`✅ ${ok.map((c) => c.rotulo).join(" · ")}`);
  if (sem.length) linhas.push(`⚠️ Dispositivo existe, sem trecho transcrito para conferir: ${sem.map((c) => c.rotulo).join(" · ")}`);
  if (nao.length) linhas.push(`❌ Removido do texto por não conferir com a lei: ${nao.map((c) => `${c.rotulo} (${c.motivo})`).join(" · ")}`);
  if (nNao.length) linhas.push(`❌ Norma removida do texto, não localizada nas fontes oficiais: ${nNao.map((n) => `${n.rotulo} (${n.motivo})`).join(" · ")}`);
  if (jNao.length) linhas.push(`❌ Jurisprudência removida do texto, número não localizado nas fontes consultadas: ${jNao.map((j) => j.rotulo).join(" · ")}`);
  return linhas.join("\n\n");
}

// Pipeline único das respostas em texto: confere, deixa a IA reescrever UMA vez com a
// lista do que falhou e, no fim, remove do texto o que ainda não conferir.
export async function respostaSegura(
  texto: string, idx: Indice, fontes: string,
  reescrever?: (falhas: string[], anterior: string) => Promise<string>,
  // deno-lint-ignore no-explicit-any
  supabase?: any,
): Promise<{ texto: string; citacoes: Citacao[]; jurisprudencia: Juris[]; normas: Norma[]; rodape: string; reescrita: boolean }> {
  const avaliar = async (t: string) => {
    await prepararComPlanalto(t, idx, supabase).catch(() => {});   // norma fora da base: Planalto ao vivo
    const citacoes = conferir(t, idx), jurisprudencia = conferirJurisprudencia(t, fontes), normas = conferirNormas(t, fontes);
    const falhas = [
      ...citacoes.filter((c) => c.status === "nao_confere").map((c) => `${c.rotulo}: ${c.motivo}`),
      ...normas.filter((n) => !n.ok).map((n) => `${n.rotulo}: ${n.motivo}`),
      ...jurisprudencia.filter((j) => !j.ok).map((j) => `${j.rotulo}: número não consta nas fontes fornecidas`),
    ];
    return { citacoes, jurisprudencia, normas, falhas };
  };
  let r = await avaliar(texto);
  let reescrita = false;
  if (r.falhas.length && reescrever) {
    try {
      const novo = await reescrever(r.falhas, texto);
      if (novo?.trim()) { texto = novo; r = await avaliar(texto); reescrita = true; }
    } catch { /* fica com a primeira versão, saneada abaixo */ }
  }
  const limpo = sanear(texto, r.citacoes, r.jurisprudencia, r.normas);
  return { texto: limpo, citacoes: r.citacoes, jurisprudencia: r.jurisprudencia, normas: r.normas, rodape: rodapeVerificacao(r.citacoes, r.jurisprudencia, r.normas), reescrita };
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
    for (const j of juris) if (!j.ok) removidas.push(`${j.rotulo} (número não localizado nas fontes)`);
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
