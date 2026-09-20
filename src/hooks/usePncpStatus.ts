import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Estado do portal do PNCP, a partir do monitor (cron a cada 5 min) e do
// tráfego real do pncp-proxy, nos últimos minutos.
export type PncpStatus = "ok" | "instavel" | "fora" | "desconhecido";

export interface PncpStatusInfo {
  status: PncpStatus;
  ultimaChecagem: Date | null;
  consultaOk: boolean | null;   // fonte principal do Radar
  buscaOk: boolean | null;      // busca textual (reserva)
  loading: boolean;
}

const JANELA_MIN = 20;
const INTERVALO_MS = 60_000;

let cache: { info: PncpStatusInfo; ts: number } | null = null;

async function carregar(): Promise<PncpStatusInfo> {
  const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
  const { data, error } = await supabase
    .from("pncp_health")
    .select("checked_at, endpoint, ok")
    .gte("checked_at", desde)
    .order("checked_at", { ascending: false })
    .limit(40);

  if (error || !data || data.length === 0) {
    return { status: "desconhecido", ultimaChecagem: null, consultaOk: null, buscaOk: null, loading: false };
  }

  const rows = data as { checked_at: string; endpoint: string; ok: boolean }[];
  const ultimo = (ep: string) => rows.find((r) => r.endpoint === ep);
  const consulta = ultimo("consulta");
  const busca = ultimo("busca");
  const falhasRecentes = rows.filter((r) => !r.ok).length;

  let status: PncpStatus = "ok";
  // A consulta oficial é a fonte principal: se ela caiu (e a busca também, ou
  // nem há sinal dela), o portal está fora do ar para o que importa.
  if (consulta && !consulta.ok && (!busca || !busca.ok)) status = "fora";
  else if (falhasRecentes > 0) status = "instavel";

  return {
    status,
    ultimaChecagem: new Date(rows[0].checked_at),
    consultaOk: consulta ? consulta.ok : null,
    buscaOk: busca ? busca.ok : null,
    loading: false,
  };
}

export function usePncpStatus(): PncpStatusInfo {
  const [info, setInfo] = useState<PncpStatusInfo>(
    cache?.info ?? { status: "desconhecido", ultimaChecagem: null, consultaOk: null, buscaOk: null, loading: true },
  );

  useEffect(() => {
    let ativo = true;
    const tick = async () => {
      if (cache && Date.now() - cache.ts < INTERVALO_MS / 2) { if (ativo) setInfo(cache.info); return; }
      const novo = await carregar();
      cache = { info: novo, ts: Date.now() };
      if (ativo) setInfo(novo);
    };
    tick();
    const id = setInterval(tick, INTERVALO_MS);
    return () => { ativo = false; clearInterval(id); };
  }, []);

  return info;
}
