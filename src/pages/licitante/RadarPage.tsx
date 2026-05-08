import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, MapPin, Building, Tag, X, Radar as RadarIcon } from "lucide-react";

const allOpportunities = [
  { title: "Pregão Eletrônico - Aquisição de equipamentos de TI e infraestrutura de rede", organ: "Ministério da Saúde",      location: "Brasília, DF",       deadline: "22 Mar 2026", score: 78, risk: "low"    as const, value: "R$ 2.450.000,00" },
  { title: "Concorrência - Serviços de consultoria em segurança da informação",             organ: "Tribunal de Justiça de SP",location: "São Paulo, SP",      deadline: "28 Mar 2026", score: 52, risk: "medium" as const, value: "R$ 890.000,00"   },
  { title: "Pregão Presencial - Fornecimento de licenças de software corporativo",          organ: "Prefeitura de Curitiba",   location: "Curitiba, PR",       deadline: "01 Abr 2026", score: 34, risk: "high"   as const, value: "R$ 1.200.000,00" },
  { title: "Pregão Eletrônico - Contratação de serviços de cloud computing",                organ: "Banco Central do Brasil",  location: "Brasília, DF",       deadline: "05 Abr 2026", score: 85, risk: "low"    as const, value: "R$ 3.800.000,00" },
  { title: "Tomada de Preços - Sistema de gestão hospitalar integrado",                     organ: "Secretaria de Saúde - RJ", location: "Rio de Janeiro, RJ", deadline: "10 Abr 2026", score: 61, risk: "medium" as const, value: "R$ 1.750.000,00" },
  { title: "Concorrência - Modernização de data center e virtualização",                    organ: "SERPRO",                   location: "Brasília, DF",       deadline: "15 Abr 2026", score: 45, risk: "high"   as const, value: "R$ 5.200.000,00" },
  { title: "Pregão Eletrônico - Serviços de cibersegurança e SOC",                         organ: "Ministério da Defesa",     location: "Brasília, DF",       deadline: "18 Abr 2026", score: 72, risk: "low"    as const, value: "R$ 4.100.000,00" },
  { title: "Pregão Eletrônico - Soluções de backup e disaster recovery",                   organ: "DATAPREV",                 location: "Rio de Janeiro, RJ", deadline: "20 Abr 2026", score: 58, risk: "medium" as const, value: "R$ 2.300.000,00" },
];

const segments = ["Tecnologia", "Saúde", "Infraestrutura", "Consultoria", "Defesa"];
const regions  = ["Distrito Federal", "São Paulo", "Rio de Janeiro", "Paraná", "Minas Gerais"];
const modalities = ["Pregão Eletrônico", "Pregão Presencial", "Concorrência", "Tomada de Preços"];

export default function RadarPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (f: string) =>
    setActiveFilters((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const filtered = allOpportunities.filter(
    (o) => o.title.toLowerCase().includes(searchTerm.toLowerCase()) || o.organ.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <RadarIcon className="w-6 h-6 text-primary" /> Radar de Oportunidades
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} oportunidades encontradas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, órgão..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant={showFilters ? "default" : "outline"} size="icon" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: "Segmento", icon: Tag, items: segments },
                { label: "Região", icon: MapPin, items: regions },
                { label: "Modalidade", icon: Building, items: modalities },
              ].map(({ label, icon: Icon, items }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s) => (
                      <button key={s} onClick={() => toggleFilter(s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          activeFilters.includes(s)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {activeFilters.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                {activeFilters.map((f) => (
                  <span key={f} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer" onClick={() => toggleFilter(f)}>
                    {f} <X className="w-3 h-3" />
                  </span>
                ))}
                <button onClick={() => setActiveFilters([])} className="text-xs text-destructive ml-auto hover:underline">Limpar todos</button>
              </div>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((opp, i) => <OpportunityCard key={i} {...opp} index={i} />)}
        </div>
      </div>
    </LicitanteLayout>
  );
}
