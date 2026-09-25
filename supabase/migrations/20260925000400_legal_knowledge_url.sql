-- Endereço oficial de cada norma da base. A conferência de citações monta, por código,
-- o link de verificação de cada citação (Planalto com âncora no artigo/§/inciso, Portal de
-- Compras, TCU); a IA não escreve links.
alter table public.legal_knowledge add column if not exists url text;

update public.legal_knowledge set url = v.url
from (values
  ('Lei 14.133/2021', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm'),
  ('Lei 10.520/2002', 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm'),
  ('LC 123/2006', 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm'),
  ('Lei 8.666/1993', 'https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm'),
  ('Decreto 10.024/2019', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d10024.htm'),
  ('Decreto 11.462/2023', 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm'),
  ('Decreto 11.246/2022', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11246.htm'),
  ('IN SEGES/ME 65/2021 (íntegra)', 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021'),
  ('IN SEGES/ME 58/2022', 'https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-no-58-de-8-de-agosto-de-2022'),
  ('Constituição Federal', 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm')
) as v(reference, url)
where public.legal_knowledge.reference = v.reference and public.legal_knowledge.url is null;

-- atos do Portal de Compras já importados
update public.legal_knowledge k set url = a.url
from public.atos_compras a where a.knowledge_id = k.id and k.url is null;
