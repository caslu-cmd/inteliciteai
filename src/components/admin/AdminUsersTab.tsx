import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Ban, CheckCircle2, Eye, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  city: string;
  state: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  trial: { label: "Trial", class: "bg-accent/10 text-accent" },
  active: { label: "Ativo", class: "bg-success/10 text-success" },
  overdue: { label: "Em atraso", class: "bg-destructive/10 text-destructive" },
  expired: { label: "Expirado", class: "bg-muted text-muted-foreground" },
  blocked: { label: "Bloqueado", class: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", class: "bg-muted text-muted-foreground" },
};

const planLabels: Record<string, string> = {
  gratuito: "Gratuito (Trial)",
  profissional: "Profissional",
};

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
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
        city: p.city || "",
        state: p.state || "",
        plan: sub?.plan || "gratuito",
        status: sub?.status || "trial",
        trial_ends_at: sub?.trial_ends_at || null,
      };
    });
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleBlock = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "blocked" ? "active" : "blocked";
    await supabase.from("subscriptions").update({ status: newStatus }).eq("user_id", userId);
    toast({ title: newStatus === "blocked" ? "Usuário bloqueado" : "Usuário desbloqueado" });
    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) return;
    setCreating(true);
    
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newUser.email, password: newUser.password, full_name: newUser.full_name, organization: newUser.organization, plan: newUser.plan },
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

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar usuários..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Email</Label><Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
              <div><Label>Senha</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
              <div><Label>Nome Completo</Label><Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /></div>
              <div><Label>Organização</Label><Input value={newUser.organization} onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })} /></div>
              <div>
                <Label>Plano</Label>
                <Select value={newUser.plan} onValueChange={(v) => setNewUser({ ...newUser, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(planLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateUser} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar Usuário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Usuário</div>
          <div className="col-span-2">Organização</div>
          <div className="col-span-1">Local</div>
          <div className="col-span-2">Plano</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum usuário encontrado</div>
        ) : (
          filteredUsers.map((user) => {
            const status = statusConfig[user.status] || statusConfig.trial;
            return (
              <div key={user.id} className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="col-span-3">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground truncate">{user.organization || "—"}</div>
                <div className="col-span-1 text-xs text-muted-foreground">{user.city && user.state ? `${user.city}/${user.state}` : "—"}</div>
                <div className="col-span-2">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{planLabels[user.plan] || user.plan}</span>
                </div>
                <div className="col-span-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.class}`}>{status.label}</span>
                  {user.trial_ends_at && user.status === "trial" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Expira: {new Date(user.trial_ends_at).toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
                <div className="col-span-2 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBlock(user.id, user.status)}>
                    {user.status === "blocked" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Ban className="h-3.5 w-3.5 text-destructive" />}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
