import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ModuleName = "analise" | "consulta" | "conformidade";

interface ModuleAccess {
  analise: boolean;
  consulta: boolean;
  conformidade: boolean;
  loading: boolean;
}

// Cache em memória para evitar múltiplas queries na mesma sessão
let cache: { data: ModuleAccess; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minuto

export function useModuleAccess(): ModuleAccess {
  const [access, setAccess] = useState<ModuleAccess>({
    analise: false, consulta: false, conformidade: false, loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Usar cache se recente
      if (cache && Date.now() - cache.ts < CACHE_TTL) {
        if (!cancelled) setAccess(cache.data);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setAccess({ analise: false, consulta: false, conformidade: false, loading: false });
        return;
      }

      // Apenas super_admin tem acesso total sem precisar de módulos
      const { data: profile } = await supabase
        .from("profiles")
        .select("platform_role")
        .eq("id", user.id)
        .single();

      if (profile?.platform_role === "super_admin") {
        const fullAccess = { analise: true, consulta: true, conformidade: true, loading: false };
        cache = { data: fullAccess, ts: Date.now() };
        if (!cancelled) setAccess(fullAccess);
        return;
      }

      // Assinatura ativa ou trial vigente libera todos os módulos.
      // Trial de 7 dias (status 'trial') e planos pagos (status 'active')
      // dão acesso total — assim o onboarding não cai em telas bloqueadas.
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, current_period_end")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nowTs = new Date();
      const trialVigente =
        sub?.status === "trial" &&
        (!sub.trial_ends_at || new Date(sub.trial_ends_at) > nowTs);
      const assinaturaAtiva =
        sub?.status === "active" &&
        (!sub.current_period_end || new Date(sub.current_period_end) > nowTs);

      if (trialVigente || assinaturaAtiva) {
        const fullAccess = { analise: true, consulta: true, conformidade: true, loading: false };
        cache = { data: fullAccess, ts: Date.now() };
        if (!cancelled) setAccess(fullAccess);
        return;
      }

      const { data: subs } = await supabase
        .from("module_subscriptions")
        .select("module, active, next_billing_at, cancelled_at")
        .eq("user_id", user.id);

      const now = new Date();
      const isActive = (m: any) =>
        m.active && (!m.next_billing_at || new Date(m.next_billing_at) > now);

      const result: ModuleAccess = {
        analise:      !!(subs || []).find((m: any) => m.module === "analise"      && isActive(m)),
        consulta:     !!(subs || []).find((m: any) => m.module === "consulta"     && isActive(m)),
        conformidade: !!(subs || []).find((m: any) => m.module === "conformidade" && isActive(m)),
        loading: false,
      };

      cache = { data: result, ts: Date.now() };
      if (!cancelled) setAccess(result);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return access;
}

// Invalida o cache quando o usuário desbloqueia/cancela um módulo
export function invalidateModuleCache() {
  cache = null;
}
