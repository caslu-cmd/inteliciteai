import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Loader2, Check, AlertTriangle, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidateModuleCache } from "@/hooks/useModuleAccess";
import { sendEmail } from "@/lib/emailUtils";

interface ModuleConfig {
  module: string;
  display_name: string;
  description: string;
  price_cents: number;
  features: string[];
}

interface ModuleSub {
  module: string;
  active: boolean;
  next_billing_at: string | null;
  unlocked_at: string | null;
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  analise:      Sparkles,
  consulta:     BookOpen,
  conformidade: ShieldCheck,
};

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ModulesPage() {
  const [configs, setConfigs] = useState<ModuleConfig[]>([]);
  const [subs, setSubs] = useState<Record<string, ModuleSub>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<ModuleConfig | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ModuleConfig | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [cfgRes, subRes] = await Promise.all([
      supabase.from("module_config").select("*").eq("active", true).order("price_cents", { ascending: false }),
      supabase.from("module_subscriptions").select("*").eq("user_id", user.id),
    ]);

    setConfigs((cfgRes.data as ModuleConfig[]) || []);
    const subMap: Record<string, ModuleSub> = {};
    for (const s of (subRes.data as ModuleSub[]) || []) subMap[s.module] = s;
    setSubs(subMap);
    setLoading(false);
  };

  const handleUnlock = async (mod: ModuleConfig) => {
    setActing(mod.module);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActing(null); return; }

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const { error } = await supabase.from("module_subscriptions").upsert({
      user_id: user.id,
      module: mod.module,
      active: true,
      price_cents: mod.price_cents,
      unlocked_at: new Date().toISOString(),
      next_billing_at: nextBilling.toISOString(),
      cancelled_at: null,
    }, { onConflict: "user_id,module" });

    if (error) {
      toast.error("Erro ao desbloquear módulo");
    } else {
      invalidateModuleCache();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", user!.id).single();
      if (profile?.email) {
        sendEmail(profile.email, "module_unlocked", {
          module: mod.display_name,
          nextBilling: nextBilling.toLocaleDateString("pt-BR"),
          dashboardUrl: `${window.location.origin}/dashboard`,
        });
      }
      toast.success(`Módulo ${mod.display_name} desbloqueado! Fatura gerada para ${nextBilling.toLocaleDateString("pt-BR")}.`);
      await load();
    }
    setActing(null);
    setUnlockTarget(null);
  };

  const handleCancel = async (mod: ModuleConfig) => {
    setActing(mod.module);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setActing(null); return; }

    const { error } = await supabase.from("module_subscriptions")
      .update({ active: false, cancelled_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("module", mod.module);

    if (error) {
      toast.error("Erro ao cancelar módulo");
    } else {
      invalidateModuleCache();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", user!.id).single();
      const sub = subs[mod.module];
      if (profile?.email) {
        sendEmail(profile.email, "module_cancelled", {
          module: mod.display_name,
          accessUntil: sub?.next_billing_at ? new Date(sub.next_billing_at).toLocaleDateString("pt-BR") : "fim do período",
          modulesUrl: `${window.location.origin}/dashboard/modulos`,
        });
      }
      toast.success(`Módulo ${mod.display_name} será cancelado no fim do período.`);
      await load();
    }
    setActing(null);
    setCancelTarget(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Unlock className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Módulos</h1>
          <p className="text-sm text-muted-foreground">Desbloqueie os módulos que sua equipe precisa</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-8 ml-13">
        Cada módulo é cobrado mensalmente. Você pode cancelar quando quiser, mas não há reembolso do período vigente.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {configs.map((mod, i) => {
          const sub = subs[mod.module];
          const isActive = sub?.active === true;
          const isCancelled = sub && !sub.active && sub.cancelled_at;
          const Icon = MODULE_ICONS[mod.module] || Sparkles;

          return (
            <motion.div
              key={mod.module}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "relative rounded-xl border flex flex-col",
                isActive
                  ? "border-accent bg-accent/5"
                  : "border-border bg-card"
              )}
            >
              {/* Lock overlay for inactive */}
              {!isActive && (
                <div className="absolute top-3 right-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}

              <div className="p-5 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isActive ? "bg-accent/15" : "bg-secondary"
                  )}>
                    <Icon className={cn("h-5 w-5", isActive ? "text-accent" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{mod.display_name}</p>
                    {isActive && sub?.next_billing_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Próx. cobrança: {new Date(sub.next_billing_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4">{mod.description}</p>

                <p className="text-xl font-bold mb-4">
                  {fmt(mod.price_cents)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>

                <ul className="space-y-1.5 mb-4">
                  {mod.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <Check className="h-3 w-3 mt-0.5 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-5 pb-5">
                {isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => setCancelTarget(mod)}
                    disabled={acting === mod.module}
                  >
                    {acting === mod.module ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    Cancelar módulo
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setUnlockTarget(mod)}
                    disabled={acting === mod.module}
                  >
                    {acting === mod.module ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                    Desbloquear
                  </Button>
                )}
                {isCancelled && (
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Cancelado — acesso até {sub?.next_billing_at ? new Date(sub.next_billing_at).toLocaleDateString("pt-BR") : "fim do período"}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Dialog desbloquear */}
      <AlertDialog open={!!unlockTarget} onOpenChange={open => { if (!open) setUnlockTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-accent" />
              Desbloquear {unlockTarget?.display_name}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>Ao confirmar:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>O módulo será ativado <strong className="text-foreground">imediatamente</strong></li>
                <li>Uma fatura de <strong className="text-foreground">{unlockTarget && fmt(unlockTarget.price_cents)}</strong> será gerada para o mês seguinte</li>
                <li>Você pode cancelar a qualquer momento, mas o valor do período atual não será reembolsado</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlockTarget && handleUnlock(unlockTarget)}>
              Confirmar e desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog cancelar módulo */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Cancelar {cancelTarget?.display_name}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>O módulo continuará ativo até o fim do período pago</li>
                <li><strong className="text-foreground">Não haverá reembolso</strong> do valor já cobrado</li>
                <li>Após o vencimento, o módulo será bloqueado automaticamente</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter módulo</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
