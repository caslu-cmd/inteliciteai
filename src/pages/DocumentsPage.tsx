import { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Search, Download, Eye, Trash2, FileText, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportAsPdf } from "@/lib/exportDocument";

const mockDocs = [
  { id: "1", name: "ETP — Serviços de TI", type: "ETP", date: "22/02/2026", size: "245 KB", risk: "baixo", content: "Estudo Técnico Preliminar para contratação de serviços de tecnologia da informação, conforme Art. 18, §1º da Lei 14.133/2021.\n\nObjeto: Contratação de empresa especializada em serviços de TI para suporte e manutenção de sistemas.\n\nJustificativa: Necessidade de manter a infraestrutura tecnológica do órgão em pleno funcionamento.\n\nRequisitos: Equipe mínima de 5 profissionais certificados, SLA de 99,5% de disponibilidade." },
  { id: "2", name: "TR — Manutenção predial", type: "TR", date: "21/02/2026", size: "189 KB", risk: "medio", content: "Termo de Referência para contratação de serviços de manutenção predial preventiva e corretiva.\n\nObjeto: Manutenção das instalações prediais do edifício sede.\n\nEscopo: Serviços elétricos, hidráulicos, de alvenaria e pintura.\n\nPrazo: 12 meses, prorrogáveis por até 60 meses." },
  { id: "3", name: "Edital PE 023/2026", type: "Edital", date: "20/02/2026", size: "1.2 MB", risk: "alto", content: "Edital de Pregão Eletrônico nº 023/2026 para aquisição de equipamentos de informática.\n\nModalidade: Pregão Eletrônico\nCritério: Menor preço por item\n\nItens: Notebooks, monitores, periféricos e acessórios.\n\nValor estimado: R$ 2.500.000,00" },
  { id: "4", name: "Checklist — Obras rodoviárias", type: "Checklist", date: "18/02/2026", size: "56 KB", risk: "baixo", content: "Checklist de conformidade para licitação de obras rodoviárias.\n\n✅ Projeto básico aprovado\n✅ Licença ambiental obtida\n✅ Orçamento detalhado\n⬜ Parecer jurídico\n⬜ Publicação no DOU" },
  { id: "5", name: "Proposta — Equipamentos hospitalares", type: "Proposta", date: "15/02/2026", size: "320 KB", risk: "medio", content: "Proposta comercial para fornecimento de equipamentos hospitalares.\n\nItens: Monitores multiparamétricos, ventiladores pulmonares, bombas de infusão.\n\nValor total: R$ 1.850.000,00\nPrazo de entrega: 45 dias úteis\nGarantia: 24 meses" },
  { id: "6", name: "ETP — Mobiliário escolar", type: "ETP", date: "12/02/2026", size: "198 KB", risk: "baixo", content: "Estudo Técnico Preliminar para aquisição de mobiliário escolar.\n\nObjeto: Mesas e cadeiras para unidades de ensino.\n\nQuantidade: 5.000 conjuntos aluno.\n\nEspecificações: Conforme ABNT NBR 14006." },
  { id: "7", name: "Relatório de análise — Edital 019", type: "Relatório", date: "10/02/2026", size: "890 KB", risk: "alto", content: "Relatório de análise do Edital 019/2026.\n\nAchados críticos:\n- Ausência de critérios objetivos de julgamento\n- Especificações restritivas à competitividade\n- Prazo de entrega incompatível com o mercado\n\nRecomendação: Revisão do edital antes da publicação." },
];

const riskColors = {
  baixo: "bg-success/10 text-success",
  medio: "bg-accent/10 text-accent",
  alto: "bg-destructive/10 text-destructive",
};

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewDoc, setViewDoc] = useState<typeof mockDocs[0] | null>(null);

  const filtered = mockDocs.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleDownload = (doc: typeof mockDocs[0]) => {
    exportAsPdf({
      documentTitle: doc.name,
      legalBasis: "Lei 14.133/2021",
      sections: [
        { title: "Tipo", content: doc.type },
        { title: "Data", content: doc.date },
        { title: "Conteúdo", content: doc.content },
      ],
    });
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <FolderOpen className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Meus Documentos</h1>
            <p className="text-sm text-muted-foreground">{mockDocs.length} documentos</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar documentos..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ETP">ETP</SelectItem>
            <SelectItem value="TR">TR</SelectItem>
            <SelectItem value="Edital">Edital</SelectItem>
            <SelectItem value="Checklist">Checklist</SelectItem>
            <SelectItem value="Proposta">Proposta</SelectItem>
            <SelectItem value="Relatório">Relatório</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-5">Nome</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-1">Risco</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>
        {filtered.map((doc, i) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-12 gap-4 items-center border-b border-border px-4 py-3 hover:bg-secondary/30 transition-colors last:border-b-0"
          >
            <div className="col-span-5 flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.size}</p>
              </div>
            </div>
            <div className="col-span-2">
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{doc.type}</span>
            </div>
            <div className="col-span-2 text-sm text-muted-foreground">{doc.date}</div>
            <div className="col-span-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${riskColors[doc.risk as keyof typeof riskColors]}`}>
                {doc.risk}
              </span>
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDoc(doc)} title="Visualizar">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)} title="Baixar PDF">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View Document Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {viewDoc?.name}
            </DialogTitle>
          </DialogHeader>
          {viewDoc && (
            <div className="space-y-4">
              <div className="flex gap-3 text-sm">
                <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">{viewDoc.type}</span>
                <span className="text-muted-foreground">{viewDoc.date}</span>
                <span className="text-muted-foreground">{viewDoc.size}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${riskColors[viewDoc.risk as keyof typeof riskColors]}`}>
                  {viewDoc.risk}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/20 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewDoc.content}</p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleDownload(viewDoc)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
