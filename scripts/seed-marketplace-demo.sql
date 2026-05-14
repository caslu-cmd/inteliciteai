-- ============================================================
-- SEED: Projetos fictícios para o Marketplace do Consultor
-- Execute no SQL Editor do Supabase (projeto Intelicite)
-- ============================================================

-- 1. Cria as tabelas do marketplace se ainda não existirem
CREATE TABLE IF NOT EXISTS public.marketplace_projects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  category                TEXT NOT NULL,
  budget_min              INTEGER NOT NULL DEFAULT 0,
  budget_max              INTEGER NOT NULL DEFAULT 0,
  deadline                DATE,
  requirements            TEXT,
  status                  TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','contracted','in_progress','delivered','completed','cancelled')),
  selected_application_id UUID,
  platform_fee_pct        INTEGER NOT NULL DEFAULT 20,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES public.marketplace_projects(id) ON DELETE CASCADE NOT NULL,
  consultant_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  proposal         TEXT NOT NULL,
  proposed_value   INTEGER NOT NULL,
  estimated_days   INTEGER NOT NULL DEFAULT 7,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, consultant_id)
);

CREATE TABLE IF NOT EXISTS public.project_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES public.marketplace_projects(id) ON DELETE CASCADE NOT NULL,
  application_id   UUID REFERENCES public.project_applications(id),
  sender_id        UUID REFERENCES auth.users(id) NOT NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilita RLS (seguro re-executar)
ALTER TABLE public.marketplace_projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages        ENABLE ROW LEVEL SECURITY;

-- 3. Permite client_id nulo (projetos demo não têm dono real)
ALTER TABLE public.marketplace_projects ALTER COLUMN client_id DROP NOT NULL;

-- 4. Recria a política de leitura para incluir projetos demo (client_id IS NULL)
DROP POLICY IF EXISTS "Anyone authenticated reads open projects" ON public.marketplace_projects;
CREATE POLICY "Anyone authenticated reads open projects"
  ON public.marketplace_projects FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      status = 'open'
      OR client_id IS NULL
      OR client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_applications
        WHERE project_id = marketplace_projects.id
          AND consultant_id = auth.uid()
      )
    )
  );

-- Políticas de escrita (sem alteração)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients create projects' AND tablename = 'marketplace_projects') THEN
    EXECUTE 'CREATE POLICY "Clients create projects" ON public.marketplace_projects FOR INSERT WITH CHECK (client_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients update own projects' AND tablename = 'marketplace_projects') THEN
    EXECUTE 'CREATE POLICY "Clients update own projects" ON public.marketplace_projects FOR UPDATE USING (client_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Consultants and clients read applications' AND tablename = 'project_applications') THEN
    EXECUTE 'CREATE POLICY "Consultants and clients read applications" ON public.project_applications FOR SELECT USING (consultant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Consultants apply to projects' AND tablename = 'project_applications') THEN
    EXECUTE 'CREATE POLICY "Consultants apply to projects" ON public.project_applications FOR INSERT WITH CHECK (consultant_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Consultants update own applications' AND tablename = 'project_applications') THEN
    EXECUTE 'CREATE POLICY "Consultants update own applications" ON public.project_applications FOR UPDATE USING (consultant_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients update applications on their projects' AND tablename = 'project_applications') THEN
    EXECUTE 'CREATE POLICY "Clients update applications on their projects" ON public.project_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project participants read messages' AND tablename = 'project_messages') THEN
    EXECUTE 'CREATE POLICY "Project participants read messages" ON public.project_messages FOR SELECT USING (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.project_applications WHERE project_id = project_messages.project_id AND consultant_id = auth.uid()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project participants send messages' AND tablename = 'project_messages') THEN
    EXECUTE 'CREATE POLICY "Project participants send messages" ON public.project_messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND (EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.project_applications WHERE project_id = project_messages.project_id AND consultant_id = auth.uid())))';
  END IF;
END $$;

-- 5. Insere projetos fictícios (client_id = NULL → projetos demo)
INSERT INTO public.marketplace_projects
  (client_id, title, description, category, budget_min, budget_max, deadline, requirements, status)
VALUES
  (
    NULL,
    'Elaboração de ETP para Sistema de Gestão Hospitalar',
    'Prefeitura de Campinas/SP necessita de consultor especializado para elaborar Estudo Técnico Preliminar (ETP) visando a contratação de sistema integrado de gestão hospitalar para o HMC — Hospital Municipal Dr. Mário Gatti. O documento deverá atender integralmente ao art. 18 da Lei 14.133/2021 e incluir levantamento de mercado, análise de soluções disponíveis e estimativa de custo.',
    'etp',
    350000, 700000,
    '2026-06-30',
    'Experiência comprovada em licitações da área de TI/Saúde. Conhecimento da Lei 14.133/2021. Já ter elaborado ao menos 2 ETPs nos últimos 3 anos (apresentar amostras).'
  ),
  (
    NULL,
    'Termo de Referência para Contratação de Serviços de Cloud Computing',
    'Tribunal de Contas do Estado do Maranhão (TCE-MA) busca consultor para redigir Termo de Referência completo para contratação de infraestrutura em nuvem (IaaS/PaaS). O TR deverá incluir modelo de contratação, métricas de desempenho (SLA), critérios de habilitação técnica e estimativas de consumo baseadas no histórico dos últimos 24 meses.',
    'tr',
    280000, 550000,
    '2026-07-20',
    'Experiência em contratações de TI pelo setor público. Conhecimento em cloud computing (AWS, Azure ou GCP). Domínio do IN SGD/ME nº 94/2022.'
  ),
  (
    NULL,
    'Assessoria Jurídica em Pregão Eletrônico — Equipamentos Médico-Hospitalares',
    'Secretaria de Saúde do Estado de Goiás necessita de advogado especialista em licitações para conduzir pregão eletrônico no valor estimado de R$ 4,2 milhões para aquisição de equipamentos médico-hospitalares. O consultor auxiliará desde a fase preparatória até a homologação, incluindo análise de recursos e impugnações.',
    'pregao',
    480000, 900000,
    '2026-08-15',
    'Advogado inscrito na OAB. Mínimo de 5 pregões eletrônicos conduzidos. Experiência com COMPRASNET e BEC/SP.'
  ),
  (
    NULL,
    'Impugnação de Edital — Concorrência para Obras de Saneamento',
    'Empresa licitante contratará consultor jurídico para elaborar impugnação fundamentada ao Edital nº 003/2026 da SABESP, referente à contratação de obras de ampliação da rede de saneamento básico (R$ 12 milhões). O prazo para protocolo da impugnação é curto; consultor deve iniciar imediatamente.',
    'impugnacao',
    150000, 300000,
    '2026-05-28',
    'Advogado com experiência em direito administrativo e licitações de obras. Conhecimento da Lei 14.133/2021 e jurisprudência do TCU sobre obras públicas. Disponibilidade imediata.'
  ),
  (
    NULL,
    'Elaboração de DFD e Planejamento de Contratações 2027',
    'Instituto Federal de Educação, Ciência e Tecnologia do Paraná (IFPR) busca consultor para elaborar o Documento de Formalização da Demanda (DFD) e auxiliar na montagem do Plano de Contratações Anual (PCA) 2027, conforme Decreto nº 10.947/2022. Escopo inclui mapeamento de necessidades de 22 campi, consolidação e priorização.',
    'dfd',
    200000, 420000,
    '2026-09-30',
    'Experiência em planejamento de contratações públicas. Conhecimento do PNCP e do módulo de PCA do ComprasGov. Desejável experiência com instituições de ensino federal.'
  ),
  (
    NULL,
    'Auditoria de Contratos de Terceirização de Serviços Gerais',
    'Câmara Municipal de São Paulo solicita auditoria completa em 14 contratos de terceirização (limpeza, vigilância e manutenção predial) vigentes, com valor global de R$ 28 milhões/ano. O trabalho inclui verificação de conformidade legal, análise de planilhas de custos, identificação de sobrepreços e emissão de relatório de auditoria com recomendações.',
    'auditoria',
    600000, 1200000,
    '2026-07-31',
    'Contador ou administrador com especialização em auditoria pública. Experiência em análise de planilhas de composição de custos de terceirização conforme IN SEGES nº 5/2017.'
  ),
  (
    NULL,
    'Gestão de Contratos de Fornecimento de Merenda Escolar',
    'Secretaria de Educação do Município de Fortaleza/CE necessita de profissional para assumir a gestão de 6 contratos de fornecimento de gêneros alimentícios para o PNAE (Programa Nacional de Alimentação Escolar), com valor anual de R$ 18 milhões. Atividades: fiscalização de entregas, controle de qualidade, gestão de penalidades e relatórios mensais.',
    'gestao',
    250000, 480000,
    '2026-12-31',
    'Nutricionista, administrador ou advogado com experiência em gestão de contratos alimentares. Conhecimento do PNAE e da Lei Orgânica de Segurança Alimentar.'
  ),
  (
    NULL,
    'Consultoria para Implementação do Sistema de Registro de Preços',
    'Consórcio Intermunicipal do Vale do Paraíba (12 municípios) busca consultor para estruturar e implementar Sistema de Registro de Preços (SRP) compartilhado, abrangendo os itens de maior consumo. O trabalho inclui mapeamento de demandas, elaboração dos editais-modelo, capacitação das equipes de compras e acompanhamento das primeiras atas.',
    'consultoria',
    320000, 650000,
    '2026-10-15',
    'Experiência comprovada em implantação de SRP, preferencialmente em consórcios ou entes municipais. Conhecimento do Decreto 11.462/2023 e das normas do PNCP.'
  )
ON CONFLICT DO NOTHING;

-- Confirma
SELECT id, title, category, budget_min/100.0 AS budget_min_R$, budget_max/100.0 AS budget_max_R$, status
FROM public.marketplace_projects
WHERE client_id IS NULL
ORDER BY created_at;
