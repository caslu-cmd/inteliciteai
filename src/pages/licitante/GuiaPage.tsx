import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Radar, Gavel, Building2, FileCheck, Trophy, Rocket,
  CheckCircle2, XCircle, ArrowRight, Lightbulb,
} from "lucide-react";

const PASSOS = [
  { n: 1, titulo: "Ache uma oportunidade", texto: "Todo dia o governo publica milhares de “editais” (avisos de compra). O Intelicite mostra os que combinam com o que a sua empresa vende.", como: "No Radar, com o Match IA.", icon: Radar, rota: "/licitante/radar" },
  { n: 2, titulo: "Entenda o edital", texto: "O edital é o documento com as regras da disputa. É longo e cheio de termos — mas você não precisa ler tudo.", como: "O Parecer IA lê por você e explica riscos, prazos e o que exigem.", icon: Gavel, rota: "/licitante/parecer" },
  { n: 3, titulo: "Veja se você pode participar", texto: "“Habilitação” é a lista de documentos que provam que sua empresa está regular (CNPJ, certidões).", como: "O Verificador de Habilitação confere isso pra você.", icon: Building2, rota: "/licitante/habilitacao" },
  { n: 4, titulo: "Prepare e envie sua proposta", texto: "Você diz por quanto faria o serviço/entrega. Geralmente vence o menor preço que cumpre as regras.", como: "A Precificação IA te ajuda a chegar num preço competitivo.", icon: FileCheck, rota: "/licitante/precificacao" },
  { n: 5, titulo: "Dispute e vença", texto: "Na maioria dos casos a disputa é online (“pregão eletrônico”), num portal do governo. Se você faz a melhor oferta, ganha o contrato.", como: "O Intelicite te avisa dos prazos e da sessão.", icon: Trophy, rota: "/licitante/radar" },
];

const GLOSSARIO = [
  { termo: "Edital", def: "O “manual” da licitação: descreve o que o governo quer comprar e todas as regras para participar." },
  { termo: "Pregão eletrônico", def: "O tipo de disputa mais comum, feita 100% pela internet, num portal do governo." },
  { termo: "PNCP", def: "Portal Nacional de Contratações Públicas — o site oficial onde todos os editais são publicados." },
  { termo: "Habilitação", def: "Os documentos que provam que sua empresa está regular e pode assinar o contrato (CNPJ, certidões)." },
  { termo: "Proposta", def: "Sua oferta: o preço e as condições pelas quais você faria o fornecimento ou serviço." },
  { termo: "Impugnação", def: "Um pedido formal para corrigir uma regra do edital que esteja errada ou injusta, antes da disputa." },
  { termo: "ME / EPP", def: "Microempresa e Empresa de Pequeno Porte. Têm vantagens na disputa (Lei Complementar 123/2006)." },
  { termo: "Homologação", def: "O momento final em que o governo confirma o vencedor e o contrato pode ser assinado." },
];

const PRECISO = [
  "CNPJ ativo (a empresa pode ser MEI, ME, EPP ou maior)",
  "Certidões de regularidade (fiscal, trabalhista, FGTS) — o Intelicite te mostra quais",
  "Cadastro no portal de compras usado no edital (ex.: Compras.gov)",
  "Em alguns casos, atestados de que você já fez algo parecido",
];

const MITOS = [
  { mito: "“Preciso ser advogado ou especialista.”", verdade: "Não. A IA lê os documentos e explica em linguagem simples — foi feita pra quem está começando." },
  { mito: "“É só para empresas grandes.”", verdade: "Pelo contrário: a lei dá vantagens para ME/EPP, e muita compra do governo é pequena." },
  { mito: "“O governo não paga / demora demais.”", verdade: "O pagamento é previsto em contrato e por lei. É uma das vendas mais seguras que existem." },
];

export default function GuiaPage() {
  const navigate = useNavigate();
  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[900px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" /> Entenda licitações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sem juridiquês. Do zero até o seu primeiro contrato com o governo — no seu tempo.
          </p>
        </div>

        {/* O que é */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6 shadow-card mb-6">
          <h2 className="font-display font-bold text-lg text-foreground mb-2">O que é uma licitação?</h2>
          <p className="text-sm text-card-foreground leading-relaxed">
            Quando o governo precisa comprar algo (comida, informática, limpeza, obras) ou contratar um serviço,
            ele <strong>não pode escolher a empresa que quiser</strong>. Por lei, ele faz uma <strong>disputa aberta e justa</strong> —
            e quem oferece a melhor proposta ganha o contrato. Essa disputa é a <strong>licitação</strong>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            O governo é o <strong>maior comprador do Brasil</strong>. A sua empresa pode vender para ele — com regras claras
            e pagamento garantido. O Intelicite existe para te guiar em cada passo disso.
          </p>
        </motion.div>

        {/* Passo a passo */}
        <h2 className="font-display font-bold text-lg text-foreground mb-3 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" /> Como participar — passo a passo
        </h2>
        <div className="space-y-3 mb-8">
          {PASSOS.map((p, i) => (
            <motion.div key={p.n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border border-border p-4 shadow-card flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 text-white font-bold">
                {p.n}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-card-foreground flex items-center gap-2">
                  <p.icon className="w-4 h-4 text-primary" /> {p.titulo}
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.texto}</p>
                <button onClick={() => navigate(p.rota)}
                  className="text-xs text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> No Intelicite: {p.como}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* O que preciso ter */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-card mb-6">
          <h2 className="font-display font-bold text-lg text-foreground mb-3">O que preciso ter para participar</h2>
          <ul className="space-y-2">
            {PRECISO.map((item, i) => (
              <li key={i} className="text-sm text-card-foreground flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Glossário */}
        <h2 className="font-display font-bold text-lg text-foreground mb-3">As palavras que você vai ouvir</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {GLOSSARIO.map((g) => (
            <div key={g.termo} className="bg-card rounded-xl border border-border p-4 shadow-card">
              <p className="text-sm font-semibold text-primary">{g.termo}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.def}</p>
            </div>
          ))}
        </div>

        {/* Mitos */}
        <h2 className="font-display font-bold text-lg text-foreground mb-3">Mitos que travam muita gente</h2>
        <div className="space-y-3 mb-8">
          {MITOS.map((m, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 shadow-card">
              <p className="text-sm text-card-foreground flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" /><span className="line-through opacity-70">{m.mito}</span>
              </p>
              <p className="text-sm text-card-foreground flex items-start gap-2 mt-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /><span>{m.verdade}</span>
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="font-display font-bold text-lg text-foreground mb-1">Pronto para começar?</p>
          <p className="text-sm text-muted-foreground mb-4">Ache uma oportunidade que combina com a sua empresa — a IA cuida do resto.</p>
          <Button className="gap-2" onClick={() => navigate("/licitante/radar")}>
            Ver oportunidades no Radar <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Base legal: Lei 14.133/2021 (Nova Lei de Licitações). Este guia é educativo e não substitui orientação jurídica.
        </p>
      </div>
    </LicitanteLayout>
  );
}
