import { Link } from "react-router-dom";
import logoWhite from "@/assets/logo-white.png";
import { FileText, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "13 de maio de 2026";
const COMPANY = "Intelicite Tecnologia";
const EMAIL_CONTATO = "suporte@intelicite.com.br";

export default function TermsPage() {
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
            <FileText className="h-3.5 w-3.5 text-landing-cyan" /> Atualizado em {LAST_UPDATED}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="text-landing-text-muted text-sm leading-relaxed">
            Ao criar uma conta e utilizar o Intelicite, você declara ter lido, compreendido e concordado
            com estes Termos de Uso. Caso não concorde com alguma condição, não utilize a plataforma.
          </p>
        </div>

        <Section title="1. O que é o Intelicite">
          <p>
            O Intelicite é uma plataforma de inteligência artificial que auxilia agentes públicos, licitantes e
            consultores na elaboração de documentos licitatórios (ETP, TR, DFD, minutas de impugnação, entre outros)
            com base na Lei 14.133/2021 e demais normas aplicáveis às contratações públicas brasileiras.
          </p>
          <p>
            <strong>Os documentos gerados pela plataforma são sugestões produzidas por IA</strong> e devem
            ser revisados, adaptados e validados por profissional habilitado antes de uso oficial.
            O Intelicite não presta assessoria jurídica, contábil ou consultoria profissional regulamentada.
          </p>
        </Section>

        <Section title="2. Cadastro e acesso">
          <ul>
            <li>Você deve ter capacidade civil para contratar (18 anos ou ser representante autorizado de pessoa jurídica)</li>
            <li>As informações fornecidas no cadastro devem ser verdadeiras e mantidas atualizadas</li>
            <li>Você é responsável pela confidencialidade de sua senha e por todas as ações realizadas com sua conta</li>
            <li>É vedado compartilhar credenciais de acesso com terceiros</li>
            <li>O Intelicite pode encerrar contas que violem estes Termos ou que apresentem uso fraudulento</li>
          </ul>
        </Section>

        <Section title="3. Uso permitido">
          <p>A plataforma pode ser utilizada para:</p>
          <ul>
            <li>Elaboração e revisão de documentos licitatórios para fins profissionais legítimos</li>
            <li>Pesquisa e consulta de referências normativas em contratações públicas</li>
            <li>Organização e gestão do próprio fluxo de trabalho em licitações</li>
          </ul>
          <p>É <strong>expressamente proibido</strong>:</p>
          <ul>
            <li>Usar a plataforma para elaborar documentos fraudulentos, enganosos ou com fins ilícitos</li>
            <li>Tentar acessar dados de outros usuários ou burlar as restrições de segurança</li>
            <li>Realizar engenharia reversa, copiar ou redistribuir o código ou algoritmos da plataforma</li>
            <li>Usar automações (bots, scripts) para extração massiva de dados ou abuso de recursos</li>
            <li>Inserir conteúdos que violem direitos de terceiros, sejam difamatórios ou ilícitos</li>
          </ul>
        </Section>

        <Section title="4. Responsabilidade pelos documentos gerados">
          <p>
            O Intelicite usa inteligência artificial para auxiliar na redação de documentos. Entretanto:
          </p>
          <ul>
            <li>A <strong>responsabilidade pela revisão, adequação e uso oficial</strong> dos documentos é inteiramente do usuário</li>
            <li>A IA pode cometer erros, omissões ou desatualizações normativas — sempre revise com atenção</li>
            <li>Documentos gerados não constituem pareceres jurídicos, laudos técnicos ou manifestações profissionais formais</li>
            <li>O Intelicite não se responsabiliza por danos decorrentes do uso de documentos gerados sem a devida revisão profissional</li>
          </ul>
        </Section>

        <Section title="5. Planos e pagamentos">
          <ul>
            <li>O período de teste gratuito (trial) tem duração definida e comunicada no momento do cadastro</li>
            <li>Após o trial, o acesso a funcionalidades avançadas requer assinatura do plano correspondente</li>
            <li>Valores, formas de pagamento e periodicidade são os exibidos na página de planos no momento da contratação</li>
            <li>Cancelamentos entram em vigor no fim do ciclo de cobrança vigente — não há estorno proporcional de períodos já pagos, exceto nos casos previstos no Código de Defesa do Consumidor</li>
            <li>O direito de arrependimento previsto no CDC (7 dias corridos a partir da contratação) é assegurado para contratações realizadas online</li>
          </ul>
        </Section>

        <Section title="6. Propriedade intelectual">
          <p>
            Todo o código-fonte, design, marca e conteúdo editorial do Intelicite são de propriedade exclusiva da {COMPANY}.
            Os documentos <strong>gerados por você</strong> dentro da plataforma pertencem a você — o Intelicite não
            reivindica direitos sobre o conteúdo produzido a partir dos seus dados.
          </p>
        </Section>

        <Section title="7. Disponibilidade e manutenção">
          <p>
            Nos esforçamos para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta.
            Manutenções programadas serão comunicadas com antecedência. O Intelicite não se responsabiliza por
            prejuízos decorrentes de indisponibilidade temporária.
          </p>
        </Section>

        <Section title="8. Limitação de responsabilidade">
          <p>
            Na máxima extensão permitida pela lei, a responsabilidade total do Intelicite por quaisquer danos
            fica limitada ao valor pago pelo usuário nos últimos 3 meses de assinatura.
            O Intelicite não se responsabiliza por danos indiretos, perda de receita, perda de dados ou
            danos consequentes decorrentes do uso ou impossibilidade de uso da plataforma.
          </p>
        </Section>

        <Section title="9. Rescisão">
          <p>
            Você pode encerrar sua conta a qualquer momento nas configurações da plataforma.
            O Intelicite pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso prévio
            dependendo da gravidade da violação.
          </p>
        </Section>

        <Section title="10. Lei aplicável e foro">
          <p>
            Estes Termos são regidos pelas leis brasileiras. Eventuais disputas serão submetidas ao foro
            da comarca do domicílio do usuário, ressalvado o disposto no Código de Defesa do Consumidor.
          </p>
        </Section>

        <Section title="11. Contato">
          <p>
            Dúvidas sobre estes Termos:{" "}
            <a href={`mailto:${EMAIL_CONTATO}`} className="text-landing-cyan hover:underline">{EMAIL_CONTATO}</a>
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
