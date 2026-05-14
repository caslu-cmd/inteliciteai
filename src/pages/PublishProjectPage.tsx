import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Send, UserCheck, FileText, Handshake, Lock } from "lucide-react";

const CATEGORIES = [
  { value: "etp",         label: "ETP — Estudo Técnico Preliminar" },
  { value: "tr",          label: "TR — Termo de Referência" },
  { value: "dfd",         label: "DFD — Documento de Formalização da Demanda" },
  { value: "impugnacao",  label: "Impugnação de Edital" },
  { value: "pregao",      label: "Pregão Eletrônico" },
  { value: "dispensa",    label: "Dispensa de Licitação" },
  { value: "auditoria",   label: "Auditoria de Contratos" },
  { value: "gestao",      label: "Gestão Contratual" },
  { value: "consultoria", label: "Consultoria Geral" },
];

interface Form {
  title: string;
  description: string;
  category: string;
  budget_min: string;
  budget_max: string;
  deadline: string;
  requirements: string;
}

const EMPTY: Form = {
  title: "", description: "", category: "",
  budget_min: "", budget_max: "", deadline: "", requirements: "",
};

export default function PublishProjectPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const bMin = form.budget_min ? parseFloat(form.budget_min) : 0;
    const bMax = form.budget_max ? parseFloat(form.budget_max) : 0;
    if (form.budget_min && isNaN(bMin)) {
      toast({ title: "Orçamento mínimo inválido", variant: "destructive" }); return;
    }
    if (form.budget_max && isNaN(bMax)) {
      toast({ title: "Orçamento máximo inválido", variant: "destructive" }); return;
    }
    if (bMin > 0 && bMax > 0 && bMin > bMax) {
      toast({ title: "Orçamento mínimo não pode ser maior que o máximo", variant: "destructive" }); return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { error } = await supabase.from("marketplace_projects").insert({
      client_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      budget_min: Math.round(bMin * 100),
      budget_max: Math.round(bMax * 100),
      deadline: form.deadline || null,
      requirements: form.requirements.trim() || null,
    });

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao publicar projeto", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Projeto publicado com sucesso!" });
    navigate("/dashboard/meus-projetos");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
          <Briefcase className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Publicar Projeto</h1>
          <p className="text-sm text-muted-foreground">
            Descreva o que você precisa e receba propostas de consultores verificados
          </p>
        </div>
      </div>

      {/* Como funciona */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
        <p className="text-sm font-semibold text-amber-400">Como funciona o Marketplace</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: FileText,   step: "01", title: "Publique seu projeto",          desc: "Descreva o que precisa, informe orçamento e prazo." },
            { icon: UserCheck,  step: "02", title: "Receba propostas",              desc: "Consultores verificados enviam propostas com valor e prazo." },
            { icon: Handshake,  step: "03", title: "Escolha e contrate",            desc: "Compare e aceite a proposta que faz mais sentido." },
            { icon: Lock,       step: "04", title: "Pagamento seguro (escrow)",     desc: "O valor fica retido e só é liberado após a entrega." },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/20">
                <Icon className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground leading-snug">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground border-t border-amber-500/10 pt-3">
          A plataforma retém <strong className="text-foreground">20%</strong> do valor contratado como taxa de intermediação, paga pelo consultor. <strong className="text-foreground">Publicar projetos é gratuito.</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Título do Projeto <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Ex: Elaboração de ETP para contratação de software de gestão"
            value={form.title}
            onChange={set("title")}
            maxLength={120}
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>
            Categoria <span className="text-destructive">*</span>
          </Label>
          <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de serviço" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            Descrição do Projeto <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Descreva em detalhes o que você precisa que o consultor faça, o contexto e os objetivos..."
            value={form.description}
            onChange={set("description")}
            className="min-h-[120px] resize-none"
          />
        </div>

        {/* Budget */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget_min">Orçamento Mínimo (R$)</Label>
            <Input
              id="budget_min"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.budget_min}
              onChange={set("budget_min")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_max">Orçamento Máximo (R$)</Label>
            <Input
              id="budget_max"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.budget_max}
              onChange={set("budget_max")}
            />
          </div>
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <Label htmlFor="deadline">Prazo para Entrega</Label>
          <Input
            id="deadline"
            type="date"
            value={form.deadline}
            onChange={set("deadline")}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <Label htmlFor="requirements">Requisitos e Documentos</Label>
          <Textarea
            id="requirements"
            placeholder="Liste os requisitos obrigatórios, documentos que o consultor precisa ter, experiência mínima, etc."
            value={form.requirements}
            onChange={set("requirements")}
            className="min-h-[100px] resize-none"
          />
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">Como funciona</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Consultores verificados verão seu projeto e poderão enviar propostas</li>
            <li>Você seleciona a melhor proposta e fecha o contrato dentro da plataforma</li>
            <li>O pagamento é feito antecipadamente e liberado após confirmação de entrega</li>
            <li>A plataforma retém 20% do valor como taxa de serviço</li>
          </ul>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          <Send className="h-4 w-4 mr-2" />
          {loading ? "Publicando..." : "Publicar Projeto"}
        </Button>
      </form>
    </div>
  );
}
