import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Search,
  Scale,
  ArrowRight,
  Clock,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const quickActions = [
  {
    title: "Criar ETP",
    description: "Gere um Estudo Técnico Preliminar",
    icon: FileText,
    path: "/dashboard/etp",
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Validar Edital",
    description: "Analise riscos em editais",
    icon: Search,
    path: "/dashboard/validator",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Chat com IA",
    description: "Consulte a Lei 14.133",
    icon: MessageSquare,
    path: "/dashboard/chat",
    color: "bg-success/10 text-success",
  },
  {
    title: "Diagnóstico",
    description: "Identifique a modalidade correta",
    icon: Scale,
    path: "/dashboard/diagnostic",
    color: "bg-gold-dark/10 text-gold-dark",
  },
];

const recentDocs = [
  { name: "ETP — Serviços de TI", date: "Há 2 horas", type: "ETP" },
  { name: "TR — Manutenção predial", date: "Ontem", type: "TR" },
  { name: "Edital PE 023/2026", date: "3 dias atrás", type: "Edital" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function DashboardHome() {
  return (
    <div className="max-w-6xl">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
        <h1 className="text-2xl font-bold">Bem-vindo ao Intelicite</h1>
        <p className="mt-1 text-muted-foreground">
          O que você gostaria de fazer hoje?
        </p>
      </motion.div>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, i) => (
          <motion.div key={action.title} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
            <Link
              to={action.path}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:shadow-navy hover:border-accent/30"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{action.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
              <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent documents */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-muted-foreground" />
            Documentos recentes
          </h2>
          <Link to="/dashboard/documents">
            <Button variant="ghost" size="sm">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {recentDocs.map((doc) => (
            <div
              key={doc.name}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                </div>
              </div>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {doc.type}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
