import { useState, useEffect } from "react";
import { Settings, Save, Loader2, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({ billing: true, updates: true, marketing: false });
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name,
      organization: profile.organization,
      phone: profile.phone,
      city: profile.city,
      state: profile.state,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Settings className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Perfil</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Nome Completo</Label><Input value={profile?.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={profile?.email || ""} disabled /></div>
          <div><Label>Organização</Label><Input value={profile?.organization || ""} onChange={(e) => setProfile({ ...profile, organization: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={profile?.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
          <div><Label>Cidade</Label><Input value={profile?.city || ""} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
          <div><Label>Estado</Label><Input value={profile?.state || ""} onChange={(e) => setProfile({ ...profile, state: e.target.value })} /></div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Notificações</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cobranças e pagamentos</p>
              <p className="text-xs text-muted-foreground">Receba avisos de vencimento e confirmação de pagamento</p>
            </div>
            <Switch checked={notifications.billing} onCheckedChange={(v) => setNotifications({ ...notifications, billing: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Atualizações do sistema</p>
              <p className="text-xs text-muted-foreground">Novidades e melhorias na plataforma</p>
            </div>
            <Switch checked={notifications.updates} onCheckedChange={(v) => setNotifications({ ...notifications, updates: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Marketing</p>
              <p className="text-xs text-muted-foreground">Promoções e ofertas especiais</p>
            </div>
            <Switch checked={notifications.marketing} onCheckedChange={(v) => setNotifications({ ...notifications, marketing: v })} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Configurações
      </Button>
    </div>
  );
}
