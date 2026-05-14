import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search, Ban, CheckCircle2, UserPlus, Loader2,
  Clock, Gift, XCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  platform_role: string;
  account_status: string;
  sub_plan: string;
  sub_status: string;
  trial_ends_at: string | null;
}

const ACCOUNT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pendente",  cls: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
  approved: { label: "Aprovado",  cls: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" },
  free:     { label: "Free",      cls: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  rejected: { label: "Rejeitado", cls: "bg-red-400/10 text-red-400 border border-red-400/20" },
};

const SUB_STATUS: Record<string, { label: string; cls: string }> = {
  trial:     { label: "Trial",     cls: "bg-accent/10 text-accent" },
  active:    { label: "Ativo",     cls: "bg-success/10 text-success" },
  overdue:   { label: "Em atraso", cls: "bg-destructive/10 text-destructive" },
  expired:   { label: "Expirado",  cls: "bg-muted text-muted-foreground" },
  blocked:   { label: "Bloqueado", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

const ROLE_LABELS: Record<string, string> = {
  gestor: "Agente Público", licitante: "Licitante", consultor: "Consultor",
};

const FILTER_TABS = [
  { id: "all",      label: "Todos" },
  { id: "pending",  label: "Pendentes" },
  { id: "approved", label: "Aprovados" },
  { id: "free",     label: "Free" },
  { id: "rejected", label: "Rejeitados" },
];

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", organization: "", plan: "gratuito" });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: subs } = await supabase.from("subscriptions").select("*");

    const merged: UserRow[] = (profiles || []).map((p: any) => {
      const sub = (subs || []).find((s: any) => s.user_id === p.id);
      return {
        id: p.id,
        full_name: p.full_name || p.email,
        email: p.email,
        organization: p.organization || "",
        platform_role: p.platform_role || "gestor",
        account_status: p.account_status || "pending",
        sub_plan: sub?.plan || "gratuito",
        sub_status: sub?.status || "trial",
        trial_ends_at: sub?.trial_ends_at || null,
      };
    });
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const setAccountStatus = async (userId: string, status: string) => {
    await supabase.from("profiles").update({ account_status: status }).eq("id", userId);
    // If granting free, also set subscription to active
    if (status === "free") {
      await supabase.from("subscriptions").update({ status: "active", price_cents: 0 }).eq("user_id", userId);
    }
    toast({ title: status === "approved" ? "✓ Usuário aprovado" : status === "free" ? "✓ Acesso free concedido" : status === "rejected" ? "✗ Usuário rejeitado" : "Atualizado" });
    fetchUsers();
  };

  const toggleBlock = async (userId: string, currentSubStatus: string) => {
    const newStatus = currentSubStatus === "blocked" ? "active" : "blocked";
    await supabase.from("subscriptions").update({ status: newStatus }).eq("user_id", userId);
    toast({ title: newStatus === "blocked" ? "Usuário bloqueado" : "Usuário desbloqueado" });
    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) return;
    setCreating(true);
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: newUser,
    });
    if (error) {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário criado com sucesso" });
      setDialogOpen(false);
      setNewUser({ email: "", password: "", full_name: "", organization: "", plan: "gratuito" });
      fetchUsers();
    }
    setCreating(false);
  };

  const filtered = users.filter((u) => {
    const matchesFilter = filter === "all" || u.account_status === filter;
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = users.filter((u) => u.account_status === "pending").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filter === tab.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.id === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-400 text-[#080D14] rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-10 h-9 w-56 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 h-9"><UserPlus className="h-4 w-4" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Usuário</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                <div><Label>Senha</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
                <div><Label>Nome</Label><Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /></div>
                <div><Label>Organização</Label><Input value={newUser.organization} onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })} /></div>
                <div>
                  <Label>Plano</Label>
                  <Select value={newUser.plan} onValueChange={(v) => setNewUser({ ...newUser, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gratuito">Gratuito</SelectItem>
                      <SelectItem value="profissional">Profissional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreateUser} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Usuário</div>
          <div className="col-span-2">Organização</div>
          <div className="col-span-1">Perfil</div>
          <div className="col-span-2">Conta</div>
          <div className="col-span-2">Plano</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Nenhum usuário encontrado</div>
        ) : (
          filtered.map((user) => {
            const acct = ACCOUNT_STATUS[user.account_status] || ACCOUNT_STATUS.pending;
            const sub = SUB_STATUS[user.sub_status] || SUB_STATUS.trial;
            const isPending = user.account_status === "pending";
            const isFree = user.account_status === "free";

            return (
              <div key={user.id} className={cn(
                "grid grid-cols-12 gap-2 items-center border-b border-border last:border-b-0 px-4 py-3 transition-colors",
                isPending ? "bg-amber-400/[0.03] hover:bg-amber-400/[0.05]" : "hover:bg-secondary/30"
              )}>
                <div className="col-span-3">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>

                <div className="col-span-2 text-sm text-muted-foreground truncate">
                  {user.organization || "—"}
                </div>

                <div className="col-span-1">
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[user.platform_role] || user.platform_role}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", acct.cls)}>
                    {acct.label}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", sub.cls)}>
                    {sub.label}
                  </span>
                  {user.trial_ends_at && user.sub_status === "trial" && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Expira: {new Date(user.trial_ends_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>

                <div className="col-span-2 flex justify-end gap-1">
                  {isPending && (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Aprovar"
                        onClick={() => setAccountStatus(user.id, "approved")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Conceder Free"
                        onClick={() => setAccountStatus(user.id, "free")}
                      >
                        <Gift className="h-3.5 w-3.5 text-cyan-400" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Rejeitar"
                        onClick={() => setAccountStatus(user.id, "rejected")}
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </>
                  )}
                  {!isPending && !isFree && (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Conceder Free"
                        onClick={() => setAccountStatus(user.id, "free")}
                      >
                        <Gift className="h-3.5 w-3.5 text-cyan-400" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title={user.sub_status === "blocked" ? "Desbloquear" : "Bloquear"}
                        onClick={() => toggleBlock(user.id, user.sub_status)}
                      >
                        {user.sub_status === "blocked"
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          : <Ban className="h-3.5 w-3.5 text-destructive" />
                        }
                      </Button>
                    </>
                  )}
                  {isFree && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Revogar Free"
                      onClick={() => setAccountStatus(user.id, "approved")}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
