import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock,
  ExternalLink, RefreshCw, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROF_LABELS: Record<string, string> = {
  advogado: "Advogado(a)", contador: "Contador(a)", administrador: "Administrador(a)",
  engenheiro: "Engenheiro(a)", economista: "Economista", outro: "Outro",
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendente",          cls: "bg-amber-400/10 text-amber-400 border border-amber-400/20" },
  in_review: { label: "Em revisão",        cls: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20" },
  approved:  { label: "Aprovado",          cls: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" },
  rejected:  { label: "Rejeitado",         cls: "bg-red-400/10 text-red-400 border border-red-400/20" },
  flagged:   { label: "Suspeito",          cls: "bg-orange-400/10 text-orange-400 border border-orange-400/20" },
};

function RiskBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? "bg-red-500/15 text-red-400 border-red-400/30" :
    score >= 50 ? "bg-orange-400/15 text-orange-400 border-orange-400/30" :
    score >= 20 ? "bg-amber-400/15 text-amber-400 border-amber-400/30" :
    "bg-emerald-400/15 text-emerald-400 border-emerald-400/30";
  const label = score >= 80 ? "Alto risco" : score >= 50 ? "Médio risco" : score >= 20 ? "Atenção" : "Baixo risco";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", cls)}>
      {label} ({score})
    </span>
  );
}

export default function AdminVerificationsTab() {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchVerifications = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("consultant_verifications" as any)
      .select("*, profiles:user_id(email)")
      .order("created_at", { ascending: false }));
    setVerifications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchVerifications(); }, []);

  const getDocUrl = async (path: string): Promise<string> => {
    if (!path || docUrls[path]) return docUrls[path] || "";
    const { data } = await supabase.storage.from("consultant-docs").createSignedUrl(path, 3600);
    const url = data?.signedUrl || "";
    setDocUrls(prev => ({ ...prev, [path]: url }));
    return url;
  };

  const expand = async (id: string, v: any) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (v.doc_identity) getDocUrl(v.doc_identity);
    if (v.doc_selfie) getDocUrl(v.doc_selfie);
    if (v.doc_professional) getDocUrl(v.doc_professional);
  };

  const setStatus = async (id: string, status: string, userId: string) => {
    setProcessing(id);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("consultant_verifications" as any).update({
      status,
      rejection_reason: status === "rejected" ? (rejectionReason[id] || "Documentos inválidos ou insuficientes.") : null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id));

    // Notify the consultant
    await supabase.from("notifications").insert({
      user_id: userId,
      title: status === "approved" ? "Verificação aprovada!" : status === "rejected" ? "Verificação rejeitada" : "Documentação em revisão adicional",
      message: status === "approved"
        ? "Seu perfil de consultor foi verificado. Você já pode oferecer consultoria na plataforma."
        : status === "rejected"
        ? `Sua verificação foi rejeitada: ${rejectionReason[id] || "Documentos inválidos."}`
        : "Precisamos de informações adicionais. Entre em contato com o suporte.",
      type: "verification",
    });

    toast({ title: status === "approved" ? "✓ Consultor aprovado" : status === "rejected" ? "✗ Verificação rejeitada" : "Sinalizado para revisão" });
    fetchVerifications();
    setProcessing(null);
  };

  const filterTabs = [
    { id: "all", label: "Todos" },
    { id: "pending", label: "Pendentes" },
    { id: "flagged", label: "Suspeitos" },
    { id: "in_review", label: "Em revisão" },
    { id: "approved", label: "Aprovados" },
    { id: "rejected", label: "Rejeitados" },
  ];
  const [filter, setFilter] = useState("all");

  const filtered = verifications.filter(v => filter === "all" || v.status === filter);
  const pendingCount = verifications.filter(v => v.status === "pending" || v.status === "flagged").length;

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filter === t.id ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.id === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-400 text-[#080D14] rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchVerifications}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground text-sm">
          Nenhuma verificação encontrada
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">Consultor</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">Registro</div>
            <div className="col-span-2">Risco</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1" />
          </div>

          {filtered.map(v => {
            const stCfg = STATUS_CFG[v.status] || STATUS_CFG.pending;
            const flags: string[] = Array.isArray(v.risk_flags) ? v.risk_flags : (v.risk_flags ? Object.values(v.risk_flags) : []);
            const isOpen = expanded === v.id;

            return (
              <div key={v.id} className="border-b border-border last:border-b-0">
                {/* Row */}
                <div className={cn("grid grid-cols-12 gap-2 items-center px-4 py-3 transition-colors",
                  v.risk_score >= 80 ? "bg-red-400/[0.03]" : v.risk_score >= 50 ? "bg-orange-400/[0.02]" : "hover:bg-secondary/30")}>
                  <div className="col-span-3">
                    <p className="text-sm font-medium truncate">{v.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.profiles?.email || ""}</p>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">{PROF_LABELS[v.professional_type] || v.professional_type}</div>
                  <div className="col-span-2 text-xs text-muted-foreground truncate">
                    {v.registration_number ? `${v.registration_number}/${v.registration_state}` : "—"}
                  </div>
                  <div className="col-span-2"><RiskBadge score={v.risk_score || 0} /></div>
                  <div className="col-span-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", stCfg.cls)}>{stCfg.label}</span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => expand(v.id, v)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/50 bg-secondary/10 space-y-4 pt-4">
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div><p className="text-xs text-muted-foreground">CPF</p><p className="font-mono">{v.cpf || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Telefone</p><p>{v.phone || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Experiência</p><p>{v.years_experience} anos</p></div>
                      <div><p className="text-xs text-muted-foreground">LinkedIn</p>
                        {v.linkedin_url ? <a href={v.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="text-accent hover:underline flex items-center gap-1">Ver perfil <ExternalLink className="h-3 w-3" /></a> : <p>—</p>}
                      </div>
                      <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Bio</p><p className="text-muted-foreground">{v.bio || "—"}</p></div>
                    </div>

                    {v.specialties?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Especialidades</p>
                        <div className="flex flex-wrap gap-1">
                          {v.specialties.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Documentos enviados</p>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { path: v.doc_identity, label: "Identidade" },
                          { path: v.doc_selfie, label: "Selfie" },
                          { path: v.doc_professional, label: "Registro prof." },
                        ].map(({ path, label }) => path ? (
                          <a key={label} href={docUrls[path] || "#"} target="_blank" rel="noopener noreferrer"
                            onClick={async e => { if (!docUrls[path]) { e.preventDefault(); const url = await getDocUrl(path); window.open(url, "_blank"); } }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-xs hover:border-accent/30 transition-colors">
                            <Shield className="h-3.5 w-3.5 text-accent" /> {label} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        ) : null)}
                        {!v.doc_identity && !v.doc_selfie && !v.doc_professional && (
                          <p className="text-xs text-muted-foreground">Nenhum documento enviado</p>
                        )}
                      </div>
                    </div>

                    {/* Risk flags */}
                    {flags.length > 0 && (
                      <div className="rounded-lg border border-orange-400/20 bg-orange-400/5 p-3">
                        <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Alertas antifraude
                        </p>
                        <ul className="space-y-1">
                          {flags.map((f: string, i: number) => (
                            <li key={i} className="text-xs text-white/60 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-orange-400" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    {["pending", "in_review", "flagged"].includes(v.status) && (
                      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                        <Button size="sm" className="bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 border border-emerald-400/20"
                          disabled={processing === v.id} onClick={() => setStatus(v.id, "approved", v.user_id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" className="bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 border border-cyan-400/20"
                          disabled={processing === v.id} onClick={() => setStatus(v.id, "in_review", v.user_id)}>
                          <Clock className="h-3.5 w-3.5 mr-1" /> Em revisão
                        </Button>
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            placeholder="Motivo da rejeição..."
                            value={rejectionReason[v.id] || ""}
                            onChange={e => setRejectionReason(prev => ({ ...prev, [v.id]: e.target.value }))}
                            className="flex-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive/50"
                          />
                          <Button size="sm" variant="destructive" disabled={processing === v.id}
                            onClick={() => setStatus(v.id, "rejected", v.user_id)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
