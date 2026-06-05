import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Municipality {
  id: string;
  name: string;
  slug: string;
  state: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  favicon_url: string | null;
}

interface MunicipalityContextValue {
  orgao: Municipality | null;
  loading: boolean;
}

const MunicipalityContext = createContext<MunicipalityContextValue>({ orgao: null, loading: true });

export function useMunicipality() {
  return useContext(MunicipalityContext);
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyMunicipalityTheme(m: Municipality) {
  const root = document.documentElement;
  if (m.primary_color?.startsWith("#")) {
    const hsl = hexToHsl(m.primary_color);
    root.style.setProperty("--orgao-primary", m.primary_color);
    root.style.setProperty("--orgao-primary-hsl", hsl);
    // Aplica como accent da plataforma
    root.style.setProperty("--accent", hsl);
  }
  if (m.favicon_url) {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = m.favicon_url;
    document.head.appendChild(link);
  }
}

function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--orgao-primary");
  root.style.removeProperty("--orgao-primary-hsl");
  root.style.removeProperty("--accent");
}

export function MunicipalityProvider({ children }: { children: React.ReactNode }) {
  const [orgao, setOrgao] = useState<Municipality | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("municipality_id")
        .eq("id", user.id)
        .single();

      if (!profile?.municipality_id || cancelled) { setLoading(false); return; }

      const { data: mun } = await supabase
        .from("municipalities")
        .select("id, name, slug, state, logo_url, primary_color, secondary_color, favicon_url")
        .eq("id", profile.municipality_id)
        .eq("active", true)
        .single();

      if (!cancelled) {
        if (mun) {
          setOrgao(mun as Municipality);
          applyMunicipalityTheme(mun as Municipality);
        }
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; resetTheme(); };
  }, []);

  return (
    <MunicipalityContext.Provider value={{ orgao, loading }}>
      {children}
    </MunicipalityContext.Provider>
  );
}
