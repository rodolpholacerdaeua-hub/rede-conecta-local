# 🔖 Checkpoint: Configurar Sentry

> **Status:** Código integrado, aguardando configuração do DSN.  
> **Quando:** Ativar antes de escalar para +10 terminais em produção.

## ✅ O que já foi feito

- `@sentry/react` instalado em admin-panel e player-windows
- `admin-panel/src/lib/sentry.js` — Init com tracing + session replay
- `player-windows/src/lib/sentry.js` — Init com tracing
- `ErrorBoundary.jsx` — `Sentry.captureException()` integrado
- **Sentry desativado até configurar DSN** (zero impacto no app)

## 📋 Para ativar (5 minutos)

1. Criar conta em [sentry.io](https://sentry.io) (plano gratuito: 5K events/mês)
2. Criar projeto **admin-panel** (React) → copiar DSN
3. Criar projeto **player** (React) → copiar DSN
4. Adicionar variáveis:

```bash
# Vercel (admin-panel) → Settings → Environment Variables
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Player (.env local)
VITE_SENTRY_DSN=https://yyy@yyy.ingest.sentry.io/yyy
```

5. Redeploy admin-panel (push ou redeploy manual na Vercel)
6. Rebuild player (novo installer)
7. Testar: forçar um erro → verificar no dashboard Sentry ✅
