import logoWhite from "@/assets/logo-white.png";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="container">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img
              src={logoWhite}
              alt="Intelicite"
              className="h-6"
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(18%) sepia(68%) saturate(1200%) hue-rotate(190deg)",
              }}
            />
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">
              Termos de Uso
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Política de Privacidade
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              LGPD
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Contato
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Intelicite. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
