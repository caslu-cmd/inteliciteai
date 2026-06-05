import { useState, useEffect } from "react";
import { Building2, Plus, Edit2, Trash2, Loader2, CheckCircle2, XCircle, Users, FileText } from "lucide-react";
import AdminRegulamentosDialog from "@/components/admin/AdminRegulamentosDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Orgao {
  id: string;
  name: string;
  slug: string;
  state: string;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  active: boolean;
  created_at: string;
  _user_count?: number;
}

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const empty: Omit<Orgao, "id" | "created_at" | "_user_count"> = {
  name: "", slug: "", state: "SP", cnpj: "",
  logo_url: "", primary_color: "#C9A84C", secondary_color: "#7A5C00", active: true,
};

export default function AdminOrgaosTab() {
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Orgao | null>(null);
  const [regulamentosOrgao, setRegulamentosOrgao] = useState<Orgao | null>(null);
  const [form, setForm] = useState({ ...empty });
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("municipalities")
      .select("*")
      .order("name");

    if (data) {
      // Contar usuários por órgão
      const { data: profiles } = await supabase
        .from("profiles")
        .select("municipality_id")
        .not("municipality_id", "is", null);

      const counts: Record<string, number> = {};
      for (const p of profiles || []) {
        if (p.municipality_id) counts[p.municipality_id] = (counts[p.municipality_id] || 0) + 1;
      }

      setOrgaos(data.map(o => ({ ...o, _user_count: counts[o.id] || 0 })));
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (o: Orgao) => {
    setEditing(o);
    setForm({
      name: o.name, slug: o.slug, state: o.state,
      cnpj: o.cnpj || "", logo_url: o.logo_url || "",
      primary_color: o.primary_color, secondary_color: o.secondary_color,
      active: o.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ title: "Nome e slug são obrigatórios", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      state: form.state,
      cnpj: form.cnpj || null,
      logo_url: form.logo_url || null,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      active: form.active,
    };

    if (editing) {
      const { error } = await supabase.from("municipalities").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      else toast({ title: "Órgão atualizado!" });
    } else {
      const { error } = await supabase.from("municipalities").insert(payload);
      if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      else toast({ title: "Órgão criado!" });
    }

    setSaving(false);
    setOpen(false);
    load();
  };

  const handleToggle = async (o: Orgao) => {
    await supabase.from("municipalities").update({ active: !o.active }).eq("id", o.id);
    load();
  };

  const handleDelete = async (o: Orgao) => {
    if (o._user_count && o._user_count > 0) {
      toast({ title: "Não é possível excluir", description: `Este órgão possui ${o._user_count} usuário(s) vinculado(s).`, variant: "destructive" });
      return;
    }
    await supabase.from("municipalities").delete().eq("id", o.id);
    toast({ title: "Órgão removido" });
    load();
  };

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Órgãos Públicos</h2>
          <p className="text-sm text-muted-foreground">Prefeituras, câmaras, autarquias e demais órgãos clientes</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Órgão
        </Button>
      </div>

      {orgaos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Building2 className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Nenhum órgão cadastrado</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-4">Órgão</div>
            <div className="col-span-2">UF / CNPJ</div>
            <div className="col-span-2">Cor</div>
            <div className="col-span-1 text-center">Usuários</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>

          {orgaos.map(o => (
            <div key={o.id} className="grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                {o.logo_url
                  ? <img src={o.logo_url} alt={o.name} className="h-8 w-8 rounded object-contain border border-border shrink-0" />
                  : <div className="h-8 w-8 rounded flex items-center justify-center shrink-0 text-xs font-bold text-white"
                      style={{ background: o.primary_color }}>{o.name.slice(0, 2).toUpperCase()}</div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{o.name}</p>
                  <p className="text-[10px] text-muted-foreground">{o.slug}</p>
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-sm">{o.state}</p>
                {o.cnpj && <p className="text-[10px] text-muted-foreground">{o.cnpj}</p>}
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full border border-border" style={{ background: o.primary_color }} title={o.primary_color} />
                <div className="h-4 w-4 rounded-full border border-border" style={{ background: o.secondary_color }} title={o.secondary_color} />
              </div>
              <div className="col-span-1 flex justify-center items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{o._user_count || 0}</span>
              </div>
              <div className="col-span-1 flex justify-center">
                {o.active
                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                  : <XCircle className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="col-span-2 flex justify-end gap-1">
                <Switch checked={o.active} onCheckedChange={() => handleToggle(o)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Regulamentos" onClick={() => setRegulamentosOrgao(o)}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(o)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminRegulamentosDialog
        orgaoId={regulamentosOrgao?.id ?? ""}
        orgaoName={regulamentosOrgao?.name ?? ""}
        open={!!regulamentosOrgao}
        onClose={() => setRegulamentosOrgao(null)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-accent" />
              {editing ? "Editar Órgão" : "Novo Órgão Público"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Nome do órgão *</Label>
                <Input placeholder="Prefeitura Municipal de Campinas" value={form.name}
                  onChange={e => { set("name", e.target.value); set("slug", e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/g,"").replace(/\s+/g,"-")); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug (URL único) *</Label>
                <Input placeholder="prefeitura-campinas" value={form.slug} onChange={e => set("slug", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF *</Label>
                <Select value={form.state} onValueChange={v => set("state", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input placeholder="00.000.000/0000-00" value={form.cnpj || ""} onChange={e => set("cnpj", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL do Logo</Label>
                <Input placeholder="https://..." value={form.logo_url || ""} onChange={e => set("logo_url", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor primária</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primary_color} onChange={e => set("primary_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.primary_color} onChange={e => set("primary_color", e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor secundária</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.secondary_color} onChange={e => set("secondary_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.secondary_color} onChange={e => set("secondary_color", e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={v => set("active", v)} />
                <Label className="text-xs">Ativo</Label>
              </div>
            </div>

            {/* Preview */}
            {(form.logo_url || form.name) && (
              <div className="rounded-lg border border-border p-3 flex items-center gap-3"
                style={{ background: form.primary_color + "15", borderColor: form.primary_color + "40" }}>
                {form.logo_url
                  ? <img src={form.logo_url} alt="" className="h-8 w-8 object-contain rounded" />
                  : <div className="h-8 w-8 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: form.primary_color }}>{form.name.slice(0,2).toUpperCase()}</div>
                }
                <div>
                  <p className="text-sm font-bold" style={{ color: form.primary_color }}>{form.name || "Nome do Órgão"}</p>
                  <p className="text-[10px] text-muted-foreground">Preview do white label</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar Órgão"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
