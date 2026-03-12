import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { useState, useEffect } from "react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-landing-border"
          : "bg-transparent"
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logoWhite}
            alt="Intelicite"
            className="h-8 brightness-0 invert"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#funcionalidades"
            className="text-sm font-medium text-landing-text-muted transition-colors hover:text-landing-cyan"
          >
            Funcionalidades
          </a>
          <a
            href="#planos"
            className="text-sm font-medium text-landing-text-muted transition-colors hover:text-landing-cyan"
          >
            Planos
          </a>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-landing-text-muted hover:text-landing-text hover:bg-landing-surface-2">
              Entrar
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-gradient-cyber text-white border-0 glow-cyan hover:opacity-90 font-semibold">
              Teste grátis <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-landing-text"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="glass border-t border-landing-border md:hidden">
          <div className="container flex flex-col gap-4 py-6">
            <a
              href="#funcionalidades"
              className="text-sm font-medium text-landing-text-muted"
              onClick={() => setMobileOpen(false)}
            >
              Funcionalidades
            </a>
            <a
              href="#planos"
              className="text-sm font-medium text-landing-text-muted"
              onClick={() => setMobileOpen(false)}
            >
              Planos
            </a>
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-landing-text-muted hover:text-landing-text">
                Entrar
              </Button>
            </Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full bg-gradient-cyber text-white glow-cyan">
                Teste grátis
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}