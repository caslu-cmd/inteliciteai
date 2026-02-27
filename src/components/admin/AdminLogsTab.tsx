import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, user_email, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Data/Hora</div>
          <div className="col-span-3">Usuário</div>
          <div className="col-span-3">Ação</div>
          <div className="col-span-4">Detalhes</div>
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum log registrado ainda</div>
        ) : (
          logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-2.5 hover:bg-secondary/30 transition-colors"
            >
              <div className="col-span-2 text-xs font-mono text-muted-foreground">
                {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="col-span-3 text-sm truncate">{log.user_email || "Sistema"}</div>
              <div className="col-span-3 text-sm font-medium">{log.action}</div>
              <div className="col-span-4 text-sm text-muted-foreground truncate">{log.details}</div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
