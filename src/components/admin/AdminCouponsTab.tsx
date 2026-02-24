import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Tag, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminCouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discount_percent: "10", max_uses: "", valid_until: "" });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchCoupons = async () => {
    setLoading(true);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.discount_percent) return;
    setCreating(true);
    const { error } = await supabase.from("coupons").insert({
      code: form.code.toUpperCase(),
      discount_percent: parseInt(form.discount_percent),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cupom criado!" });
      setDialogOpen(false);
      setForm({ code: "", discount_percent: "10", max_uses: "", valid_until: "" });
      fetchCoupons();
    }
    setCreating(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("coupons").update({ active: !active }).eq("id", id);
    fetchCoupons();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-4 flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Cupom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Cupom de Desconto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Código</Label><Input placeholder="DESCONTO20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Desconto (%)</Label><Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} /></div>
              <div><Label>Máximo de usos (vazio = ilimitado)</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
              <div><Label>Válido até</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar Cupom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Código</div>
          <div className="col-span-2">Desconto</div>
          <div className="col-span-2">Usos</div>
          <div className="col-span-2">Validade</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum cupom criado</div>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="col-span-2 font-mono text-sm font-bold">{c.code}</div>
              <div className="col-span-2 text-sm">{c.discount_percent}%</div>
              <div className="col-span-2 text-sm text-muted-foreground">{c.used_count}{c.max_uses ? `/${c.max_uses}` : " / ∞"}</div>
              <div className="col-span-2 text-sm text-muted-foreground">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("pt-BR") : "Sem limite"}</div>
              <div className="col-span-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {c.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="col-span-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(c.id, c.active)}>
                  {c.active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
