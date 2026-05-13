import { Link } from "react-router-dom";
import logoWhite from "@/assets/logo-white.png";
import { ArrowLeft, Lock, Server, Eye, ShieldCheck, Key, Database } from "lucide-react";

const LAST_UPDATED = "13 de maio de 2026";

const PILLARS = [
  {
    icon: Lock,
    title: "Senhas nunca legíveis",
    desc: "Sua senha é transformada em um hash irreversível com bcrypt antes de ser armazenada. Nem a equipe do Intelicite tem acesso à sua senha real.",
  },
  {
    icon: Key,
    title: "Sessões com token JWT",
    desc: "Após o login, você recebe um token de sessão assinado digitalmente com prazo de expiração. Tokens inválidos ou expirados são rejeitados automaticamente.",
  },
  {
    icon: Database,
    title: "Isolamento total de dados",
    desc: "Row Level Security (RLS) garante que cada usuário acesse apenas os próprios registros — isso é imposto no banco de dados, não apenas na aplicação.",
  },
  {
    icon: Eye,
    title: "Documentos privados",
    desc: "Arquivos enviados (documentos de verificação de consultores) ficam em buckets privados. Nenhum link público existe — o acesso exige autenticação.",
  },
  {
    icon: Server,
    title: "Infraestrutura certificada",
    desc: "Os dados são armazenados no Supabase (AWS), plataforma com certificação SOC 2 Type 2. Toda comunicação é criptografada via HTTPS/TLS.",
  },
  {
    icon: ShieldCheck,
    title: "IA sem retenção de dados",
    desc: "Os documentos processados pela IA (Claude / Anthropic) não são usados para treinamento de modelos. A Anthropic não retém conteúdo de API para fins de aprendizado.",
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-text">
      {/* Header */}
      <header className="border-b border-landing-border bg-landing-bg/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Intelicite" className="h-7 opacity-80" />
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-landing-text-muted hover:text-landing-cyan transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-16 space-y-14">
        {/* Title */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-landing-border bg-landing-surface text-xs text-landing-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-landing-cyan" /> Atualizado em {LAST_UPDATED}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
          <p className="text-landing-text-muted text-sm leading-relaxed max-w-xl">
            O Intelicite foi construído com segurança como prioridade desde o primeiro dia.
            Entendemos que você confia à plataforma documentos e dados sensíveis do setor público —
            e levamos isso muito a sério.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-landing-border bg-landing-surface p-5 space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-landing-cyan/10">
                <Icon className="h-4.5 w-4.5 text-landing-cyan h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-landing-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Stack section */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Nossa stack de segurança</h2>
          <div className="space-y-3">
            {[
              { label: "Banco de dados", value: "Supabase (PostgreSQL) — SOC 2 Type 2, hospedado na AWS" },
              { label: "Autenticação", value: "Supabase Auth com JWT assinados RS256, refresh tokens rotativos" },
              { label: "Autorização", value: "Row Level Security (RLS) — políticas aplicadas no nível do banco" },
              { label: "Storage de arquivos", value: "Supabase Storage com buckets privados + políticas de acesso por usuário" },
              { label: "Transporte", value: "HTTPS/TLS 1.2+ em todas as rotas — sem exceções" },
              { label: "Senhas", value: "bcrypt com salt aleatório — hash irreversível, nunca texto simples" },
              { label: "IA", value: "Anthropic Claude API — dados não são usados para treinar modelos (Enterprise Data Privacy)" },
              { label: "Frontend", value: "React com CSP headers, sem armazenamento de dados sensíveis em localStorage" },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4 py-3 border-b border-landing-border/60 text-sm">
                <span className="text-landing-text-muted shrink-0 w-36">{label}</span>
                <span className="text-landing-text">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Perguntas frequentes sobre segurança</h2>
          <div className="space-y-5">
            {[
              {
                q: "A equipe do Intelicite pode ler meus documentos?",
                a: "Tecnicamente, administradores da plataforma têm acesso ao banco de dados por necessidade operacional. Na prática, não monitoramos, lemos ou processamos o conteúdo dos seus documentos. Os dados de consultores ficam em storage privado com acesso restrito.",
              },
              {
                q: "O que acontece com os documentos que eu envio para a IA processar?",
                a: "Os conteúdos são enviados à API da Anthropic exclusivamente para geração da resposta. A Anthropic não retém esses dados para treinar modelos (conforme a política de privacidade da API deles). O resultado gerado fica armazenado na sua conta dentro do Intelicite.",
              },
              {
                q: "E se eu quiser excluir minha conta e todos os meus dados?",
                a: "Basta solicitar a exclusão pelo e-mail privacidade@intelicite.com.br. Todos os seus documentos, dados e arquivos são removidos em até 30 dias.",
              },
              {
                q: "Vocês fazem backups? Meus dados podem ser perdidos?",
                a: "O Supabase realiza backups automáticos diários com retenção de 7 dias. Seus dados estão protegidos contra falhas de hardware.",
              },
              {
                q: "Posso usar o Intelicite para documentos sigilosos ou com restrição de acesso?",
                a: "Recomendamos cautela com documentos classificados ou de alto sigilo. A plataforma é segura para uso profissional padrão no contexto de licitações públicas. Para documentos com classificação de sigilo especial, consulte a política de segurança da informação do seu órgão.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="space-y-2">
                <p className="text-sm font-semibold">{q}</p>
                <p className="text-sm text-landing-text-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Report vulnerability */}
        <div className="rounded-xl border border-landing-cyan/20 bg-landing-cyan/5 p-6 space-y-2">
          <h3 className="font-semibold text-sm text-landing-cyan">Encontrou uma vulnerabilidade?</h3>
          <p className="text-sm text-landing-text-muted leading-relaxed">
            Se você identificou um problema de segurança na plataforma, entre em contato de forma responsável
            pelo e-mail <a href="mailto:seguranca@intelicite.com.br" className="text-landing-cyan hover:underline">seguranca@intelicite.com.br</a>.
            Não divulgue publicamente antes de recebermos e avaliarmos o relatório. Agradecemos qualquer contribuição para tornar a plataforma mais segura.
          </p>
        </div>

        <div className="border-t border-landing-border pt-8 text-xs text-landing-text-muted space-y-1">
          <p>© {new Date().getFullYear()} Intelicite Tecnologia. Todos os direitos reservados.</p>
          <p>
            <Link to="/termos" className="hover:text-landing-cyan transition-colors">Termos de Uso</Link>
            {" · "}
            <Link to="/privacidade" className="hover:text-landing-cyan transition-colors">Política de Privacidade</Link>
            {" · "}
            <Link to="/seguranca" className="hover:text-landing-cyan transition-colors">Segurança</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
