import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Shield,
  BarChart3,
  Search,
  Ban,
  CheckCircle2,
  Eye,
  TrendingUp,
  CreditCard,
  FileText,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "users", label: "Usuários", icon: Users },
  { id: "metrics", label: "Métricas", icon: BarChart3 },
  { id: "logs", label: "Logs", icon: Activity },
];

const mockUsers = [
  { id: "1", name: "Maria Silva", email: "maria@prefeitura.gov.br", org: "Prefeitura de SP", plan: "Gestor Público", status: "ativo", trialEnd: null },
  { id: "2", name: "João Santos", email: "joao@consultoria.com", org: "JMS Consultoria", plan: "Empresa", status: "ativo", trialEnd: null },
  { id: "3", name: "Ana Costa", email: "ana@secretaria.gov.br", org: "Sec. Educação", plan: "Gestor Público", status: "trial", trialEnd: "28/02/2026" },
  { id: "4", name: "Pedro Lima", email: "pedro@tech.com.br", org: "TechBid LTDA", plan: "Empresa", status: "bloqueado", trialEnd: null },
  { id: "5", name: "Carla Mendes", email: "carla@municipio.gov.br", org: "Município de Curitiba", plan: "Institucional", status: "ativo", trialEnd: null },
  { id: "6", name: "Roberto Alves", email: "roberto@obras.eng.br", org: "Alves Engenharia", plan: "Empresa", status: "expirado", trialEnd: "15/02/2026" },
];

const mockMetrics = [
  { label: "Usuários ativos (MAU)", value: "1.247", change: "+12%", icon: Users },
  { label: "Conversão Trial → Pago", value: "34%", change: "+5%", icon: TrendingUp },
  { label: "Receita mensal (MRR)", value: "R$ 87.450", change: "+18%", icon: CreditCard },
  { label: "Documentos gerados", value: "4.892", change: "+23%", icon: FileText },
];

const mockLogs = [
  { time: "14:32", user: "Maria Silva", action: "Gerou ETP", details: "ETP — Serviços de TI" },
  { time: "14:28", user: "João Santos", action: "Validou edital", details: "PE 023/2026" },
  { time: "14:15", user: "Ana Costa", action: "Login", details: "IP: 189.40.xx.xx" },
  { time: "13:58", user: "Sistema", action: "Bloqueio automático", details: "Pedro Lima — trial expirado" },
  { time: "13:42", user: "Carla Mendes", action: "Exportou documento", details: "TR — Obras rodoviárias (PDF)" },
  { time: "13:30", user: "Roberto Alves", action: "Tentativa de acesso", details: "Assinatura expirada — bloqueado" },
  { time: "12:55", user: "Maria Silva", action: "Chat IA", details: "Consulta sobre Art. 75" },
  { time: "12:40", user: "João Santos", action: "Cotação gerada", details: "Proposta equipamentos hospitalares" },
];

const statusConfig = {
  ativo: { label: "Ativo", class: "bg-success/10 text-success" },
  trial: { label: "Trial", class: "bg-accent/10 text-accent" },
  bloqueado: { label: "Bloqueado", class: "bg-destructive/10 text-destructive" },
  expirado: { label: "Expirado", class: "bg-muted text-muted-foreground" },
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState(mockUsers);

  const toggleBlock = (id: string) => {
    setUsers(users.map((u) =>
      u.id === id ? { ...u, status: u.status === "bloqueado" ? "ativo" : "bloqueado" } : u
    ));
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de usuários, métricas e auditoria</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg bg-secondary p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === "users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar usuários..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">Usuário</div>
              <div className="col-span-2">Organização</div>
              <div className="col-span-2">Plano</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3 text-right">Ações</div>
            </div>
            {filteredUsers.map((user) => {
              const status = statusConfig[user.status as keyof typeof statusConfig];
              return (
                <div key={user.id} className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="col-span-3">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">{user.org}</div>
                  <div className="col-span-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{user.plan}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.class}`}>
                      {status.label}
                    </span>
                    {user.trialEnd && <p className="text-[10px] text-muted-foreground mt-0.5">Expira: {user.trialEnd}</p>}
                  </div>
                  <div className="col-span-3 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleBlock(user.id)}
                    >
                      {user.status === "bloqueado" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Ban className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Metrics tab */}
      {activeTab === "metrics" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {mockMetrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <m.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-success">{m.change}</span>
                </div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Uso de ferramentas (últimos 30 dias)</h3>
            <div className="space-y-3">
              {[
                { name: "Chat IA", value: 45 },
                { name: "Gerador ETP", value: 28 },
                { name: "Validador de Editais", value: 22 },
                { name: "Gerador TR", value: 18 },
                { name: "Diagnóstico", value: 15 },
                { name: "Cotação Inteligente", value: 12 },
              ].map((tool) => (
                <div key={tool.name} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-muted-foreground">{tool.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-gold rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${tool.value}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{tool.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Logs tab */}
      {activeTab === "logs" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">Hora</div>
              <div className="col-span-3">Usuário</div>
              <div className="col-span-3">Ação</div>
              <div className="col-span-5">Detalhes</div>
            </div>
            {mockLogs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-2.5 hover:bg-secondary/30 transition-colors"
              >
                <div className="col-span-1 text-xs font-mono text-muted-foreground">{log.time}</div>
                <div className="col-span-3 text-sm">{log.user}</div>
                <div className="col-span-3 text-sm font-medium">{log.action}</div>
                <div className="col-span-5 text-sm text-muted-foreground">{log.details}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
