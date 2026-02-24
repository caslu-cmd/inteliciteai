import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminGeoTab() {
  const [geoData, setGeoData] = useState<{ state: string; city: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("state, city");
      const grouped: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        const key = p.state && p.city ? `${p.city}, ${p.state}` : p.state || "Não informado";
        grouped[key] = (grouped[key] || 0) + 1;
      });
      const sorted = Object.entries(grouped)
        .map(([key, count]) => {
          const parts = key.split(", ");
          return { city: parts[0] || key, state: parts[1] || "", count };
        })
        .sort((a, b) => b.count - a.count);
      setGeoData(sorted);
      setLoading(false);
    })();
  }, []);

  const total = geoData.reduce((s, g) => s + g.count, 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-accent" />
          <h3 className="font-semibold">Distribuição Geográfica dos Usuários</h3>
        </div>
        <div className="space-y-3">
          {geoData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado de localização disponível</p>
          ) : (
            geoData.map((g) => {
              const pct = total > 0 ? Math.round((g.count / total) * 100) : 0;
              return (
                <div key={`${g.city}-${g.state}`} className="flex items-center gap-3">
                  <span className="w-48 text-sm text-muted-foreground truncate">{g.city}{g.state ? `, ${g.state}` : ""}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div className="h-full bg-gradient-gold rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{g.count} ({pct}%)</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}
