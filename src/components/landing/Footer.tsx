import { Link } from "react-router-dom";
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-landing-text-muted">
            <Link to="/termos" className="transition-colors hover:text-landing-cyan">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="transition-colors hover:text-landing-cyan">
              Política de Privacidade
            </Link>
            <Link to="/seguranca" className="transition-colors hover:text-landing-cyan">
              Segurança
            </Link>
            <a href="mailto:suporte@intelicite.com.br" className="transition-colors hover:text-landing-cyan">
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