import logoWhite from "@/assets/logo-white.png";

export default function Footer() {
  return (
    <footer className="border-t border-landing-border bg-landing-bg py-12">
      <div className="container">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img
              src={logoWhite}
              alt="Intelicite"
              className="h-6 opacity-70"
            />
          </div>
          <div className="flex gap-6 text-sm text-landing-text-muted">
            <a href="#" className="transition-colors hover:text-landing-cyan">
              Termos de Uso
            </a>
            <a href="#" className="transition-colors hover:text-landing-cyan">
              Política de Privacidade
            </a>
            <a href="#" className="transition-colors hover:text-landing-cyan">
              LGPD
            </a>
            <a href="#" className="transition-colors hover:text-landing-cyan">
              Contato
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-landing-text-muted/60">
          © {new Date().getFullYear()} Intelicite. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}