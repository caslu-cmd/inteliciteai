import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AccountStatus = "pending" | "approved" | "rejected" | "free" | null;

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const [status, setStatus] = useState<"loading" | "ok" | "redirect">("loading");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) navigate("/login", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_status, platform_role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const acctStatus = profile?.account_status as AccountStatus;

      if (acctStatus === "rejected") {
        navigate("/login?rejected=1", { replace: true });
        return;
      }

      if (acctStatus === "pending") {
        navigate("/pending", { replace: true });
        return;
      }

      if (requireAdmin) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleRow) {
          navigate("/dashboard", { replace: true });
          return;
        }
      }

      setStatus("ok");
    })();

    return () => { cancelled = true; };
  }, [navigate, requireAdmin]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "hsl(223 27% 7%)" }}>
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "redirect") return null;

  return <>{children}</>;
}
