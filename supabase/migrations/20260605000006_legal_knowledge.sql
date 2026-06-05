-- Base de conhecimento jurídico compartilhada (Lei 14.133, TCU, AGU, doutrina)
CREATE TABLE IF NOT EXISTS legal_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('lei','acordao_tcu','sumula_tcu','orientacao_agu','instrucao_normativa','doutrina','outro')),
  reference   TEXT,       -- "Art. 18", "Acórdão 2622/2013-Plenário", "IN SEGES 58/2022"
  year        INTEGER,
  content     TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_knowledge_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id     UUID NOT NULL REFERENCES legal_knowledge(id) ON DELETE CASCADE,
  chunk_index      INTEGER NOT NULL,
  content          TEXT NOT NULL,
  embedding        vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_knowledge ON legal_knowledge_chunks(knowledge_id);

ALTER TABLE legal_knowledge        ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler
CREATE POLICY "Auth users read legal knowledge"
  ON legal_knowledge FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

CREATE POLICY "Auth users read legal chunks"
  ON legal_knowledge_chunks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas admin gerencia
CREATE POLICY "Admin manages legal knowledge"
  ON legal_knowledge FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin'));

CREATE POLICY "Admin manages legal chunks"
  ON legal_knowledge_chunks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin'));

-- RPC: busca semântica na base jurídica
CREATE OR REPLACE FUNCTION match_legal_knowledge(
  query_embedding vector(1536),
  match_count     INT   DEFAULT 6,
  min_similarity  FLOAT DEFAULT 0.22
)
RETURNS TABLE(id UUID, knowledge_id UUID, content TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.knowledge_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM legal_knowledge_chunks c
  JOIN legal_knowledge k ON k.id = c.knowledge_id
  WHERE k.active = true
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Seed inicial: artigos fundamentais da Lei 14.133/2021
INSERT INTO legal_knowledge (title, source_type, reference, year, content) VALUES
(
  'Lei 14.133/2021 — Princípios e Disposições Gerais',
  'lei', 'Arts. 1º ao 10 — Lei 14.133/2021', 2021,
  'Art. 1º Esta Lei estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios.
Art. 5º Na aplicação desta Lei, serão observados os princípios da legalidade, da impessoalidade, da moralidade, da publicidade, da eficiência, do interesse público, da probidade administrativa, da igualdade, do planejamento, da transparência, da eficácia, da segregação de funções, da motivação, da vinculação ao edital, do julgamento objetivo, da segurança jurídica, da razoabilidade, da competitividade, da proporcionalidade, da celeridade, da economicidade e do desenvolvimento nacional sustentável.
Art. 6º Para fins do disposto nesta Lei, consideram-se: I - órgão ou entidade licitante: aquele que realiza a licitação ou a contratação direta; II - contratante: o órgão ou entidade que celebra o contrato com o fornecedor; XXIII - Termo de Referência: documento necessário para a contratação de bens e serviços, que deve conter os elementos descritos no art. 40 desta Lei.
Art. 8º A licitação realizar-se-á na modalidade de pregão sempre que o objeto possuir padrões de desempenho e qualidade que possam ser objetivamente definidos no edital, por meio de especificações usuais de mercado.'
),
(
  'Lei 14.133/2021 — Estudo Técnico Preliminar (ETP)',
  'lei', 'Art. 18, §1º — Lei 14.133/2021', 2021,
  'Art. 18. A fase preparatória do processo licitatório é caracterizada pelo planejamento e deve compatibilizar-se com o plano de contratações anual de que trata o inciso VII do caput do art. 12 desta Lei, sempre que elaborado, e com as leis orçamentárias, bem como abordar todas as considerações técnicas, mercadológicas e de gestão que podem interferir na contratação, incluídos:
§1º O estudo técnico preliminar, quando elaborado, deverá evidenciar o problema a ser resolvido e a sua melhor solução, de modo a permitir a avaliação da viabilidade técnica e econômica da contratação, e conterá os seguintes elementos:
I - descrição da necessidade da contratação, considerado o problema a ser resolvido sob a perspectiva do interesse público;
II - demonstração da previsão da contratação no plano de contratações anual, sempre que elaborado, de modo a indicar o seu alinhamento com o planejamento da Administração;
III - requisitos da contratação;
IV - estimativas das quantidades para a contratação, acompanhadas das memórias de cálculo e dos documentos que lhes dão suporte;
V - levantamento de mercado, que consiste na análise das alternativas possíveis, e justificativa técnica e econômica da escolha do tipo de solução a contratar;
VI - estimativa do valor da contratação, acompanhada dos preços unitários referenciais, das memórias de cálculo e dos documentos que lhes dão suporte;
VII - descrição da solução como um todo, inclusive das exigências relacionadas à manutenção e à assistência técnica, quando for o caso;
VIII - justificativas para o parcelamento ou não da solução;
IX - demonstrativo dos resultados pretendidos em termos de economicidade e de melhor aproveitamento dos recursos humanos, materiais e financeiros disponíveis;
XI - descrição de possíveis impactos ambientais e respectivas medidas mitigadoras;
XII - posicionamento conclusivo sobre a adequação da contratação para o atendimento da necessidade a que se destina.'
),
(
  'Lei 14.133/2021 — Termo de Referência (TR)',
  'lei', 'Art. 40 — Lei 14.133/2021', 2021,
  'Art. 40. O Termo de Referência é o documento necessário para a contratação de bens e serviços, inclusive obras e serviços de engenharia, e deve conter os seguintes parâmetros e elementos descritivos:
I - definição do objeto, incluídos sua natureza, os quantitativos, o prazo do contrato e, se for o caso, a possibilidade de sua prorrogação;
II - fundamentação da contratação, que consiste na referência aos estudos técnicos preliminares correspondentes ou, quando não for possível divulgar esses estudos, no extrato das partes que não contiverem informações sigilosas;
III - descrição da solução como um todo;
IV - requisitos da contratação;
V - modelo de execução do objeto, que consiste na definição de como o contrato deverá produzir os resultados pretendidos desde o seu início até o seu encerramento;
VI - modelo de gestão do contrato, que descreve como a execução do objeto será acompanhada e fiscalizada pelo órgão ou entidade;
VII - critérios de medição e de pagamento;
VIII - forma e critérios de seleção do fornecedor;
IX - estimativas do valor da contratação, acompanhadas dos preços unitários referenciais;
X - adequação orçamentária.'
),
(
  'Lei 14.133/2021 — Modalidades de Licitação',
  'lei', 'Arts. 28 ao 32 — Lei 14.133/2021', 2021,
  'Art. 28. São modalidades de licitação:
I - pregão; II - concorrência; III - concurso; IV - leilão; V - diálogo competitivo.
Art. 29. A concorrência é a modalidade de licitação para contratação de bens e serviços especiais e de obras e serviços comuns e especiais de engenharia, cujo critério de julgamento poderá ser: I - menor preço; II - melhor técnica ou conteúdo artístico; III - técnica e preço; IV - maior retorno econômico; V - maior desconto.
Art. 36. O pregão é a modalidade de licitação obrigatória para aquisição de bens e serviços comuns, cujo critério de julgamento poderá ser o de menor preço ou o de maior desconto.
§1º Consideram-se bens e serviços comuns aqueles cujos padrões de desempenho e qualidade possam ser objetivamente definidos pelo edital, por meio de especificações usuais de mercado.'
),
(
  'Lei 14.133/2021 — Dispensa e Inexigibilidade',
  'lei', 'Arts. 74 ao 75 — Lei 14.133/2021', 2021,
  'Art. 74. É inexigível a licitação quando inviável a competição, em especial nos casos de: I - aquisição de materiais, de equipamentos ou de gêneros que só possam ser fornecidos por produtor, empresa ou representante comercial exclusivos; II - contratação de profissional do setor artístico, diretamente ou por meio de empresário exclusivo; III - contratação dos seguintes serviços técnicos especializados de natureza predominantemente intelectual com profissionais ou empresas de notória especialização.
Art. 75. É dispensável a licitação: I - para contratação que envolva valores inferiores a R$ 50.000,00 (cinquenta mil reais), no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores; II - para contratação que envolva valores inferiores a R$ 50.000,00 (cinquenta mil reais), no caso de outros serviços e compras; VIII - nos casos de emergência ou de calamidade pública; XI - na contratação de remanescente de obra, de serviço ou de fornecimento em consequência de rescisão contratual.'
),
(
  'TCU — Acórdão 2622/2013 — Requisitos do ETP',
  'acordao_tcu', 'Acórdão 2.622/2013-TCU-Plenário', 2013,
  'O Tribunal de Contas da União, no Acórdão 2.622/2013-Plenário, firmou orientação de que o Estudo Técnico Preliminar deve conter análise de alternativas e justificativa da solução escolhida, estimativa de custos com memória de cálculo detalhada, análise dos riscos envolvidos e mapeamento dos stakeholders afetados. O ETP deve demonstrar que a Administração avaliou diversas soluções antes de optar pela contratação, evidenciando o custo-benefício da escolha. A ausência do ETP ou sua elaboração deficiente pode caracterizar irregularidade grave no processo licitatório.'
),
(
  'TCU — Pesquisa de Preços — IN SEGES/ME 65/2021',
  'instrucao_normativa', 'IN SEGES/ME nº 65/2021', 2021,
  'A Instrução Normativa SEGES/ME nº 65, de 7 de julho de 2021, dispõe sobre o procedimento administrativo para a realização de pesquisa de preços para a aquisição de bens e contratação de serviços em geral, no âmbito da Administração Pública federal direta, autárquica e fundacional.
Art. 5º A pesquisa de preços será realizada mediante a utilização de um ou mais dos seguintes parâmetros: I - compostos de custo utilizados pela Administração; II - contratações similares feitas pela Administração Pública em execução ou concluídas nos 1 (um) ano anterior; III - dados de pesquisa publicada em mídia especializada, de tabela de referência formalmente aprovada pelo Poder Executivo federal e de sítios eletrônicos especializados ou de domínio amplo; IV - pesquisa direta com fornecedores.
§3º Serão desclassificados os preços que forem manifestamente inexequíveis ou que forem superiores aos preços correntes no mercado.'
),
(
  'AGU — Orientações sobre Contratações Públicas',
  'orientacao_agu', 'AGU — Orientação Normativa nº 57/2020', 2020,
  'A Advocacia-Geral da União orienta que nas contratações públicas: (1) o gestor deve verificar a regularidade fiscal e trabalhista do contratado durante toda a execução contratual; (2) a subcontratação parcial é permitida quando prevista no edital e não ultrapasse o limite estabelecido; (3) nos casos de inexigibilidade, a notória especialização deve ser comprovada documentalmente; (4) alterações contratuais devem observar os limites do art. 125 da Lei 14.133/2021 (25% para obras e serviços, 50% para reforma de edifícios e equipamentos).'
)
ON CONFLICT DO NOTHING;
