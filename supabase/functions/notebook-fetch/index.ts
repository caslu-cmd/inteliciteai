import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Importa o texto de uma URL para o Notebook. Exige usuário autenticado e
// bloqueia destinos internos (localhost, IPs privados, metadata de nuvem),
// inclusive após redirecionamentos — o servidor não pode virar proxy.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_CHARS = 50_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

// ── Proteção contra SSRF ────────────────────────────────────────────────
function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
    (a === 169 && b === 254) ||             // link-local / metadata de nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||               // 192.0.0.0/24, 192.0.2.0/24
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                                // multicast / reservado / broadcast
  );
}

function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("::ffff:")) {             // IPv4 mapeado
    const v4 = s.slice(7);
    return v4.includes(".") ? isPrivateV4(v4) : true;
  }
  const head = parseInt(s.split(":")[0] || "0", 16);
  return (
    (head & 0xfe00) === 0xfc00 ||            // fc00::/7  (ULA)
    (head & 0xffc0) === 0xfe80 ||            // fe80::/10 (link-local)
    (head & 0xff00) === 0xff00               // ff00::/8  (multicast)
  );
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

async function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa") ||
    host === "metadata.google.internal"
  ) throw new Error("Destino não permitido");

  if (isIpLiteral(host)) {
    const priv = host.includes(":") ? isPrivateV6(host) : isPrivateV4(host);
    if (priv) throw new Error("Destino não permitido");
    return;
  }

  const ips: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try { ips.push(...(await Deno.resolveDns(host, type))); } catch { /* sem registro desse tipo */ }
  }
  if (ips.length === 0) throw new Error("Não foi possível resolver o endereço");
  for (const ip of ips) {
    const priv = ip.includes(":") ? isPrivateV6(ip) : isPrivateV4(ip);
    if (priv) throw new Error("Destino não permitido");
  }
}

// Segue redirecionamentos manualmente, validando cada destino
async function safeFetch(startUrl: string): Promise<{ response: Response; finalUrl: URL }> {
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!["http:", "https:"].includes(current.protocol)) throw new Error("Apenas URLs HTTP/HTTPS são permitidas");
    await assertPublicHost(current.hostname);

    const response = await fetch(current.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InteliciteBot/1.0; +https://inteliciteai.com)",
        "Accept": "text/html,application/xhtml+xml,text/plain",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Redirecionamento sem destino");
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Redirecionamentos demais");
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); break; }
    parts.push(value);
  }
  const merged = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
  let offset = 0;
  for (const p of parts) { merged.set(p.subarray(0, merged.length - offset), offset); offset += p.byteLength; if (offset >= merged.length) break; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  let url = "";
  try { ({ url } = await req.json()); } catch { return json({ error: "JSON inválido" }, 400); }
  if (!url?.trim()) return json({ error: "URL obrigatória" }, 400);

  try { new URL(url); } catch { return json({ error: "URL inválida" }, 400); }

  try {
    const { response, finalUrl } = await safeFetch(url.trim());

    if (!response.ok) {
      await response.body?.cancel();
      return json({ error: `Não foi possível acessar a URL (HTTP ${response.status})` }, 400);
    }

    const contentType = response.headers.get("content-type") || "";
    let text = "";
    let title = finalUrl.hostname;

    if (contentType.includes("text/html")) {
      const html = await readCapped(response);
      title = extractTitle(html) || finalUrl.hostname;
      text = htmlToText(html);
    } else if (contentType.includes("text/plain")) {
      text = await readCapped(response);
    } else {
      await response.body?.cancel();
      return json({ error: `Tipo de conteúdo não suportado: ${contentType || "desconhecido"}` }, 400);
    }

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + "\n\n[Conteúdo truncado — máximo 50.000 caracteres]";
    }

    return json({ title, text, url: finalUrl.toString(), charCount: text.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "Destino não permitido" ? 400 : 502;
    return json({ error: status === 400 ? message : `Erro ao buscar URL: ${message}` }, status);
  }
});
