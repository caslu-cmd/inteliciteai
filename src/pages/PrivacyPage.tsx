import { Link } from "react-router-dom";
import logoWhite from "@/assets/logo-white.png";
import { Shield, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "13 de maio de 2026";
const COMPANY = "Intelicite Tecnologia";
const EMAIL_CONTATO = "privacidade@intelicite.com.br";

export default function PrivacyPage() {
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

      <main className="container max-w-3xl py-16 space-y-10">
        {/* Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-landing-border bg-landing-surface text-xs text-landing-text-muted">
            <Shield className="h-3.5 w-3.5 text-landing-cyan" /> Atualizado em {LAST_UPDATED}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="text-landing-text-muted text-sm leading-relaxed">
            Esta Política descreve como o Intelicite coleta, usa, armazena e protege as suas informações,
            em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
          </p>
        </div>

        <Section title="1. Quem somos">
          <p>
            O Intelicite é uma plataforma SaaS de inteligência artificial voltada para gestores públicos, licitantes e consultores
            que atuam em processos licitatórios regulados pela Lei 14.133/2021. O controlador dos dados é a <strong>{COMPANY}</strong>,
            responsável pelas decisões sobre o tratamento das informações pessoais coletadas.
          </p>
          <p>
            Para dúvidas sobre privacidade, entre em contato pelo e-mail: <a href={`mailto:${EMAIL_CONTATO}`} className="text-landing-cyan hover:underline">{EMAIL_CONTATO}</a>
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <SubTitle>2.1 Dados de cadastro</SubTitle>
          <ul>
            <li>Nome completo e endereço de e-mail</li>
            <li>Organização / órgão de vínculo</li>
            <li>Perfil de uso (gestor público, licitante ou consultor)</li>
          </ul>
          <SubTitle>2.2 Dados profissionais (consultores)</SubTitle>
          <ul>
            <li>CPF (armazenado de forma criptografada)</li>
            <li>Telefone, data de nascimento</li>
            <li>Tipo profissional e número de registro (OAB, CRC, CRA etc.)</li>
            <li>Documentos de identidade e selfie de verificação (armazenados em bucket privado, não acessíveis publicamente)</li>
          </ul>
          <SubTitle>2.3 Dados de uso</SubTitle>
          <ul>
            <li>Documentos gerados (ETP, TR, DFD, minutas) e conteúdos inseridos nos formulários</li>
            <li>Fontes adicionadas ao Notebook IA</li>
            <li>Logs de acesso, endereço IP e tipo de dispositivo (para segurança)</li>
          </ul>
        </Section>

        <Section title="3. Como usamos seus dados">
          <ul>
            <li><strong>Prestação do serviço:</strong> geração de documentos, análises e sugestões via IA com base nas informações fornecidas por você</li>
            <li><strong>Verificação de identidade:</strong> exclusivamente para consultores, para garantir a autenticidade do perfil</li>
            <li><strong>Segurança da conta:</strong> detecção de acessos suspeitos e prevenção de fraudes</li>
            <li><strong>Comunicações:</strong> notificações sobre sua conta, atualizações relevantes da plataforma (sem spam)</li>
            <li><strong>Melhoria do serviço:</strong> análise agregada e anonimizada de uso para aprimoramento de funcionalidades</li>
          </ul>
          <p>
            <strong>Não usamos seus dados para treinar modelos de inteligência artificial.</strong> Os conteúdos enviados à API da Anthropic (Claude)
            são processados para geração da resposta e não são retidos ou usados em treinamentos conforme a política da Anthropic.
          </p>
        </Section>

        <Section title="4. Compartilhamento de dados">
          <p>
            O Intelicite <strong>não vende, aluga ou compartilha</strong> seus dados pessoais com terceiros para fins comerciais.
            O compartilhamento ocorre apenas nas seguintes situações:
          </p>
          <ul>
            <li><strong>Supabase (infraestrutura de banco de dados e storage):</strong> provedor de infraestrutura com certificação SOC 2, responsável pelo armazenamento seguro dos dados</li>
            <li><strong>Anthropic (API de IA):</strong> os conteúdos dos formulários são enviados para geração de documentos; a Anthropic não retém esses dados para treinamento</li>
            <li><strong>Obrigação legal:</strong> quando exigido por autoridade competente, ordem judicial ou regulação aplicável</li>
          </ul>
        </Section>

        <Section title="5. Segurança dos dados">
          <ul>
            <li>Senhas armazenadas com hash bcrypt — nunca em texto simples</li>
            <li>Autenticação com tokens JWT com prazo de expiração</li>
            <li>Row Level Security (RLS) no banco de dados: cada usuário acessa apenas os próprios registros, garantido em nível de infraestrutura</li>
            <li>Documentos de consultores armazenados em bucket privado — inacessíveis publicamente</li>
            <li>Comunicação criptografada via HTTPS/TLS em todas as rotas</li>
            <li>Infraestrutura hospedada na AWS com disponibilidade e backups gerenciados pelo Supabase</li>
          </ul>
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          <p>Conforme a Lei 13.709/2018, você tem direito a:</p>
          <ul>
            <li>Confirmar se tratamos seus dados</li>
            <li>Acessar os dados que temos sobre você</li>
            <li>Corrigir dados incompletos ou incorretos</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Solicitar portabilidade dos seus dados</li>
            <li>Revogar consentimento a qualquer momento</li>
            <li>Solicitar a exclusão da conta e de todos os dados associados</li>
          </ul>
          <p>
            Para exercer qualquer desses direitos, envie um e-mail para{" "}
            <a href={`mailto:${EMAIL_CONTATO}`} className="text-landing-cyan hover:underline">{EMAIL_CONTATO}</a>.
            Responderemos em até 15 dias úteis.
          </p>
        </Section>

        <Section title="7. Retenção de dados">
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão da conta, os dados pessoais são removidos
            em até 30 dias, exceto quando houver obrigação legal de retenção (ex.: registros fiscais).
            Documentos gerados dentro da plataforma são excluídos junto com a conta.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Utilizamos cookies essenciais para manter a sessão autenticada. Não usamos cookies de rastreamento,
            publicidade comportamental ou pixels de terceiros.
          </p>
        </Section>

        <Section title="9. Alterações nesta política">
          <p>
            Podemos atualizar esta política periodicamente. Em caso de mudanças relevantes, notificaremos
            os usuários por e-mail com antecedência mínima de 10 dias. A data de última atualização sempre
            estará indicada no topo desta página.
          </p>
        </Section>

        <div className="border-t border-landing-border pt-8 text-xs text-landing-text-muted space-y-1">
          <p>© {new Date().getFullYear()} {COMPANY}. Todos os direitos reservados.</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-landing-text">{title}</h2>
      <div className="space-y-3 text-sm text-landing-text-muted leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1.5 [&>p]:text-landing-text-muted">
        {children}
      </div>
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-landing-text pt-1">{children}</p>;
}
