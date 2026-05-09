#!/bin/bash
# deploy.sh — Script de deploy completo da Intelicite AI
# Uso: bash scripts/deploy.sh

set -e

PROJECT_ID="vderxlqqxmvnrdxwyogy"

echo "🚀 Intelicite AI — Deploy Script"
echo "================================="

# 1. Aplicar migrations pendentes
echo ""
echo "📦 Aplicando migrations..."
supabase db push --project-ref "$PROJECT_ID"

# 2. Deploy de todas as edge functions
echo ""
echo "⚡ Fazendo deploy das edge functions..."

FUNCTIONS=(
  "chat"
  "analyze-edital"
  "generate-document"
  "generate-minuta"
  "licitante-ai"
  "pncp-proxy"
  "cnpj-proxy"
  "notebook-fetch"
  "notebook-search"
  "create-checkout"
  "mp-webhook"
  "admin-create-user"
  "auto-block"
  "save-gateway-config"
  "send-email"
)

for fn in "${FUNCTIONS[@]}"; do
  if [ -d "supabase/functions/$fn" ]; then
    echo "  → Deploy: $fn"
    supabase functions deploy "$fn" --project-ref "$PROJECT_ID" --no-verify-jwt 2>/dev/null || \
    supabase functions deploy "$fn" --project-ref "$PROJECT_ID"
  fi
done

# 3. Build do frontend
echo ""
echo "🏗️  Build do frontend..."
bun run build

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "Próximos passos:"
echo "  - Configure RESEND_API_KEY no Supabase Dashboard > Edge Functions > Secrets"
echo "  - Configure ANTHROPIC_API_KEY se ainda não estiver configurada"
echo "  - Verifique as migrations em: https://supabase.com/dashboard/project/$PROJECT_ID/database/migrations"
