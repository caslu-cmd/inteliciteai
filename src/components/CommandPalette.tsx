import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageSquare, FileText, Scale, CheckSquare, Calculator,
  BarChart3, CreditCard, Settings, BookMarked, FolderOpen, X,
  Radar, ScanLine, FileSearch, Building2, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  path: string;
  group: string;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  // Gestor
  { id: "chat", label: "Assistente Jurídico IA", description: "Chat sobre Lei 14.133/2021", icon: MessageSquare, path: "/dashboard/chat", group: "Agente Público" },
  { id: "etp", label: "Gerador de ETP", description: "Estudo Técnico Preliminar", icon: FileText, path: "/dashboard/etp", group: "Agente Público", keywords: "estudo tecnico preliminar" },
  { id: "tr", label: "Gerador de TR", description: "Termo de Referência", icon: FileText, path: "/dashboard/tr", group: "Agente Público", keywords: "termo referencia" },
  { id: "checklist", label: "Checklist", description: "Conformidade do processo licitatório", icon: CheckSquare, path: "/dashboard/checklist", group: "Agente Público" },
  { id: "diagnostic", label: "Diagnóstico de Modalidade", description: "Identificar modalidade de licitação", icon: Scale, path: "/dashboard/diagnostic", group: "Agente Público" },
  { id: "validator", label: "Validador de Editais", description: "Análise de conformidade de PDFs", icon: Search, path: "/dashboard/validator", group: "Agente Público" },
  { id: "quotation", label: "Cotação Inteligente", description: "Pesquisa de preços de mercado", icon: Calculator, path: "/dashboard/quotation", group: "Agente Público" },
  { id: "notebook", label: "Notebook IA", description: "Base de conhecimento jurídico", icon: BookMarked, path: "/dashboard/notebook", group: "Agente Público" },
  { id: "documents", label: "Meus Documentos", description: "Documentos salvos", icon: FolderOpen, path: "/dashboard/documents", group: "Agente Público" },
  { id: "reports", label: "Relatórios", description: "Uso e métricas da plataforma", icon: BarChart3, path: "/dashboard/reports", group: "Conta" },
  { id: "billing", label: "Billing", description: "Assinatura e pagamentos", icon: CreditCard, path: "/dashboard/billing", group: "Conta" },
  { id: "settings", label: "Configurações", description: "Configurações da conta", icon: Settings, path: "/dashboard/settings", group: "Conta" },
  // Licitante
  { id: "radar", label: "Radar de Oportunidades", description: "Licitações do PNCP em tempo real", icon: Radar, path: "/licitante/radar", group: "Licitante" },
  { id: "scanner", label: "Scanner de Editais", description: "Análise IA de PDFs de editais", icon: ScanLine, path: "/licitante/scanner", group: "Licitante" },
  { id: "analises", label: "Análises Salvas", description: "Histórico de análises de editais", icon: FileSearch, path: "/licitante/analises", group: "Licitante" },
  { id: "habilitacao", label: "Verificador de Habilitação", description: "Consulta CNPJ e certidões", icon: Building2, path: "/licitante/habilitacao", group: "Licitante" },
  { id: "minutas", label: "Gerador de Minutas", description: "Impugnações e esclarecimentos", icon: FileText, path: "/licitante/minutas", group: "Licitante" },
  // Consultor
  { id: "consultor", label: "Portal do Consultor", description: "Verificação e perfil profissional", icon: Shield, path: "/consultor", group: "Consultor" },
];

const GROUPS = ["Agente Público", "Licitante", "Consultor", "Conta"];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.trim()
    ? COMMANDS.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.keywords || "").includes(q) ||
          c.group.toLowerCase().includes(q)
        );
      })
    : COMMANDS;

  const grouped = query.trim()
    ? null
    : GROUPS.reduce((acc, group) => {
        const items = filtered.filter((c) => c.group === group);
        if (items.length) acc[group] = items;
        return acc;
      }, {} as Record<string, CommandItem[]>);

  const flatFiltered = grouped
    ? Object.values(grouped).flat()
    : filtered;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatFiltered[selectedIndex]) handleSelect(flatFiltered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-xl pointer-events-auto"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16, boxShadow: "0 24px 64px -12px rgba(0,0,0,0.5)" }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar ferramentas, páginas..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="overflow-y-auto max-h-[60vh] py-2">
                {flatFiltered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum resultado para "{query}"
                  </div>
                ) : grouped ? (
                  Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {group}
                      </p>
                      {items.map((item) => {
                        const globalIdx = flatFiltered.indexOf(item);
                        return (
                          <CommandRow
                            key={item.id}
                            item={item}
                            selected={selectedIndex === globalIdx}
                            onSelect={handleSelect}
                            onHover={() => setSelectedIndex(globalIdx)}
                          />
                        );
                      })}
                    </div>
                  ))
                ) : (
                  filtered.map((item, i) => (
                    <CommandRow
                      key={item.id}
                      item={item}
                      selected={selectedIndex === i}
                      onSelect={handleSelect}
                      onHover={() => setSelectedIndex(i)}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2.5 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> navegar</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">↵</kbd> selecionar</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">ESC</kbd> fechar</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandRow({
  item, selected, onSelect, onHover,
}: {
  item: CommandItem;
  selected: boolean;
  onSelect: (item: CommandItem) => void;
  onHover: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <button
      ref={ref}
      onClick={() => onSelect(item)}
      onMouseMove={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        selected ? "bg-accent/10" : "hover:bg-secondary/50"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        selected ? "bg-accent/15" : "bg-secondary"
      )}>
        <item.icon className={cn("h-4 w-4", selected ? "text-accent" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", selected ? "text-accent" : "text-foreground")}>{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
    </button>
  );
}
