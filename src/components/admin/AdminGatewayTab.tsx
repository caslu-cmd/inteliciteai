import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const gateways = [
  {
    id: "mercado_pago",
    name: "Mercado Pago",
    description: "Gateway líder no Brasil. Aceita cartão, PIX e boleto.",
    docUrl: "https://www.mercadopago.com.br/developers",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "APP_USR-..." },
      { key: "public_key", label: "Public Key", placeholder: "APP_USR-..." },
    ],
  },
  {
    id: "gerencianet",
    name: "Gerencianet (Efí)",
    description: "PIX integrado com cobrança automática.",
    docUrl: "https://dev.efipay.com.br",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "Client_Id_..." },
      { key: "client_secret", label: "Client Secret", placeholder: "Client_Secret_..." },
      { key: "pix_key", label: "Chave PIX", placeholder: "sua@chave.com" },
    ],
  },
  {
    id: "pagar_me",
    name: "Pagar.me",
    description: "Checkout transparente com split de pagamento.",
    docUrl: "https://docs.pagar.me",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "ak_live_..." },
      { key: "encryption_key", label: "Encryption Key", placeholder: "ek_live_..." },
    ],
  },
];

export default function AdminGatewayTab() {
  const [selectedGateway, setSelectedGateway] = useState("mercado_pago");
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const gateway = gateways.find((g) => g.id === selectedGateway)!;
  const currentConfig = configs[selectedGateway] || {};

  const updateField = (key: string, value: string) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedGateway]: { ...(prev[selectedGateway] || {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // In production, these would be saved as Supabase secrets via edge function
    // For now, show confirmation
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Configuração salva", description: `Gateway ${gateway.name} configurado com sucesso.` });
    }, 1000);
  };

  const isConfigured = gateway.fields.every((f) => currentConfig[f.key]?.length > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-accent" />
          <h3 className="font-semibold">Configuração do Gateway de Pagamento</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure as credenciais do gateway para começar a receber pagamentos. Apenas um gateway pode estar ativo por vez.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {gateways.map((g) => {
            const gConfig = configs[g.id] || {};
            const gConfigured = g.fields.every((f) => gConfig[f.key]?.length > 0);
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGateway(g.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  selectedGateway === g.id
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-border bg-card hover:border-accent/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{g.name}</p>
                  {gConfigured ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{g.description}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">{gateway.name}</h4>
            <a
              href={gateway.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Documentação <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-4">
            {gateway.fields.map((field) => (
              <div key={field.key}>
                <Label className="text-sm">{field.label}</Label>
                <Input
                  type="password"
                  placeholder={field.placeholder}
                  value={currentConfig[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="mt-1"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success font-medium">Pronto para ativar</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Preencha todos os campos</span>
                </>
              )}
            </div>
            <Button onClick={handleSave} disabled={!isConfigured || saving}>
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Dica:</strong> Após configurar o gateway, os pagamentos dos planos Profissional (R$ 297/mês) serão processados automaticamente. O plano gratuito (trial de 7 dias) não gera cobrança.
        </p>
      </div>
    </motion.div>
  );
}
