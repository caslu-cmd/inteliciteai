import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ChevronRight, ChevronLeft, Save, Download, Sparkles,
  Loader2, Copy, Check, Building2, AlertTriangle, Scale, Calculator,
  TrendingUp, ShieldAlert, ClipboardCheck, Info, Wand2, BookOpen,
  Maximize2, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FloatingChat from "@/components/FloatingChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ── Form schema ────────────────────────────────────────────────
const FORM0 = {
  orgao: "", cnpjOrgao: "", unidade: "", setor: "",
  responsavel: "", cargo: "", matricula: "", processoSEI: "", dataElaboracao: "",
  descricaoNecessidade: "", problemaSolucionar: "", publicoBeneficiado: "",
  quantidadeUsuarios: "", previsaoPCA: "", numeroPCA: "",
  alinhamentoEstrategico: "", instrumentoPlanejamento: "",
  requisitosNegocio: "", requisitosTecnicos: "", sustentabilidade: "",
  qualidade: "", segurancaInformacao: "", habilitacaoEspecifica: "",
  descricaoItens: "", memoriaCalculo: "", alternativasAvaliadas: "",
  solucaoEscolhida: "", decisaoParcelamento: "", justificativaParcelamento: "",
  valorEstimado: "", fontePesquisa1: "", fontePesquisa2: "",
  metodologiaPesquisa: "", dataPesquisa: "", catmatCatser: "",
  naturezaDespesa: "", dotacaoOrcamentaria: "",
  riscosIdentificados: "", probabilidadeImpacto: "", medidasMitigacao: "",
  contratacaoCorrelatas: "", interdependentes: "", providencias: "",
  resultadosPretendidos: "", indicadoresDesempenho: "", beneficiosEsperados: "",
  viabilidade: "", justificativaViabilidade: "",
};
type ETPForm = typeof FORM0;

// ── Sections metadata ──────────────────────────────────────────
const SECTIONS = [
  { id: 1, title: "Identificação",  icon: Building2,     ref: "Art. 18 — Dados do órgão e responsáveis",         required: ["orgao","setor","responsavel"] },
  { id: 2, title: "Necessidade",    icon: AlertTriangle,  ref: "Art. 18, §1º, I e II — Necessidade e alinhamento", required: ["descricaoNecessidade","problemaSolucionar","alinhamentoEstrategico"] },
  { id: 3, title: "Requisitos",     icon: Scale,          ref: "Art. 18, §1º, III — Técnicos e legais",            required: ["requisitosNegocio","requisitosTecnicos"] },
  { id: 4, title: "Quantidades",    icon: Calculator,     ref: "Art. 18, §1º, IV e V — Quantidades e mercado",     required: ["descricaoItens","memoriaCalculo","alternativasAvaliadas","decisaoParcelamento"] },
  { id: 5, title: "Estimativa",     icon: TrendingUp,     ref: "Art. 18, §1º, VI — Valor e pesquisa de preços",    required: ["valorEstimado","fontePesquisa1"] },
  { id: 6, title: "Riscos",         icon: ShieldAlert,    ref: "Art. 18, §1º, X e XI — Riscos e correlatas",       required: ["riscosIdentificados","medidasMitigacao","providencias"] },
  { id: 7, title: "Conclusão",      icon: ClipboardCheck, ref: "Art. 18, §1º, VIII, IX e XII — Posicionamento",    required: ["resultadosPretendidos","viabilidade","justificativaViabilidade"] },
];

const COMPLIANCE = [
  { label: "I — Necessidade",   field: "descricaoNecessidade" },
  { label: "II — PCA",          field: "previsaoPCA" },
  { label: "III — Requisitos",  field: "requisitosTecnicos" },
  { label: "IV — Quantidades",  field: "memoriaCalculo" },
  { label: "V — Mercado",       field: "alternativasAvaliadas" },
  { label: "VI — Valor",        field: "valorEstimado" },
  { label: "VII — Parcelamento",field: "decisaoParcelamento" },
  { label: "VIII — Resultados", field: "resultadosPretendidos" },
  { label: "X — Riscos",        field: "riscosIdentificados" },
  { label: "XI — Correlatas",   field: "contratacaoCorrelatas" },
  { label: "XII — Conclusivo",  field: "viabilidade" },
];

// ── Helper components ──────────────────────────────────────────
type SectionProps = {
  form: ETPForm;
  set: (f: keyof ETPForm, v: string) => void;
  suggesting: string | null;
  onSuggest: (campo: string) => void;
};

const SuggestBtn = ({ campo, suggesting, onSuggest }: { campo: string; suggesting: string | null; onSuggest: (c: string) => void }) => (
  <button
    type="button"
    disabled={suggesting !== null}
    onClick={() => onSuggest(campo)}
    className="flex items-center gap-1 text-[10px] font-medium text-amber-500/80 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {suggesting === campo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
    IA
  </button>
);

function FL({ label, req, tip, campo, suggesting, onSuggest, children }: {
  label: string; req?: boolean; tip?: string; campo?: string;
  suggesting?: string | null; onSuggest?: (c: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</Label>
          {tip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">{tip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {campo && onSuggest && <SuggestBtn campo={campo} suggesting={suggesting!} onSuggest={onSuggest} />}
      </div>
      {children}
    </div>
  );
}

// ── Section renderers ──────────────────────────────────────────
function Sec1({ form, set }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Órgão / Entidade" req><Input value={form.orgao} onChange={e => set("orgao", e.target.value)} placeholder="Ex: Prefeitura Municipal de..." /></FL>
        <FL label="CNPJ" tip="CNPJ do órgão contratante"><Input value={form.cnpjOrgao} onChange={e => set("cnpjOrgao", e.target.value)} placeholder="00.000.000/0000-00" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Unidade Administrativa"><Input value={form.unidade} onChange={e => set("unidade", e.target.value)} placeholder="Ex: Secretaria de Administração" /></FL>
        <FL label="Setor Requisitante" req><Input value={form.setor} onChange={e => set("setor", e.target.value)} placeholder="Setor que demanda a contratação" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Responsável pela Elaboração" req><Input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} placeholder="Nome completo" /></FL>
        <FL label="Cargo / Função"><Input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: Analista de Contratos" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FL label="Matrícula"><Input value={form.matricula} onChange={e => set("matricula", e.target.value)} placeholder="Nº matrícula" /></FL>
        <FL label="Nº do Processo" tip="Número SEI, SIPAC ou similar"><Input value={form.processoSEI} onChange={e => set("processoSEI", e.target.value)} placeholder="0000000.000000/0000-00" /></FL>
        <FL label="Data de Elaboração"><Input type="date" value={form.dataElaboracao} onChange={e => set("dataElaboracao", e.target.value)} /></FL>
      </div>
    </div>
  );
}

function Sec2({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Descrição da Necessidade" req campo="descricaoNecessidade" suggesting={suggesting} onSuggest={onSuggest}
        tip="Descreva detalhadamente a necessidade que motiva a contratação conforme Art. 18, §1º, I">
        <Textarea rows={4} value={form.descricaoNecessidade} onChange={e => set("descricaoNecessidade", e.target.value)} placeholder="Descreva a necessidade que motiva esta contratação, incluindo o contexto e os problemas atuais..." />
      </FL>
      <FL label="Problema a ser Solucionado" req campo="problemaSolucionar" suggesting={suggesting} onSuggest={onSuggest}
        tip="Identifique claramente o problema que justifica a contratação">
        <Textarea rows={3} value={form.problemaSolucionar} onChange={e => set("problemaSolucionar", e.target.value)} placeholder="Qual é o problema ou lacuna que esta contratação resolve?" />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Público Beneficiado"><Input value={form.publicoBeneficiado} onChange={e => set("publicoBeneficiado", e.target.value)} placeholder="Ex: servidores, cidadãos, estudantes" /></FL>
        <FL label="Quantidade de Beneficiários"><Input value={form.quantidadeUsuarios} onChange={e => set("quantidadeUsuarios", e.target.value)} placeholder="Ex: 500 servidores" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Previsão no PCA" req tip="Plano de Contratações Anual — Art. 18, §1º, II">
          <Select value={form.previsaoPCA} onValueChange={v => set("previsaoPCA", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim — previsto no PCA</SelectItem>
              <SelectItem value="nao">Não — contratação emergencial</SelectItem>
              <SelectItem value="inclusao">Em processo de inclusão no PCA</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Nº no PCA / DFD" tip="Número do item no Plano de Contratações Anual ou Documento de Formalização de Demanda"><Input value={form.numeroPCA} onChange={e => set("numeroPCA", e.target.value)} placeholder="Ex: PCA 2025 — Item 42" /></FL>
      </div>
      <FL label="Alinhamento Estratégico" req campo="alinhamentoEstrategico" suggesting={suggesting} onSuggest={onSuggest}
        tip="Como esta contratação se alinha ao planejamento estratégico do órgão, PPA, PDI ou outros instrumentos">
        <Textarea rows={3} value={form.alinhamentoEstrategico} onChange={e => set("alinhamentoEstrategico", e.target.value)} placeholder="Demonstre o alinhamento com o planejamento estratégico institucional..." />
      </FL>
      <FL label="Instrumento de Planejamento" tip="PPA, PDI, Plano de Metas ou similar"><Input value={form.instrumentoPlanejamento} onChange={e => set("instrumentoPlanejamento", e.target.value)} placeholder="Ex: PPA 2024-2027, Meta 3.2" /></FL>
    </div>
  );
}

function Sec3({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Requisitos de Negócio" req campo="requisitosNegocio" suggesting={suggesting} onSuggest={onSuggest}
        tip="Requisitos funcionais e de negócio que a solução deve atender">
        <Textarea rows={4} value={form.requisitosNegocio} onChange={e => set("requisitosNegocio", e.target.value)} placeholder="Liste os requisitos funcionais, de negócio e de desempenho exigidos..." />
      </FL>
      <FL label="Requisitos Técnicos" req campo="requisitosTecnicos" suggesting={suggesting} onSuggest={onSuggest}
        tip="Especificações técnicas mínimas, padrões e normas aplicáveis">
        <Textarea rows={4} value={form.requisitosTecnicos} onChange={e => set("requisitosTecnicos", e.target.value)} placeholder="Especificações técnicas mínimas, padrões, normas ABNT, requisitos de desempenho..." />
      </FL>
      <FL label="Requisitos de Sustentabilidade" campo="sustentabilidade" suggesting={suggesting} onSuggest={onSuggest}
        tip="Critérios de sustentabilidade conforme IN 01/2010 SLTI e Decreto 7.746/2012">
        <Textarea rows={3} value={form.sustentabilidade} onChange={e => set("sustentabilidade", e.target.value)} placeholder="Requisitos ambientais, sociais e econômicos conforme legislação vigente..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Requisitos de Qualidade"><Textarea rows={2} value={form.qualidade} onChange={e => set("qualidade", e.target.value)} placeholder="Certificações, selos de qualidade, ISO..." /></FL>
        <FL label="Segurança da Informação" tip="Se aplicável, requisitos de LGPD, SGSI, controles de acesso"><Textarea rows={2} value={form.segurancaInformacao} onChange={e => set("segurancaInformacao", e.target.value)} placeholder="Requisitos de LGPD, segurança digital..." /></FL>
      </div>
      <FL label="Habilitação Específica" tip="Exigências de habilitação além das previstas em lei, com fundamentação">
        <Textarea rows={2} value={form.habilitacaoEspecifica} onChange={e => set("habilitacaoEspecifica", e.target.value)} placeholder="Atestados, certificações, registros em conselhos profissionais..." />
      </FL>
    </div>
  );
}

function Sec4({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Descrição dos Itens / Quantitativos" req campo="descricaoItens" suggesting={suggesting} onSuggest={onSuggest}
        tip="Liste todos os itens com código CATMAT/CATSER, unidade de medida e quantidade estimada">
        <Textarea rows={5} value={form.descricaoItens} onChange={e => set("descricaoItens", e.target.value)} placeholder="Item 1 — [CATMAT 000000] Descrição detalhada — 100 unidades&#10;Item 2 — ..." />
      </FL>
      <FL label="Memória de Cálculo das Quantidades" req campo="memoriaCalculo" suggesting={suggesting} onSuggest={onSuggest}
        tip="Demonstração de como foram calculadas as quantidades estimadas (histórico de consumo, projeções, etc.)">
        <Textarea rows={4} value={form.memoriaCalculo} onChange={e => set("memoriaCalculo", e.target.value)} placeholder="Baseado no histórico dos últimos 12 meses: consumo médio de X unidades/mês × 12 meses = Y unidades..." />
      </FL>
      <FL label="Alternativas de Mercado Avaliadas" req campo="alternativasAvaliadas" suggesting={suggesting} onSuggest={onSuggest}
        tip="Soluções existentes no mercado analisadas — Art. 18, §1º, V">
        <Textarea rows={4} value={form.alternativasAvaliadas} onChange={e => set("alternativasAvaliadas", e.target.value)} placeholder="Alternativa 1: [descrição] — Vantagens: ... Desvantagens: ...&#10;Alternativa 2: ..." />
      </FL>
      <FL label="Justificativa da Solução Escolhida" campo="solucaoEscolhida" suggesting={suggesting} onSuggest={onSuggest}>
        <Textarea rows={3} value={form.solucaoEscolhida} onChange={e => set("solucaoEscolhida", e.target.value)} placeholder="Por que a solução escolhida é a mais adequada entre as alternativas avaliadas..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Decisão sobre Parcelamento" req tip="Art. 18, §1º, VII — Justificativa para parcelamento ou não da solução">
          <Select value={form.decisaoParcelamento} onValueChange={v => set("decisaoParcelamento", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao_parcelado">Não parcelado — contratação integral</SelectItem>
              <SelectItem value="parcelado">Parcelado — divisão em lotes</SelectItem>
              <SelectItem value="inviavel">Parcelamento inviável tecnicamente</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Justificativa do Parcelamento" campo="justificativaParcelamento" suggesting={suggesting} onSuggest={onSuggest}>
          <Textarea rows={2} value={form.justificativaParcelamento} onChange={e => set("justificativaParcelamento", e.target.value)} placeholder="Fundamente a decisão sobre o parcelamento..." />
        </FL>
      </div>
    </div>
  );
}

function Sec5({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Valor Total Estimado (R$)" req><Input value={form.valorEstimado} onChange={e => set("valorEstimado", e.target.value)} placeholder="Ex: 150.000,00" /></FL>
        <FL label="Data da Pesquisa de Preços"><Input type="date" value={form.dataPesquisa} onChange={e => set("dataPesquisa", e.target.value)} /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Fonte de Pesquisa Principal" req tip="Conforme IN SEGES/ME nº 65/2021">
          <Select value={form.fontePesquisa1} onValueChange={v => set("fontePesquisa1", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="painel_precos">Painel de Preços (paineldeprecos.planejamento.gov.br)</SelectItem>
              <SelectItem value="atas_rp">Atas de Registro de Preços vigentes</SelectItem>
              <SelectItem value="contratos_anteriores">Contratos anteriores do próprio órgão</SelectItem>
              <SelectItem value="pesquisa_mercado">Pesquisa direta com fornecedores (mín. 3)</SelectItem>
              <SelectItem value="notas_fiscais">Notas fiscais de compras anteriores</SelectItem>
              <SelectItem value="outros">Outros meios</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Fonte de Pesquisa Complementar">
          <Select value={form.fontePesquisa2} onValueChange={v => set("fontePesquisa2", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="painel_precos">Painel de Preços</SelectItem>
              <SelectItem value="atas_rp">Atas de Registro de Preços</SelectItem>
              <SelectItem value="contratos_anteriores">Contratos anteriores</SelectItem>
              <SelectItem value="pesquisa_mercado">Pesquisa com fornecedores</SelectItem>
              <SelectItem value="notas_fiscais">Notas fiscais</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
      <FL label="Metodologia da Pesquisa de Preços" campo="metodologiaPesquisa" suggesting={suggesting} onSuggest={onSuggest}
        tip="Descreva como foi realizada a pesquisa conforme IN SEGES/ME nº 65/2021">
        <Textarea rows={3} value={form.metodologiaPesquisa} onChange={e => set("metodologiaPesquisa", e.target.value)} placeholder="Descreva a metodologia utilizada para a estimativa do valor: fontes consultadas, critérios de aceitação de preços, média calculada..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FL label="Código CATMAT/CATSER" tip="Código do Catálogo de Materiais ou Serviços"><Input value={form.catmatCatser} onChange={e => set("catmatCatser", e.target.value)} placeholder="Ex: 20-007-2450-001" /></FL>
        <FL label="Natureza da Despesa">
          <Select value={form.naturezaDespesa} onValueChange={v => set("naturezaDespesa", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="custeio">Custeio (3.x.x.x)</SelectItem>
              <SelectItem value="investimento">Investimento (4.x.x.x)</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Dotação Orçamentária" tip="Programa de trabalho, ação, natureza, fonte de recurso"><Input value={form.dotacaoOrcamentaria} onChange={e => set("dotacaoOrcamentaria", e.target.value)} placeholder="PT: 00.000.0000.0000.0000" /></FL>
      </div>
    </div>
  );
}

function Sec6({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Riscos Identificados" req campo="riscosIdentificados" suggesting={suggesting} onSuggest={onSuggest}
        tip="Identifique os principais riscos da contratação conforme Art. 18, §1º, X">
        <Textarea rows={5} value={form.riscosIdentificados} onChange={e => set("riscosIdentificados", e.target.value)} placeholder="Risco 1: [descrição] — Probabilidade: Alta/Média/Baixa — Impacto: Alto/Médio/Baixo&#10;Risco 2: ..." />
      </FL>
      <FL label="Probabilidade e Impacto" tip="Matriz de riscos com probabilidade × impacto">
        <Textarea rows={3} value={form.probabilidadeImpacto} onChange={e => set("probabilidadeImpacto", e.target.value)} placeholder="Descreva a avaliação de probabilidade e impacto de cada risco identificado..." />
      </FL>
      <FL label="Medidas de Mitigação" req campo="medidasMitigacao" suggesting={suggesting} onSuggest={onSuggest}
        tip="Ações concretas para reduzir a probabilidade ou o impacto dos riscos">
        <Textarea rows={4} value={form.medidasMitigacao} onChange={e => set("medidasMitigacao", e.target.value)} placeholder="Risco 1: [medida de mitigação correspondente]&#10;Risco 2: ..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Contratações Correlatas" tip="Art. 18, §1º, XI — Contratos relacionados a esta contratação">
          <Textarea rows={3} value={form.contratacaoCorrelatas} onChange={e => set("contratacaoCorrelatas", e.target.value)} placeholder="Contratos em vigor que se relacionam com esta contratação..." />
        </FL>
        <FL label="Contratações Interdependentes" tip="Contratações cujo resultado depende desta ou vice-versa">
          <Textarea rows={3} value={form.interdependentes} onChange={e => set("interdependentes", e.target.value)} placeholder="Contratações que dependem desta ou das quais esta depende..." />
        </FL>
      </div>
      <FL label="Providências a serem Adotadas" req campo="providencias" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 18, §1º, IX — Ações administrativas necessárias antes e durante a contratação">
        <Textarea rows={3} value={form.providencias} onChange={e => set("providencias", e.target.value)} placeholder="Ex: designar equipe de planejamento, obter autorização superior, emitir DFD, reservar dotação..." />
      </FL>
    </div>
  );
}

function Sec7({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Resultados Pretendidos" req campo="resultadosPretendidos" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 18, §1º, VIII — Benefícios e resultados esperados com a contratação">
        <Textarea rows={4} value={form.resultadosPretendidos} onChange={e => set("resultadosPretendidos", e.target.value)} placeholder="Descreva os resultados concretos esperados: melhoria de processos, redução de custos, aumento de eficiência..." />
      </FL>
      <FL label="Indicadores de Desempenho / Metas" campo="indicadoresDesempenho" suggesting={suggesting} onSuggest={onSuggest}
        tip="Métricas quantificáveis para avaliar o sucesso da contratação">
        <Textarea rows={3} value={form.indicadoresDesempenho} onChange={e => set("indicadoresDesempenho", e.target.value)} placeholder="Indicador 1: [descrição] — Meta: X% de melhoria&#10;Indicador 2: ..." />
      </FL>
      <FL label="Benefícios Econômicos e Sociais">
        <Textarea rows={2} value={form.beneficiosEsperados} onChange={e => set("beneficiosEsperados", e.target.value)} placeholder="Benefícios adicionais esperados para a administração e para a sociedade..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Posicionamento sobre Viabilidade" req tip="Art. 18, §1º, XII — Conclusão sobre viabilidade e razoabilidade">
          <Select value={form.viabilidade} onValueChange={v => set("viabilidade", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viavel">Viável e razoável — recomenda-se prosseguir</SelectItem>
              <SelectItem value="inviavel">Inviável — recomenda-se não prosseguir</SelectItem>
              <SelectItem value="condicional">Viável condicionalmente — ajustes necessários</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <div /> {/* spacer */}
      </div>
      <FL label="Justificativa do Posicionamento Conclusivo" req campo="justificativaViabilidade" suggesting={suggesting} onSuggest={onSuggest}>
        <Textarea rows={4} value={form.justificativaViabilidade} onChange={e => set("justificativaViabilidade", e.target.value)} placeholder="Fundamente o posicionamento sobre a viabilidade com base nos dados levantados nas seções anteriores..." />
      </FL>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ETPGeneratorPage() {
  const [section, setSection] = useState(1);
  const [form, setForm] = useState<ETPForm>(FORM0);
  const [aiContent, setAiContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const set = useCallback((field: keyof ETPForm, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
  }, []);

  const sectionStatus = useMemo(() => SECTIONS.map(s => {
    const filled = s.required.filter(f => form[f as keyof ETPForm]?.trim());
    return { filled: filled.length, total: s.required.length };
  }), [form]);

  const pct = useMemo(() => {
    const all = SECTIONS.flatMap(s => s.required);
    const filled = all.filter(f => form[f as keyof ETPForm]?.trim());
    return Math.round((filled.length / all.length) * 100);
  }, [form]);

  const words = aiContent ? aiContent.split(/\s+/).filter(Boolean).length : 0;

  const handleSuggest = useCallback(async (campo: string) => {
    setSuggesting(campo);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ tipo: "sugestao", formData: { campo, tipoDocumento: "ETP", contexto: form } }),
      });
      const data = await res.json();
      if (data.conteudo) {
        setForm(p => ({ ...p, [campo]: data.conteudo }));
        toast.success("Sugestão aplicada!");
      }
    } catch { toast.error("Erro ao sugerir."); }
    finally { setSuggesting(null); }
  }, [form]);

  const handleGenerate = useCallback(async () => {
    if (pct < 30) { toast.warning("Preencha pelo menos os campos obrigatórios essenciais (órgão, necessidade, objeto)."); return; }
    setGenerating(true);
    setAiContent("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ tipo: "etp", formData: form, stream: true }),
      });
      if (!res.ok) throw new Error("Falha");
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let acc = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const j = JSON.parse(line.slice(6));
                if (j.type === "content_block_delta" && j.delta?.text) { acc += j.delta.text; setAiContent(acc); }
              } catch {}
            }
          }
        }
        toast.success("ETP gerado com sucesso!");
      }
    } catch { toast.error("Erro ao gerar o ETP. Tente novamente."); }
    finally { setGenerating(false); }
  }, [form, pct]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      await supabase.from("documents").insert({
        user_id: user.id, tipo: "etp",
        titulo: `ETP — ${form.descricaoItens?.slice(0, 60) || form.orgao || "Sem objeto"}`,
        orgao: form.orgao, objeto: form.descricaoItens,
        conteudo: aiContent, form_data: form,
        status: aiContent ? "finalizado" : "rascunho",
      });
      toast.success("ETP salvo com sucesso!");
    } catch { toast.error("Erro ao salvar. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleExport = () => {
    if (!aiContent) return;
    const blob = new Blob([aiContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ETP_${form.orgao || "documento"}_${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!aiContent) return;
    navigator.clipboard.writeText(aiContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cur = SECTIONS[section - 1];
  const CurIcon = cur.icon;
  const sectionProps: SectionProps = { form, set, suggesting, onSuggest: handleSuggest };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Estudo Técnico Preliminar</h1>
              <p className="text-xs text-muted-foreground">Art. 18, §1º · Lei 14.133/2021 · IN SEGES/ME nº 58/2022</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={pct >= 80 ? "default" : "secondary"} className="text-xs font-mono">{pct}% completo</Badge>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !form.orgao}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Salvar
            </Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? "Gerando..." : "Gerar ETP com IA"}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full bg-amber-500 rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{pct}% dos campos obrigatórios preenchidos</span>
            <span>{sectionStatus.filter(s => s.filled === s.total).length}/{SECTIONS.length} seções completas</span>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr_400px] gap-4">

          {/* Sidebar nav */}
          <nav className="rounded-xl border border-border bg-card p-2 h-fit lg:sticky lg:top-20">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Seções do ETP</p>
            <div className="space-y-0.5">
              {SECTIONS.map((s, idx) => {
                const Icon = s.icon;
                const st = sectionStatus[idx];
                const done = st.filled === st.total;
                const active = section === s.id;
                return (
                  <button key={s.id} onClick={() => setSection(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all",
                      active ? "bg-amber-500/10" : done ? "hover:bg-emerald-500/5" : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active ? "bg-amber-500 text-white" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {done && !active ? <Check className="h-3 w-3" /> : s.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium", active ? "text-amber-500" : done ? "text-emerald-500" : "text-muted-foreground")}>{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{st.filled}/{st.total} obr.</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legal compliance checklist */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conformidade Art. 18</p>
              <div className="space-y-0.5">
                {COMPLIANCE.map(({ label, field }) => {
                  const ok = !!form[field as keyof ETPForm]?.trim();
                  return (
                    <div key={field} className="flex items-center gap-2 px-3 py-0.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", ok ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                      <span className={cn("text-[10px]", ok ? "text-emerald-500" : "text-muted-foreground")}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Form */}
          <div className="rounded-xl border border-border bg-card flex flex-col min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex-1 p-6 overflow-y-auto"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                    <CurIcon className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{cur.title}</h2>
                    <p className="text-xs text-muted-foreground">{cur.ref}</p>
                  </div>
                </div>
                {section === 1 && <Sec1 {...sectionProps} />}
                {section === 2 && <Sec2 {...sectionProps} />}
                {section === 3 && <Sec3 {...sectionProps} />}
                {section === 4 && <Sec4 {...sectionProps} />}
                {section === 5 && <Sec5 {...sectionProps} />}
                {section === 6 && <Sec6 {...sectionProps} />}
                {section === 7 && <Sec7 {...sectionProps} />}
              </motion.div>
            </AnimatePresence>

            {/* Nav footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setSection(s => Math.max(1, s - 1))} disabled={section === 1}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <div className="flex items-center gap-1">
                {SECTIONS.map((_, i) => {
                  const done = sectionStatus[i]?.filled === sectionStatus[i]?.total;
                  return (
                    <button key={i} onClick={() => setSection(i + 1)}
                      className={cn("rounded-full transition-all", section === i + 1 ? "h-2 w-4 bg-amber-500" : done ? "h-2 w-2 bg-emerald-500" : "h-2 w-2 bg-muted-foreground/30")}
                    />
                  );
                })}
              </div>
              {section < 7 ? (
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setSection(s => s + 1)}>
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                  Gerar ETP
                </Button>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className={cn(
            "rounded-xl border border-border bg-card flex flex-col",
            fullscreen && "fixed inset-4 z-50 shadow-2xl"
          )}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium">Preview</span>
                {aiContent && <span className="text-xs text-muted-foreground">· {words.toLocaleString()} palavras</span>}
              </div>
              <div className="flex items-center gap-1">
                {aiContent && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFullscreen(v => !v)}>
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm min-h-[500px]">
              {generating ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Claude está redigindo o ETP...
                  </div>
                  {aiContent && (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>h1]:text-sm [&>h2]:text-xs [&>h3]:text-xs [&>p]:text-xs [&>p]:leading-relaxed [&>ul]:text-xs [&>ol]:text-xs">
                      <ReactMarkdown>{aiContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ) : aiContent ? (
                <div className="prose prose-sm max-w-none dark:prose-invert
                  [&>h1]:text-sm [&>h1]:font-bold [&>h1]:mt-5 [&>h1]:mb-2
                  [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-1.5
                  [&>h3]:text-xs [&>h3]:font-medium [&>h3]:mt-3 [&>h3]:mb-1
                  [&>p]:text-xs [&>p]:leading-relaxed
                  [&>ul]:text-xs [&>ul]:space-y-0.5
                  [&>ol]:text-xs [&>ol]:space-y-0.5
                  [&>blockquote]:border-l-2 [&>blockquote]:border-amber-500 [&>blockquote]:pl-3 [&>blockquote]:text-xs [&>blockquote]:text-muted-foreground">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-3">
                  <div className="rounded-full bg-amber-500/10 p-4">
                    <FileText className="h-7 w-7 text-amber-500/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nenhum documento gerado</p>
                    <p className="text-xs mt-1 text-muted-foreground max-w-[180px]">
                      Preencha as seções e clique em "Gerar ETP com IA"
                    </p>
                  </div>
                  {pct > 0 && (
                    <div className="text-xs text-left space-y-1 mt-1 w-full max-w-[200px]">
                      {form.orgao && <p><span className="text-muted-foreground">Órgão:</span> {form.orgao}</p>}
                      {form.setor && <p><span className="text-muted-foreground">Setor:</span> {form.setor}</p>}
                      {form.valorEstimado && <p><span className="text-muted-foreground">Valor est.:</span> R$ {form.valorEstimado}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <FloatingChat />
    </TooltipProvider>
  );
}
