import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, FileText, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ReportsPage() {
  const [stats, setStats] = useState({ documents: 0, chats: 0, logins: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const documents = logs?.filter((l: any) => l.action?.includes("Gerou") || l.action?.includes("Exportou")).length || 0;
      const chats = logs?.filter((l: any) => l.action?.includes("Chat")).length || 0;
      const logins = logs?.filter((l: any) => l.action?.includes("Login")).length || 0;

      setStats({ documents, chats, logins });
      setRecentActivity(logs || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const cards = [
    { label: "Documentos gerados", value: stats.documents, icon: FileText, color: "text-accent" },
    { label: "Conversas com IA", value: stats.chats, icon: MessageSquare, color: "text-success" },
    { label: "Acessos", value: stats.logins, icon: BarChart3, color: "text-accent" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <BarChart3 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Seus dados de uso na plataforma</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <c.icon className={`h-5 w-5 ${c.color} mb-3`} />
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </motion.div>
        ))}
      </div>

      <h2 className="text-lg font-bold mb-4">Atividade Recente</h2>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade registrada</div>
        ) : (
          recentActivity.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between border-b border-border last:border-b-0 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.details}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
