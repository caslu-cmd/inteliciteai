# Intelicite

Plataforma de IA para licitações públicas, com conformidade à **Lei nº 14.133/2021**.
Gera ETPs, Termos de Referência e DFDs, valida editais, consulta a legislação e
jurisprudência (TCU/AGU) e mantém memória por órgão.

## Tecnologias

- **Vite + React + TypeScript**
- **Tailwind CSS + shadcn-ui**
- **Supabase** (Postgres, Auth, Edge Functions, pgvector para RAG)
- **Cloudflare** (hospedagem via Workers + Static Assets)

## Desenvolvimento local

Pré-requisito: Node.js 20+.

```sh
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento (http://localhost:8080)
npm run dev
```

Scripts úteis:

```sh
npm run build      # build de produção (gera ./dist)
npm run preview    # servir o build localmente
npm run lint       # ESLint
npm test           # testes (vitest)
```

## Variáveis de ambiente

O front usa as variáveis `VITE_SUPABASE_*` (arquivo `.env`) para conectar ao
projeto Supabase. Os segredos das Edge Functions (OpenAI, Anthropic, Resend,
Brave, etc.) ficam configurados no painel do Supabase, não no repositório.

## Deploy

O deploy é feito pelo **Cloudflare** (Workers + Static Assets), configurado em
`wrangler.jsonc`:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Output:** `dist`

Cada push na branch de produção dispara um novo deploy.

## Estrutura

- `src/` — aplicação React (páginas, componentes, hooks, libs)
- `supabase/functions/` — Edge Functions (chat, RAG, e-mail, integrações)
- `supabase/migrations/` — schema e políticas (RLS), incluindo a base jurídica
  e as funções de busca semântica (pgvector)
