import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, BookOpen, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModuleAccess, type ModuleName } from "@/hooks/useModuleAccess";
import { motion } from "framer-motion";

const MODULE_INFO: Record<ModuleName, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  features: string[];
}> = {
  analise: {
    label: "Módulo Análise",
    description: "Gere ETP, TR, DFD, faça cotações e analise editais com IA",
    icon: Sparkles,
    color: "text-amber-500",
    features: ["Gerador ETP, TR e DFD", "Cotação inteligente", "Radar PNCP", "Scanner de editais"],
  },
  consulta: {
    label: "Módulo Consulta",
    description: "Chat jurídico 24/7 com base de conhecimento e regulamentos do órgão",
    icon: BookOpen,
    color: "text-blue-500",
    features: ["Chat com Lei 14.133/2021", "Notebook com RAG", "Regulamentos do órgão", "Assistente licitante"],
  },
  conformidade: {
    label: "Módulo Conformidade",
    description: "Valide editais, faça checklists e diagnósticos de modalidade",
    icon: ShieldCheck,
    color: "text-green-500",
    features: ["Validador de editais", "Checklist Lei 14.133", "Diagnóstico de modalidade", "Verificador de habilitação"],
  },
};

interface Props {
  module: ModuleName;
  children: React.ReactNode;
}

export function ModuleGuard({ module, children }: Props) {
  const access = useModuleAccess();
  const navigate = useNavigate();

  if (access.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!access[module]) {
    const info = MODULE_INFO[module];
    const Icon = info.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[60vh] p-8"
      >
        <div className="max-w-md w-full text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border mx-auto mb-5">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-bold mb-2">{info.label} bloqueado</h2>
          <p className="text-sm text-muted-foreground mb-6">{info.description}</p>

          <div className="rounded-xl border border-border bg-card p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Inclui</p>
            {info.features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${info.color}`} />
                {f}
              </div>
            ))}
          </div>

          <Button className="w-full gap-2" onClick={() => navigate("/dashboard/modulos")}>
            Desbloquear {info.label} <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Desbloqueie agora e use imediatamente. Cancele quando quiser.
          </p>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
