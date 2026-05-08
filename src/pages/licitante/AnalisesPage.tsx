import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { RiskBadge } from "@/components/licitante/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileSearch, Eye, Download, MoreHorizontal, Filter, ChevronUp, ChevronDown } from "lucide-react";

const editais = [
  { id: 1, processo: "25380.004567/2026-12",    orgao: "Ministério da Saúde", objeto: "Equipamentos de TI e infraestrutura de rede",  status: "analisado", chance: 78, risk: "low"    as const, abertura: "22 Mar 2026" },
  { id: 2, processo: "0001234-55.2026.8.26",    orgao: "TJSP",               objeto: "Consultoria em segurança da informação",        status: "analisado", chance: 52, risk: "medium" as const, abertura: "28 Mar 2026" },
  { id: 3, processo: "PE-2026/045-PMC",         orgao: "Pref. de Curitiba",  objeto: "Licenças de software corporativo",              status: "pendente",  chance: 34, risk: "high"   as const, abertura: "01 Abr 2026" },
  { id: 4, processo: "BC-2026/089",             orgao: "Banco Central",      objeto: "Serviços de cloud computing",                   status: "analisado", chance: 85, risk: "low"    as const, abertura: "05 Abr 2026" },
  { id: 5, processo: "SES-RJ/2026-012",         orgao: "Sec. Saúde RJ",     objeto: "Sistema de gestão hospitalar",                  status: "pendente",  chance: 61, risk: "medium" as const, abertura: "10 Abr 2026" },
  { id: 6, processo: "SERPRO/2026-034",         orgao: "SERPRO",             objeto: "Modernização de data center",                   status: "analisado", chance: 45, risk: "high"   as const, abertura: "15 Abr 2026" },
];

const statusStyles = {
  analisado: "bg-success/10 text-success",
  pendente:  "bg-amber-400/10 text-amber-400",
};

export default function AnalisesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("abertura");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const navigate = useNavigate();

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;

  const filtered = editais.filter((e) =>
    e.objeto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.orgao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.processo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <FileSearch className="w-6 h-6 text-primary" /> Análises de Editais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} editais</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtros</Button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    { key: "processo", label: "Nº Processo" },
                    { key: "orgao",    label: "Órgão" },
                    { key: "objeto",   label: "Objeto" },
                    { key: "status",   label: "Status" },
                    { key: "chance",   label: "Chance (%)" },
                    { key: "risk",     label: "Risco" },
                    { key: "abertura", label: "Abertura" },
                  ].map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                      <span className="flex items-center gap-1">{col.label} <SortIcon field={col.key} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((edital, i) => (
                  <motion.tr key={edital.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono-legal text-muted-foreground">{edital.processo}</td>
                    <td className="px-4 py-3 text-card-foreground">{edital.orgao}</td>
                    <td className="px-4 py-3 text-card-foreground max-w-[240px] truncate">{edital.objeto}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusStyles[edital.status as keyof typeof statusStyles]}`}>
                        {edital.status === "analisado" ? "Analisado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${edital.chance}%` }}
                            transition={{ delay: i * 0.05, duration: 0.6 }}
                            className={`h-full rounded-full ${edital.chance >= 70 ? "bg-success" : edital.chance >= 50 ? "bg-amber-400" : "bg-destructive"}`}
                          />
                        </div>
                        <span className="text-xs font-semibold text-card-foreground">{edital.chance}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RiskBadge level={edital.risk} /></td>
                    <td className="px-4 py-3 font-mono-legal text-muted-foreground">{edital.abertura}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/licitante/scanner")}><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
