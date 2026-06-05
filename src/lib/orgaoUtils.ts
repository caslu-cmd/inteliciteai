import { supabase } from "@/integrations/supabase/client";

export async function getMunicipalityId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("municipality_id").eq("id", user.id).single();
  return data?.municipality_id ?? null;
}

export async function indexDocumentMemory(documentId: string, tipo: string, content: string) {
  const municipalityId = await getMunicipalityId();
  if (!municipalityId || !content) return;

  const { data: { session } } = await supabase.auth.getSession();
  await supabase.functions.invoke("index-document-memory", {
    body: { documentId, municipalityId, tipo, content },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  }).catch(() => {/* best-effort */});
}

export async function getRegulationContext(query: string): Promise<string> {
  const municipalityId = await getMunicipalityId();
  if (!municipalityId) return "";

  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke("search-regulations", {
    body: { query, municipalityId, matchCount: 4 },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  }).catch(() => ({ data: null }));

  return res?.data?.context ?? "";
}

export async function getLegalContext(query: string, includeWebSearch = false): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke("search-legal", {
    body: { query, matchCount: 5, includeWebSearch },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  }).catch(() => ({ data: null }));

  return res?.data?.context ?? "";
}

export async function getFullContext(query: string): Promise<string> {
  const [regulationCtx, legalCtx] = await Promise.all([
    getRegulationContext(query).catch(() => ""),
    getLegalContext(query).catch(() => ""),
  ]);
  return [regulationCtx, legalCtx].filter(Boolean).join("\n\n---\n\n");
}
