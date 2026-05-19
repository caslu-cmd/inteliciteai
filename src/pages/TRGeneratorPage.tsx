import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ChevronRight, ChevronLeft, Save, Download, Sparkles,
  Loader2, Copy, Check, Building2, Target, Scale, Layers,
  Settings, Users, ShoppingCart, DollarSign, Info, Wand2, BookOpen,
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
import { exportAsPdf, exportAsDocx } from "@/lib/exportDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import HistoricalReportsSection, { ForecastData } from "@/components/documents/HistoricalReportsSection";

// ── Form schema ────────────────────────────────────────────────
const FORM0 = {
  // Section 1: Identificação
  orgao: "", unidade: "", numeroProcesso: "", numeroTR: "",
  responsavel: "", cargo: "", referenciaETP: "", dataElaboracao: "",
  // Section 2: Objeto e Fundamentação
  objeto: "", naturezaObjeto: "", catmatCatser: "",
  fundamentacaoLegal: "", modalidadePrevista: "", tipoContratacao: "",
  // Section 3: Especificações e Requisitos
  especificacoesTecnicas: "", normasTecnicas: "", sustentabilidade: "",
  amostra: "", habilitacaoJuridica: "", habilitacaoTecnica: "",
  qualificacaoFinanceira: "", indices: "",
  // Section 4: Modelo de Execução
  prazoExecucao: "", unidadePrazo: "", localExecucao: "",
  formaEntrega: "", cronograma: "", subcontratacao: "",
  percentualSubcontratacao: "", condicoesEspeciais: "",
  // Section 5: Gestão Contratual
  fiscalTecnico: "", fiscalAdministrativo: "",
  recebimentoProvisorio: "", recebimentoDefinitivo: "",
  criterioMedicao: "", prazoPagamento: "",
  formaPagamento: "", documentosCobranca: "",
  // Section 6: Seleção do Fornecedor
  modalidade: "", criterioJulgamento: "", modoDisputa: "",
  validadeProposta: "", exigeAmostraPrevia: "", exigeCartaSolidariedade: "",
  // Section 7: Valor, Orçamento e Sanções
  valorEstimado: "", valorMaximoUnitario: "",
  programaTrabalho: "", elementoDespesa: "",
  obrigacoesContratada: "", obrigacoesContratante: "",
  garantia: "", sancoes: "",
  vigenciaContrato: "", prorrogacao: "",
};
type TRForm = typeof FORM0;

// ── Sections metadata ──────────────────────────────────────────
const SECTIONS = [
  { id: 1, title: "Identificação",  icon: Building2,   ref: "Art. 6º, XXIII — Dados do documento",               required: ["orgao","responsavel"] },
  { id: 2, title: "Objeto",         icon: Target,       ref: "Art. 40, I e II — Objeto e fundamentação",           required: ["objeto","naturezaObjeto"] },
  { id: 3, title: "Requisitos",     icon: Scale,        ref: "Art. 40, III — Especificações e habilitação",        required: ["especificacoesTecnicas","habilitacaoTecnica"] },
  { id: 4, title: "Execução",       icon: Layers,       ref: "Art. 40, IV — Modelo de execução do objeto",         required: ["prazoExecucao","localExecucao"] },
  { id: 5, title: "Gestão",         icon: Settings,     ref: "Art. 40, V — Gestão e fiscalização contratual",      required: ["recebimentoProvisorio","recebimentoDefinitivo","criterioMedicao"] },
  { id: 6, title: "Seleção",        icon: ShoppingCart, ref: "Art. 40, VI e VII — Seleção do fornecedor",          required: ["modalidade","criterioJulgamento","modoDisputa"] },
  { id: 7, title: "Valor e Sanções",icon: DollarSign,   ref: "Art. 40, VIII–XII — Valor, obrigações e sanções",   required: ["valorEstimado","obrigacoesContratada","obrigacoesContratante","sancoes"] },
];

const COMPLIANCE = [
  { label: "I — Objeto",            field: "objeto" },
  { label: "II — Fundamentação",    field: "fundamentacaoLegal" },
  { label: "III — Requisitos",      field: "especificacoesTecnicas" },
  { label: "IV — Execução",         field: "prazoExecucao" },
  { label: "V — Gestão",            field: "criterioMedicao" },
  { label: "VI — Critério julg.",   field: "criterioJulgamento" },
  { label: "VII — Modo disputa",    field: "modoDisputa" },
  { label: "VIII — Valor",          field: "valorEstimado" },
  { label: "IX — Orçamento",        field: "elementoDespesa" },
  { label: "X e XI — Obrigações",   field: "obrigacoesContratada" },
  { label: "XII — Sanções",         field: "sancoes" },
];

// ── Helper components ──────────────────────────────────────────
type SectionProps = {
  form: TRForm;
  set: (f: keyof TRForm, v: string) => void;
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
        <FL label="Órgão / Entidade" req><Input value={form.orgao} onChange={e => set("orgao", e.target.value)} placeholder="Ex: Ministério da Saúde" /></FL>
        <FL label="Unidade Administrativa"><Input value={form.unidade} onChange={e => set("unidade", e.target.value)} placeholder="Ex: Coordenação de Logística" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Nº do Processo" tip="Número SEI, SIPAC ou similar"><Input value={form.numeroProcesso} onChange={e => set("numeroProcesso", e.target.value)} placeholder="0000000.000000/0000-00" /></FL>
        <FL label="Nº do Termo de Referência"><Input value={form.numeroTR} onChange={e => set("numeroTR", e.target.value)} placeholder="Ex: TR nº 001/2025" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Responsável pela Elaboração" req><Input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} placeholder="Nome completo" /></FL>
        <FL label="Cargo / Função"><Input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: Analista de Licitações" /></FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Referência ao ETP" tip="Número do Estudo Técnico Preliminar que fundamenta este TR"><Input value={form.referenciaETP} onChange={e => set("referenciaETP", e.target.value)} placeholder="Ex: ETP nº 002/2025" /></FL>
        <FL label="Data de Elaboração"><Input type="date" value={form.dataElaboracao} onChange={e => set("dataElaboracao", e.target.value)} /></FL>
      </div>
    </div>
  );
}

function Sec2({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Definição do Objeto" req campo="objeto" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 40, I — Descrição precisa, suficiente e clara do objeto. Evite definições genéricas.">
        <Textarea rows={5} value={form.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Contratação de empresa especializada para [descrição detalhada do objeto, incluindo características, especificidades e finalidade]..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Natureza do Objeto" req tip="Classificação conforme Art. 6º da Lei 14.133/2021">
          <Select value={form.naturezaObjeto} onValueChange={v => set("naturezaObjeto", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bens">Bens (fornecimento de materiais)</SelectItem>
              <SelectItem value="servicos_comuns">Serviços comuns</SelectItem>
              <SelectItem value="servicos_especiais">Serviços especiais / técnicos</SelectItem>
              <SelectItem value="servicos_continuados">Serviços continuados</SelectItem>
              <SelectItem value="obras">Obras</SelectItem>
              <SelectItem value="servicos_engenharia">Serviços de engenharia</SelectItem>
              <SelectItem value="servicos_engenharia_especiais">Serviços de eng. especiais</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Código CATMAT/CATSER" tip="Código do Catálogo de Materiais (CATMAT) ou Serviços (CATSER)"><Input value={form.catmatCatser} onChange={e => set("catmatCatser", e.target.value)} placeholder="Ex: CATSER 17497" /></FL>
      </div>
      <FL label="Fundamentação Legal" campo="fundamentacaoLegal" suggesting={suggesting} onSuggest={onSuggest}
        tip="Dispositivos legais que autorizam e fundamentam esta contratação">
        <Textarea rows={3} value={form.fundamentacaoLegal} onChange={e => set("fundamentacaoLegal", e.target.value)} placeholder="Art. 40 c/c Art. 6º, XXIII da Lei 14.133/2021; IN SEGES nº 58/2022; ..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Modalidade de Licitação Prevista">
          <Select value={form.modalidadePrevista} onValueChange={v => set("modalidadePrevista", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pregao_eletronico">Pregão Eletrônico</SelectItem>
              <SelectItem value="concorrencia">Concorrência</SelectItem>
              <SelectItem value="concurso">Concurso</SelectItem>
              <SelectItem value="leilao">Leilão</SelectItem>
              <SelectItem value="dialogo_competitivo">Diálogo Competitivo</SelectItem>
              <SelectItem value="dispensa_valor">Dispensa de Licitação — valor</SelectItem>
              <SelectItem value="dispensa_outro">Dispensa — outro fundamento</SelectItem>
              <SelectItem value="inexigibilidade">Inexigibilidade</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Tipo de Contratação">
          <Select value={form.tipoContratacao} onValueChange={v => set("tipoContratacao", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nova">Nova contratação</SelectItem>
              <SelectItem value="renovacao">Renovação</SelectItem>
              <SelectItem value="prorrogacao">Prorrogação</SelectItem>
              <SelectItem value="arp">Adesão a ARP vigente</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
    </div>
  );
}

function Sec3({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <FL label="Especificações Técnicas Detalhadas" req campo="especificacoesTecnicas" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 40, III — Descrição técnica completa de todos os itens, incluindo marca de referência (se aplicável)">
        <Textarea rows={6} value={form.especificacoesTecnicas} onChange={e => set("especificacoesTecnicas", e.target.value)} placeholder="Item 1: [nome do produto/serviço]&#10;  — Características: [especificações técnicas detalhadas]&#10;  — Quantidade: [qtd] [unidade]&#10;  — Padrão de qualidade: [referência]&#10;&#10;Item 2: ..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Normas Técnicas Aplicáveis" campo="normasTecnicas" suggesting={suggesting} onSuggest={onSuggest}>
          <Textarea rows={3} value={form.normasTecnicas} onChange={e => set("normasTecnicas", e.target.value)} placeholder="ABNT NBR 00000, ISO 00000, regulamentos INMETRO..." />
        </FL>
        <FL label="Requisitos de Sustentabilidade" campo="sustentabilidade" suggesting={suggesting} onSuggest={onSuggest}
          tip="IN 01/2010, Decreto 7.746/2012 e legislação ambiental aplicável">
          <Textarea rows={3} value={form.sustentabilidade} onChange={e => set("sustentabilidade", e.target.value)} placeholder="Requisitos de eficiência energética, descarte ambientalmente correto, certificações ambientais..." />
        </FL>
      </div>
      <FL label="Habilitação Técnica" req campo="habilitacaoTecnica" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 67 da Lei 14.133/2021 — Atestados de capacidade técnica operacional ou profissional">
        <Textarea rows={3} value={form.habilitacaoTecnica} onChange={e => set("habilitacaoTecnica", e.target.value)} placeholder="Atestado de capacidade técnica emitido por pessoa jurídica de direito público ou privado, comprovando execução de serviços/fornecimento de bens de natureza semelhante, com as seguintes características mínimas: ..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Habilitação Jurídica" tip="Documentos de regularidade jurídica conforme Art. 66">
          <Textarea rows={2} value={form.habilitacaoJuridica} onChange={e => set("habilitacaoJuridica", e.target.value)} placeholder="CNPJ, contrato social, ato constitutivo, registro em junta comercial..." />
        </FL>
        <FL label="Qualificação Econômico-Financeira" campo="qualificacaoFinanceira" suggesting={suggesting} onSuggest={onSuggest}
          tip="Art. 69 — Balanço patrimonial, certidões negativas, capital social mínimo">
          <Textarea rows={2} value={form.qualificacaoFinanceira} onChange={e => set("qualificacaoFinanceira", e.target.value)} placeholder="Capital social mínimo de R$ X ou patrimônio líquido de X% do valor contratual..." />
        </FL>
      </div>
      <FL label="Índices Financeiros Mínimos" tip="LC (Liquidez Corrente), LG (Liquidez Geral), SG (Solvência Geral) — índices ≥ 1,0">
        <Input value={form.indices} onChange={e => set("indices", e.target.value)} placeholder="LC ≥ 1,0 | LG ≥ 1,0 | SG ≥ 1,0 (conforme balanço patrimonial do último exercício)" />
      </FL>
      <FL label="Exige Amostra Prévia?">
        <Select value={form.amostra} onValueChange={v => set("amostra", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nao">Não exige amostra</SelectItem>
            <SelectItem value="sim_proposta">Sim — amostra na fase de proposta</SelectItem>
            <SelectItem value="sim_classificacao">Sim — amostra na fase de classificação</SelectItem>
          </SelectContent>
        </Select>
      </FL>
    </div>
  );
}

function Sec4({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <FL label="Prazo de Execução" req>
          <Input value={form.prazoExecucao} onChange={e => set("prazoExecucao", e.target.value)} placeholder="Ex: 30" type="number" min={1} />
        </FL>
        <FL label="Unidade do Prazo">
          <Select value={form.unidadePrazo} onValueChange={v => set("unidadePrazo", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dias_corridos">Dias corridos</SelectItem>
              <SelectItem value="dias_uteis">Dias úteis</SelectItem>
              <SelectItem value="meses">Meses</SelectItem>
              <SelectItem value="anos">Anos</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Forma de Entrega">
          <Select value={form.formaEntrega} onValueChange={v => set("formaEntrega", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="integral">Integral — entrega única</SelectItem>
              <SelectItem value="parcial">Parcial — entregas programadas</SelectItem>
              <SelectItem value="sob_demanda">Sob demanda — conforme solicitação</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
      <FL label="Local de Execução / Entrega" req>
        <Textarea rows={2} value={form.localExecucao} onChange={e => set("localExecucao", e.target.value)} placeholder="Endereço completo do local de entrega ou execução dos serviços, incluindo CEP, cidade e estado..." />
      </FL>
      <FL label="Cronograma de Etapas" campo="cronograma" suggesting={suggesting} onSuggest={onSuggest}
        tip="Fases de execução, marcos e prazos intermediários">
        <Textarea rows={4} value={form.cronograma} onChange={e => set("cronograma", e.target.value)} placeholder="Etapa 1 — [descrição]: até D+10&#10;Etapa 2 — [descrição]: até D+20&#10;Etapa 3 — Entrega final: até D+30" />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Subcontratação">
          <Select value={form.subcontratacao} onValueChange={v => set("subcontratacao", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proibida">Proibida</SelectItem>
              <SelectItem value="permitida_total">Permitida — sem restrição de percentual</SelectItem>
              <SelectItem value="permitida_parcial">Permitida parcialmente (informar %)</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Percentual Máx. de Subcontratação" tip="Informe se permitida parcialmente">
          <Input value={form.percentualSubcontratacao} onChange={e => set("percentualSubcontratacao", e.target.value)} placeholder="Ex: até 30% do valor total" />
        </FL>
      </div>
      <FL label="Condições Especiais de Execução">
        <Textarea rows={2} value={form.condicoesEspeciais} onChange={e => set("condicoesEspeciais", e.target.value)} placeholder="Horários permitidos, restrições de acesso, requisitos de segurança no trabalho, NR aplicáveis..." />
      </FL>
    </div>
  );
}

function Sec5({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Fiscal Técnico do Contrato" tip="Art. 117 — Servidor designado para acompanhar a execução técnica">
          <Input value={form.fiscalTecnico} onChange={e => set("fiscalTecnico", e.target.value)} placeholder="Nome / cargo (a designar conforme portaria)" />
        </FL>
        <FL label="Fiscal Administrativo do Contrato" tip="Servidor responsável pelos aspectos administrativos do contrato">
          <Input value={form.fiscalAdministrativo} onChange={e => set("fiscalAdministrativo", e.target.value)} placeholder="Nome / cargo (a designar conforme portaria)" />
        </FL>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <FL label="Recebimento Provisório" req tip="Prazo em dias úteis para aceite provisório — Art. 140, I">
          <Input value={form.recebimentoProvisorio} onChange={e => set("recebimentoProvisorio", e.target.value)} placeholder="Ex: 5 dias" />
        </FL>
        <FL label="Recebimento Definitivo" req tip="Prazo em dias úteis para aceite definitivo — Art. 140, II">
          <Input value={form.recebimentoDefinitivo} onChange={e => set("recebimentoDefinitivo", e.target.value)} placeholder="Ex: 30 dias" />
        </FL>
        <FL label="Prazo de Pagamento">
          <Select value={form.prazoPagamento} onValueChange={v => set("prazoPagamento", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 dias úteis</SelectItem>
              <SelectItem value="30">30 dias corridos</SelectItem>
              <SelectItem value="outro">Outro prazo</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Forma de Pagamento">
          <Select value={form.formaPagamento} onValueChange={v => set("formaPagamento", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ordem_bancaria">Ordem bancária</SelectItem>
              <SelectItem value="nota_de_empenho">Nota de empenho</SelectItem>
              <SelectItem value="cartao_pgto">Cartão de pagamento</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
      <FL label="Critério de Medição e Aferição" req campo="criterioMedicao" suggesting={suggesting} onSuggest={onSuggest}
        tip="Como será mensurada a execução para fins de pagamento (por item entregue, por hora trabalhada, por resultado, etc.)">
        <Textarea rows={4} value={form.criterioMedicao} onChange={e => set("criterioMedicao", e.target.value)} placeholder="A medição será realizada mediante [critério]: verificação do [parâmetro], comprovada por [instrumento de aferição]..." />
      </FL>
      <FL label="Documentos de Cobrança" tip="Documentos exigidos para apresentação da fatura">
        <Textarea rows={2} value={form.documentosCobranca} onChange={e => set("documentosCobranca", e.target.value)} placeholder="Nota fiscal/fatura, relatório de execução, certidões de regularidade fiscal, relatório de medição..." />
      </FL>
    </div>
  );
}

function Sec6({ form, set }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Modalidade Licitatória" req tip="Art. 28 da Lei 14.133/2021">
          <Select value={form.modalidade} onValueChange={v => set("modalidade", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione a modalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pregao_eletronico">Pregão Eletrônico</SelectItem>
              <SelectItem value="pregao_presencial">Pregão Presencial</SelectItem>
              <SelectItem value="concorrencia_eletronico">Concorrência Eletrônica</SelectItem>
              <SelectItem value="concorrencia_presencial">Concorrência Presencial</SelectItem>
              <SelectItem value="concurso">Concurso</SelectItem>
              <SelectItem value="leilao">Leilão</SelectItem>
              <SelectItem value="dialogo_competitivo">Diálogo Competitivo</SelectItem>
              <SelectItem value="dispensa">Dispensa de Licitação</SelectItem>
              <SelectItem value="inexigibilidade">Inexigibilidade de Licitação</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Critério de Julgamento" req tip="Art. 33 da Lei 14.133/2021">
          <Select value={form.criterioJulgamento} onValueChange={v => set("criterioJulgamento", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o critério" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="menor_preco">Menor Preço</SelectItem>
              <SelectItem value="maior_desconto">Maior Desconto</SelectItem>
              <SelectItem value="melhor_tecnica">Melhor Técnica ou Conteúdo Artístico</SelectItem>
              <SelectItem value="tecnica_preco">Técnica e Preço</SelectItem>
              <SelectItem value="maior_oferta">Maior Oferta</SelectItem>
              <SelectItem value="maior_retorno">Maior Retorno Econômico</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Modo de Disputa" req tip="Art. 56 da Lei 14.133/2021">
          <Select value={form.modoDisputa} onValueChange={v => set("modoDisputa", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o modo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Aberto — lances públicos sucessivos</SelectItem>
              <SelectItem value="fechado">Fechado — proposta única sigilosa</SelectItem>
              <SelectItem value="aberto_fechado">Aberto e Fechado — combinado</SelectItem>
              <SelectItem value="fechado_aberto">Fechado e Aberto — combinado</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Validade da Proposta (dias)" tip="Prazo de validade das propostas — mínimo 60 dias, salvo justificativa">
          <Input value={form.validadeProposta} onChange={e => set("validadeProposta", e.target.value)} placeholder="Ex: 60 dias" type="number" min={1} />
        </FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Exige Amostra Prévia?">
          <Select value={form.exigeAmostraPrevia} onValueChange={v => set("exigeAmostraPrevia", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não exige</SelectItem>
              <SelectItem value="sim">Sim — mediante edital</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Exige Carta de Solidariedade?" tip="Para bens com marca específica ou importados">
          <Select value={form.exigeCartaSolidariedade} onValueChange={v => set("exigeCartaSolidariedade", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não exige</SelectItem>
              <SelectItem value="sim">Sim — do fabricante</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
    </div>
  );
}

function Sec7({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Valor Total Estimado (R$)" req>
          <Input value={form.valorEstimado} onChange={e => set("valorEstimado", e.target.value)} placeholder="Ex: 250.000,00" />
        </FL>
        <FL label="Valor Máximo por Item" tip="Tabela com preços unitários máximos aceitos">
          <Textarea rows={2} value={form.valorMaximoUnitario} onChange={e => set("valorMaximoUnitario", e.target.value)} placeholder="Item 1: R$ X,XX | Item 2: R$ X,XX | ..." />
        </FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Programa de Trabalho" tip="Código de programa de trabalho (orçamento público)">
          <Input value={form.programaTrabalho} onChange={e => set("programaTrabalho", e.target.value)} placeholder="Ex: 04.122.2098.8517.0001" />
        </FL>
        <FL label="Elemento de Despesa" tip="Natureza da despesa no orçamento">
          <Input value={form.elementoDespesa} onChange={e => set("elementoDespesa", e.target.value)} placeholder="Ex: 3.3.90.30.00 (material de consumo)" />
        </FL>
      </div>
      <FL label="Obrigações da Contratada" req campo="obrigacoesContratada" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 40, XI — Liste todas as obrigações da empresa contratada">
        <Textarea rows={5} value={form.obrigacoesContratada} onChange={e => set("obrigacoesContratada", e.target.value)} placeholder="I — Executar o objeto conforme especificações deste TR;&#10;II — Manter preposto disponível durante a execução;&#10;III — Reparar, corrigir ou substituir, às suas expensas, os bens/serviços com defeitos;&#10;IV — ..." />
      </FL>
      <FL label="Obrigações da Contratante" req campo="obrigacoesContratante" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 40, XI — Liste todas as obrigações do órgão contratante">
        <Textarea rows={4} value={form.obrigacoesContratante} onChange={e => set("obrigacoesContratante", e.target.value)} placeholder="I — Efetuar o pagamento nas condições e prazos estabelecidos;&#10;II — Fornecer as informações e condições necessárias à execução;&#10;III — Designar servidor para fiscalização;&#10;IV — ..." />
      </FL>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FL label="Garantia Contratual" tip="Art. 96 — 5% ou até 10% em casos especiais">
          <Select value={form.garantia} onValueChange={v => set("garantia", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dispensada">Dispensada</SelectItem>
              <SelectItem value="5pct">5% do valor contratual</SelectItem>
              <SelectItem value="10pct">10% — risco elevado</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        <FL label="Vigência Contratual (meses)" tip="Prazo total do contrato incluindo possíveis prorrogações">
          <Input value={form.vigenciaContrato} onChange={e => set("vigenciaContrato", e.target.value)} placeholder="Ex: 12 meses" type="number" min={1} />
        </FL>
        <FL label="Possibilidade de Prorrogação?" tip="Art. 107 para serviços continuados — até 10 anos">
          <Select value={form.prorrogacao} onValueChange={v => set("prorrogacao", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não prevista</SelectItem>
              <SelectItem value="sim_105">Sim — Art. 105 (bens e serviços)</SelectItem>
              <SelectItem value="sim_107">Sim — Art. 107 (serviços continuados)</SelectItem>
            </SelectContent>
          </Select>
        </FL>
      </div>
      <FL label="Sanções Administrativas" req campo="sancoes" suggesting={suggesting} onSuggest={onSuggest}
        tip="Art. 155-163 da Lei 14.133/2021 — infração, sanção, percentuais e prazo">
        <Textarea rows={4} value={form.sancoes} onChange={e => set("sancoes", e.target.value)} placeholder="Conforme Arts. 155 a 163 da Lei 14.133/2021:&#10;I — Advertência: [hipótese];&#10;II — Multa moratória de X% ao dia de atraso;&#10;III — Multa compensatória de X% sobre o valor total;&#10;IV — Impedimento de licitar por até 3 anos;&#10;V — Declaração de inidoneidade por até 6 anos." />
      </FL>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function TRGeneratorPage() {
  const [section, setSection] = useState(1);
  const [form, setForm] = useState<TRForm>(FORM0);
  const [aiContent, setAiContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const set = useCallback((field: keyof TRForm, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
  }, []);

  const sectionStatus = useMemo(() => SECTIONS.map(s => {
    const filled = s.required.filter(f => form[f as keyof TRForm]?.trim());
    return { filled: filled.length, total: s.required.length };
  }), [form]);

  const pct = useMemo(() => {
    const all = SECTIONS.flatMap(s => s.required);
    const filled = all.filter(f => form[f as keyof TRForm]?.trim());
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
        body: JSON.stringify({ tipo: "sugestao", formData: { campo, tipoDocumento: "TR", contexto: form } }),
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
    if (pct < 30) { toast.warning("Preencha pelo menos os campos obrigatórios essenciais (órgão, objeto, seleção do fornecedor)."); return; }
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
        body: JSON.stringify({ tipo: "tr", formData: form, stream: true }),
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
        toast.success("TR gerado com sucesso!");
      }
    } catch { toast.error("Erro ao gerar o TR. Tente novamente."); }
    finally { setGenerating(false); }
  }, [form, pct]);

  const handleApplyForecast = (forecast: ForecastData) => {
    if (forecast.objeto) set("objeto", forecast.objeto);
    if (forecast.justificativa) set("fundamentacaoLegal", forecast.justificativa);
    if (forecast.requisitos.length > 0) set("especificacoesTecnicas", forecast.requisitos.join("\n"));
    if (forecast.valorTotal > 0) set("valorEstimado", forecast.valorTotal.toFixed(2));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      await supabase.from("documents").insert({
        user_id: user.id, tipo: "tr",
        titulo: `TR — ${form.objeto?.slice(0, 60) || form.orgao || "Sem objeto"}`,
        orgao: form.orgao, objeto: form.objeto,
        conteudo: aiContent, form_data: form,
        status: aiContent ? "finalizado" : "rascunho",
      });
      toast.success("TR salvo com sucesso!");
    } catch { toast.error("Erro ao salvar. Tente novamente."); }
    finally { setSaving(false); }
  };

  const handleExport = (format: "pdf" | "docx" = "pdf") => {
    if (!aiContent) return;
    const opts = {
      documentTitle: `TR — ${form.objeto?.slice(0, 60) || form.orgao || "Termo de Referência"}`,
      orgao: form.orgao,
      legalBasis: "Lei nº 14.133/2021 · Art. 6º, XXIII e Art. 40",
      sections: [{ title: "", isMarkdown: true, content: aiContent }],
    };
    if (format === "docx") exportAsDocx(opts);
    else exportAsPdf(opts);
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
              <h1 className="text-xl font-bold">Termo de Referência</h1>
              <p className="text-xs text-muted-foreground">Art. 6º, XXIII e Art. 40 · Lei 14.133/2021</p>
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
              {generating ? "Gerando..." : "Gerar TR com IA"}
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

        {/* Relatórios históricos + previsão IA */}
        <HistoricalReportsSection
          documentType="tr"
          orgao={form.orgao}
          accent="amber"
          onApply={handleApplyForecast}
        />

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr_400px] gap-4">

          {/* Sidebar */}
          <nav className="rounded-xl border border-border bg-card p-2 h-fit lg:sticky lg:top-20">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Seções do TR</p>
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
                      <p className={cn("text-xs font-medium truncate", active ? "text-amber-500" : done ? "text-emerald-500" : "text-muted-foreground")}>{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{st.filled}/{st.total} obr.</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compliance checklist */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conformidade Art. 40</p>
              <div className="space-y-0.5">
                {COMPLIANCE.map(({ label, field }) => {
                  const ok = !!form[field as keyof TRForm]?.trim();
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
                  Gerar TR
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
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleExport("pdf")} title="Exportar PDF">
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleExport("docx")} title="Exportar Word">
                      <Download className="h-3.5 w-3.5" /> Word
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
                    Claude está redigindo o TR...
                  </div>
                  {aiContent && (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>h1]:text-sm [&>h2]:text-xs [&>p]:text-xs [&>p]:leading-relaxed [&>ul]:text-xs [&>ol]:text-xs">
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
                      Preencha as seções e clique em "Gerar TR com IA"
                    </p>
                  </div>
                  {pct > 0 && (
                    <div className="text-xs text-left space-y-1 mt-1 w-full max-w-[200px]">
                      {form.orgao && <p><span className="text-muted-foreground">Órgão:</span> {form.orgao}</p>}
                      {form.naturezaObjeto && <p><span className="text-muted-foreground">Natureza:</span> {form.naturezaObjeto}</p>}
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
