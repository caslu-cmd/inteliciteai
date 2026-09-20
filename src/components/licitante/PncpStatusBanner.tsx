import { AlertTriangle, WifiOff } from "lucide-react";
import { usePncpStatus } from "@/hooks/usePncpStatus";

// Aviso no topo de todas as telas do licitante quando o portal do PNCP
// (governo federal) está instável ou fora do ar. Some quando está operante.
export function PncpStatusBanner() {
  const { status, ultimaChecagem, consultaOk } = usePncpStatus();
  if (status === "ok" || status === "desconhecido") return null;

  const fora = status === "fora";
  const hora = ultimaChecagem
    ? ultimaChecagem.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      role="status"
      className={`px-4 md:px-6 py-2.5 border-b flex items-start md:items-center gap-3 text-sm ${
        fora
          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
      }`}
    >
      {fora ? <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5 md:mt-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 md:mt-0" />}
      <p className="leading-snug">
        <span className="font-semibold">
          {fora ? "O portal do PNCP está fora do ar." : "O portal do PNCP está instável."}
        </span>{" "}
        <span className="opacity-90">
          {fora
            ? "É o sistema do governo federal, não a Intelicite. O Radar mostra os últimos resultados guardados e os links do PNCP podem dar erro — tente de novo em alguns minutos."
            : consultaOk === false
              ? "A consulta oficial está falhando; o Radar pode usar a busca de reserva ou o cache. Confira os prazos antes de decidir."
              : "Buscas podem demorar mais ou vir do cache. Os links \"Abrir no PNCP\" podem dar erro até normalizar."}
        </span>
        {hora && <span className="opacity-70"> · verificado às {hora}</span>}
      </p>
    </div>
  );
}

// Chip compacto para a barra lateral: bolinha + "PNCP".
export function PncpStatusChip({ collapsed }: { collapsed: boolean }) {
  const { status, ultimaChecagem } = usePncpStatus();
  const cor =
    status === "ok" ? "bg-emerald-500" :
    status === "instavel" ? "bg-amber-500" :
    status === "fora" ? "bg-red-500" : "bg-muted-foreground/40";
  const rotulo =
    status === "ok" ? "PNCP operante" :
    status === "instavel" ? "PNCP instável" :
    status === "fora" ? "PNCP fora do ar" : "PNCP: sem dados";
  const hora = ultimaChecagem
    ? ultimaChecagem.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground"
      title={`${rotulo}${hora ? ` · verificado às ${hora}` : ""} — monitor da Intelicite sobre o portal do governo`}
    >
      <span className="relative flex h-5 w-5 items-center justify-center flex-shrink-0">
        <span className={`h-2 w-2 rounded-full ${cor}`} />
        {status === "instavel" || status === "fora" ? (
          <span className={`absolute h-2 w-2 rounded-full ${cor} animate-ping opacity-60`} />
        ) : null}
      </span>
      {!collapsed && <span className="whitespace-nowrap">{rotulo}</span>}
    </div>
  );
}
