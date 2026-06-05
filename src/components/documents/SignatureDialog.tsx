import { useState } from "react";
import { Pen, Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAsPdf } from "@/lib/exportDocument";

interface Doc {
  id: string;
  tipo: string;
  titulo: string;
  orgao: string;
  objeto: string;
  conteudo: string;
}

interface Signature {
  id: string;
  status: "pending" | "sent" | "signed" | "cancelled";
  signer_name: string;
  signer_email: string;
  clicksign_key: string;
  signed_at: string | null;
  created_at: string;
}

interface Props {
  doc: Doc | null;
  onClose: () => void;
}

const statusConfig = {
  pending:   { label: "Pendente",   color: "text-muted-foreground", icon: Loader2 },
  sent:      { label: "Enviado",    color: "text-amber-600",        icon: RefreshCw },
  signed:    { label: "Assinado",   color: "text-green-600",        icon: CheckCircle2 },
  cancelled: { label: "Cancelado",  color: "text-destructive",      icon: XCircle },
};

export function SignatureDialog({ doc, onClose }: Props) {
  const [step, setStep] = useState<"form" | "status">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  const loadSignatures = async () => {
    if (!doc) return;
    const { data } = await supabase
      .from("document_signatures")
      .select("*")
      .eq("document_id", doc.id)
      .order("created_at", { ascending: false });
    setSignatures((data as Signature[]) || []);
    if (data && data.length > 0) setStep("status");
  };

  const handleOpen = () => {
    loadSignatures();
  };

  const handleSend = async () => {
    if (!doc || !name.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail do signatário");
      return;
    }
    setLoading(true);
    try {
      // Gerar PDF como base64
      const htmlContent = `<!DOCTYPE html><html><body style="font-family: Times New Roman; font-size: 12pt; padding: 40px;">
        <h1 style="text-align:center; text-transform:uppercase;">${doc.titulo}</h1>
        ${doc.orgao ? `<p style="text-align:center;">${doc.orgao}</p>` : ""}
        <hr>
        <div style="white-space:pre-wrap;">${doc.objeto || ""}${doc.conteudo || ""}</div>
      </body></html>`;

      // Para simplificar, enviamos o HTML como base64
      const pdfBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("clicksign", {
        body: {
          action: "create_document",
          documentId: doc.id,
          pdfBase64,
          fileName: doc.titulo.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_"),
          signerName: name,
          signerEmail: email,
          signerCpf: cpf || undefined,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      toast.success("Documento enviado para assinatura!");
      setName(""); setEmail(""); setCpf("");
      await loadSignatures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar para assinatura");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (sigId: string) => {
    setChecking(sigId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("clicksign", {
        body: { action: "get_status", signatureId: sigId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await loadSignatures();
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao verificar status");
    } finally {
      setChecking(null);
    }
  };

  const handleCancel = async (sigId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke("clicksign", {
        body: { action: "cancel", signatureId: sigId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await loadSignatures();
      toast.success("Assinatura cancelada");
    } catch {
      toast.error("Erro ao cancelar");
    }
  };

  return (
    <Dialog open={!!doc} onOpenChange={open => { if (!open) { onClose(); setStep("form"); } }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5 text-primary" />
            Assinatura Eletrônica — ClickSign
          </DialogTitle>
        </DialogHeader>

        {doc && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Documento: <span className="font-medium text-foreground">{doc.titulo}</span>
            </p>

            {/* Histórico de assinaturas */}
            {signatures.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solicitações anteriores</p>
                {signatures.map(sig => {
                  const cfg = statusConfig[sig.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={sig.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${cfg.color} ${sig.status === "sent" ? "animate-spin" : ""}`} />
                        <div>
                          <p className="font-medium">{sig.signer_name}</p>
                          <p className="text-xs text-muted-foreground">{sig.signer_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                        {sig.status === "sent" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              disabled={checking === sig.id}
                              onClick={() => handleCheckStatus(sig.id)} title="Verificar status">
                              <RefreshCw className={`h-3.5 w-3.5 ${checking === sig.id ? "animate-spin" : ""}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                              onClick={() => handleCancel(sig.id)} title="Cancelar">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {sig.clicksign_key && (
                          <a href={`https://app.clicksign.com/sign/${sig.clicksign_key}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir no ClickSign">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulário nova assinatura */}
            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nova solicitação</p>
              <div className="space-y-2">
                <Label htmlFor="sig-name" className="text-xs">Nome do signatário *</Label>
                <Input id="sig-name" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig-email" className="text-xs">E-mail do signatário *</Label>
                <Input id="sig-email" type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig-cpf" className="text-xs">CPF (opcional)</Label>
                <Input id="sig-cpf" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
              </div>
              <Button className="w-full gap-2" onClick={handleSend} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pen className="h-4 w-4" />}
                Enviar para Assinatura
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              O signatário receberá um e-mail com o link para assinar via ClickSign.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
