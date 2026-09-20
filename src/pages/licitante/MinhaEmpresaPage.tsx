import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase, Search, Loader2, CheckCircle2, AlertTriangle, MapPin, Users, Tag,
  RefreshCw, Save, Sparkles, Info, Radar, Mail, Calendar, Landmark, Scale,
} from "lucide-react";
import {
  type EmpresaDados, consultarCnpj, formatarCnpj, formatarMoeda, formatarData, montarPerfilEmpresa, somenteDigitos,
} from "@/lib/empresa";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// Página "Minha empresa": tudo começa pelo CNPJ. Buscamos na Receita Federal
// os dados do cartão CNPJ, mostramos por completo e montamos o perfil que o
// Match IA, os alertas e a habilitação usam.
export default function MinhaEmpresaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cnpjInput, setCnpjInput] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [dados, setDados] = useState<EmpresaDados | null>(null);
  const [complemento, setComplemento] = useState("");
  const [alertaUf, setAlertaUf] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCarregado(true); return; }
      const { data } = await supabase
        .from("profiles")
        .select("empresa_cnpj, empresa_dados, empresa_complemento, empresa_perfil, alerta_uf")
        .eq("id", user.id)
        .single();
      const d = data as Record<string, unknown> | null;
      if (d?.empresa_dados) setDados(d.empresa_dados as EmpresaDados);
      if (d?.empresa_cnpj) setCnpjInput(formatarCnpj(String(d.empresa_cnpj)));
      // Quem já tinha um perfil em texto (antes do CNPJ) continua com ele como complemento.
      if (d?.empresa_complemento) setComplemento(String(d.empresa_complemento));
      else if (!d?.empresa_dados && d?.empresa_perfil) setComplemento(String(d.empresa_perfil));
      if (d?.alerta_uf) setAlertaUf(String(d.alerta_uf));
      setCarregado(true);
    })();
  }, []);

  const buscar = async () => {
    setBuscando(true);
    try {
      const d = await consultarCnpj(cnpjInput);
      setDados(d);
      setCnpjInput(formatarCnpj(d.cnpj));
      setAlterado(true);
      toast({
        title: "Dados encontrados na Receita Federal",
        description: d.ativo
          ? "Confira abaixo, complete o que sua empresa fornece e salve."
          : `Atenção: situação cadastral "${d.situacaoCadastral}". Confira os dados antes de salvar.`,
      });
    } catch (err: any) {
      toast({ title: "Não foi possível consultar o CNPJ", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setBuscando(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const perfil = montarPerfilEmpresa(dados, complemento);
      const patch: Record<string, unknown> = {
        empresa_cnpj: dados?.cnpj ? somenteDigitos(dados.cnpj) : (somenteDigitos(cnpjInput) || null),
        empresa_dados: dados,
        empresa_complemento: complemento.trim() || null,
        empresa_perfil: perfil || null,
      };
      if (!alertaUf && dados?.uf && UFS.includes(dados.uf)) { patch.alerta_uf = dados.uf; setAlertaUf(dados.uf); }
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        setSalvando(false);
        return;
      }
    }
    setSalvando(false);
    setAlterado(false);
    toast({ title: "Empresa salva", description: "O Match IA e os alertas já usam estes dados." });
  };

  const Campo = ({ rotulo, valor, icon: Icon }: { rotulo: string; valor?: string | null; icon?: React.ElementType }) =>
    valor ? (
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
          {Icon && <Icon className="w-3 h-3" />} {rotulo}
        </p>
        <p className="text-sm text-foreground break-words">{valor}</p>
      </div>
    ) : null;

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1000px] mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Minha empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo começa pelo CNPJ. Com ele, a Intelicite busca os dados da sua empresa na Receita Federal e usa
            isso para encontrar as licitações certas para você.
          </p>
        </div>

        {/* CNPJ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 mb-5 shadow-card">
          <p className="text-sm font-semibold text-foreground mb-1">CNPJ da empresa</p>
          <p className="text-xs text-muted-foreground mb-3">
            Digite só os números. Buscamos na Receita Federal os mesmos dados do cartão CNPJ: razão social,
            situação, atividades (CNAE), endereço e sócios. Não é preciso enviar nenhum documento.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={cnpjInput}
              onChange={(e) => setCnpjInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              className="sm:max-w-xs"
              disabled={!carregado}
            />
            <Button className="gap-2 h-10" onClick={buscar} disabled={buscando || !carregado}>
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : dados ? <RefreshCw className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {dados ? "Atualizar dados" : "Buscar na Receita Federal"}
            </Button>
          </div>
        </motion.div>

        {/* Por que o CNPJ (só antes de ter dados) */}
        {carregado && !dados && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-5">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Info className="w-4 h-4 text-primary" /> Por que pedimos o CNPJ?
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li><strong className="text-foreground">Match IA:</strong> com as suas atividades (CNAE), a IA sabe o que você pode fornecer e pontua cada licitação.</li>
              <li><strong className="text-foreground">Alertas:</strong> avisamos só sobre editais que combinam com a sua empresa e o seu estado.</li>
              <li><strong className="text-foreground">Habilitação:</strong> conferimos se a situação cadastral está ativa — exigência para participar.</li>
            </ul>
          </div>
        )}

        {/* Dados da Receita */}
        {dados && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-5 mb-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground leading-tight">{dados.razaoSocial}</p>
                {dados.nomeFantasia && dados.nomeFantasia !== dados.razaoSocial && (
                  <p className="text-sm text-muted-foreground">{dados.nomeFantasia}</p>
                )}
                <p className="text-sm text-muted-foreground font-mono mt-0.5">{formatarCnpj(dados.cnpj)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                dados.ativo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}>
                {dados.ativo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {dados.situacaoCadastral || (dados.ativo ? "ATIVA" : "IRREGULAR")}
              </span>
            </div>

            {!dados.ativo && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-4 text-xs text-red-700 dark:text-red-400 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  A situação cadastral não está ativa. Para participar de licitações a empresa precisa estar regular na
                  Receita Federal — regularize antes de enviar propostas.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <Campo rotulo="Abertura" valor={formatarData(dados.dataAbertura)} icon={Calendar} />
              <Campo rotulo="Porte" valor={dados.porte} icon={Landmark} />
              <Campo rotulo="Capital social" valor={dados.capitalSocial ? formatarMoeda(dados.capitalSocial) : ""} icon={Scale} />
              <Campo rotulo="Natureza jurídica" valor={dados.naturezaJuridica} />
              <Campo rotulo="Endereço" valor={[dados.logradouro, [dados.municipio, dados.uf].filter(Boolean).join("/"), dados.cep].filter(Boolean).join(" · ")} icon={MapPin} />
              <Campo rotulo="E-mail (Receita)" valor={dados.email} icon={Mail} />
            </div>

            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Atividades (CNAE)
              </p>
              {dados.cnaePrincipal && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Principal</p>
                  <p className="text-sm text-foreground"><span className="font-mono text-muted-foreground">{dados.cnaePrincipal.codigo}</span> — {dados.cnaePrincipal.descricao}</p>
                </div>
              )}
              {dados.cnaesSecundarios.length > 0 ? (
                <ul className="space-y-1">
                  {dados.cnaesSecundarios.map((c) => (
                    <li key={c.codigo} className="text-sm text-foreground px-3 py-1.5 rounded-lg bg-muted/40">
                      <span className="font-mono text-muted-foreground">{c.codigo}</span> — {c.descricao}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem atividades secundárias cadastradas.</p>
              )}
            </div>

            {dados.socios.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Sócios e administradores
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {dados.socios.map((s, i) => (
                    <li key={i} className="text-sm text-foreground px-3 py-1.5 rounded-lg bg-muted/40">
                      {s.nome}{s.qualificacao ? <span className="text-xs text-muted-foreground"> — {s.qualificacao}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Fonte: Receita Federal (via BrasilAPI)
              {dados.consultadoEm ? ` · consultado em ${new Date(dados.consultadoEm).toLocaleString("pt-BR")}` : ""}.
              Algo desatualizado? Clique em "Atualizar dados".
            </p>
          </motion.div>
        )}

        {/* Complemento */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 mb-5 shadow-card">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4 text-primary" /> O que sua empresa fornece
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Em linguagem simples: produtos, serviços, marcas, regiões que atende. O CNAE diz a atividade oficial;
            aqui você conta o que faz de verdade — e a IA acerta mais o match.
          </p>
          <Textarea
            value={complemento}
            onChange={(e) => { setComplemento(e.target.value); setAlterado(true); }}
            rows={4}
            placeholder="Ex.: Vendemos notebooks, servidores e licenças de software para prefeituras e escolas. Atendemos SP, MG e RJ. Temos equipe própria de instalação."
          />
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {alterado ? "Você tem alterações não salvas." : dados ? "Tudo salvo." : ""}
          </p>
          <div className="flex gap-2">
            {dados && (
              <Button variant="outline" className="gap-2" onClick={() => navigate("/licitante/radar")}>
                <Radar className="w-4 h-4" /> Ir para o Radar
              </Button>
            )}
            <Button className="gap-2" onClick={salvar} disabled={salvando || !carregado || (!dados && !complemento.trim())}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
