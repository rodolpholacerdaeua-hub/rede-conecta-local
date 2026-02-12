# REDE CONECTA LOCAL — CODEBASE.md

> **Última atualização:** 2026-02-12
> **Leia este arquivo ao retomar o projeto para ter contexto completo.**

---

## 🎯 O que é o Projeto

**Rede Conecta Local** é uma plataforma SaaS de **Digital Signage (DOOH)** que permite:
- **Anunciantes** criam campanhas com mídias (vídeos/imagens) que são exibidas em TVs
- **Parceiros** (donos de estabelecimentos) hospedam terminais/TVs e ganham comissões
- **Admin** gerencia tudo: terminais, playlists, moderação de campanhas, finanças

**URL Produção:** https://redeconecta.ia.br
**GitHub:** https://github.com/rodolpholacerdaeua-hub/rede-conecta-local.git

---

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────┐    ┌───────────────────┐
│  Admin Panel     │──▶│   Supabase   │◀──│  Player Windows    │
│  (React/Vite)    │    │  (PostgreSQL │    │  (Electron + MPV)  │
│  Vercel Deploy   │    │   Auth, RLS  │    │  Auto-update via   │
│                  │    │   Storage)   │    │  GitHub Releases   │
└─────────────────┘    └──────────────┘    └───────────────────┘
```

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + Vite 7 + Tailwind CSS |
| **Backend** | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions) |
| **Player** | Electron + MPV (media player nativo) |
| **Deploy** | Vercel (admin-panel), GitHub Releases (player) |
| **Pagamentos** | Mercado Pago PIX (atualmente em modo teste) |
| **Supabase Project ID** | `tmohttbxrdpxtfjjlkkp` |
| **Região** | `sa-east-1` (São Paulo) |

---

## 📁 Estrutura de Pastas

```
REDE CONECTA LOCAL/
├── admin-panel/              # Frontend React (SPA)
│   ├── src/
│   │   ├── pages/            # Páginas da aplicação
│   │   │   ├── Campaigns/    # Sub-sistema de campanhas
│   │   │   │   ├── CampaignForm.jsx       # Criar/editar campanha
│   │   │   │   ├── CampaignModeration.jsx  # Moderação + comissões
│   │   │   │   ├── MediaSwapModal.jsx      # Troca de mídia
│   │   │   │   ├── campaignUtils.js        # Preços, cálculos, alocação
│   │   │   │   └── TerminalPicker.jsx      # Seletor de terminais
│   │   │   ├── Dashboard.jsx          # Dashboard admin
│   │   │   ├── PartnerDashboard.jsx   # Dashboard do parceiro
│   │   │   ├── Players.jsx            # Gestão de terminais/telas
│   │   │   ├── Player.jsx             # Detalhes de 1 terminal
│   │   │   ├── Playlists.jsx          # Gestão de playlists
│   │   │   ├── MediaLibrary.jsx       # Biblioteca de mídias
│   │   │   ├── Users.jsx              # Gestão de usuários
│   │   │   ├── Leads.jsx              # CRM de leads
│   │   │   ├── Finance.jsx            # Painel financeiro
│   │   │   ├── MyPlan.jsx             # Plano do anunciante
│   │   │   ├── PlaybackReports.jsx    # Relatórios de veiculação
│   │   │   ├── HelpCenter.jsx         # Central de ajuda
│   │   │   ├── LandingPage.jsx        # Landing page pública
│   │   │   ├── Login.jsx              # Autenticação
│   │   │   └── PartnerAdPage.jsx      # Página de anúncio para parceiros
│   │   ├── components/
│   │   │   ├── Layout.jsx             # Shell com sidebar
│   │   │   ├── CheckoutModal.jsx      # Modal de pagamento PIX
│   │   │   ├── PartnerSelector.jsx    # Vincular parceiro a terminal
│   │   │   ├── OnboardingTour.jsx     # Tour de onboarding
│   │   │   ├── ScreenAlertsPanel.jsx  # Alertas de anomalias
│   │   │   └── GroupManagerModal.jsx   # Gerenciar grupos de terminais
│   │   ├── hooks/
│   │   │   └── usePartnerData.js      # Hook dados do parceiro + comissões retroativas
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx        # Autenticação + roles (admin/parceiro/cliente)
│   │   └── utils/
│   │       └── generateCertificate.js # Gerador de certificado PDF
│   └── dist/                  # Build de produção
├── player-windows/            # Electron Player App
│   ├── main.js                # Processo principal
│   ├── preload.js
│   ├── renderer/              # Interface do player
│   └── package.json           # electron-builder config
├── supabase/
│   ├── functions/             # Edge Functions
│   │   ├── create-pix/        # Gera QR Code PIX (Mercado Pago)
│   │   ├── mp-webhook/        # Webhook de confirmação de pagamento
│   │   ├── create-user/       # Criar usuário (admin → parceiro/cliente)
│   │   ├── cleanup-media/     # Limpar mídia órfã do Storage
│   │   └── cleanup-expired-slots/ # Limpar slots expirados
│   └── migrations/            # SQL migrations
├── .agent/                    # Configuração do agente AI
│   ├── agents/                # Agentes especializados
│   ├── skills/                # Skills e scripts
│   └── workflows/             # Workflows automatizados
└── docs/                      # Documentação
```

---

## 🗄️ Banco de Dados (Supabase PostgreSQL)

### Tabelas Principais

| Tabela | Rows | Descrição |
|--------|------|-----------|
| `users` | 14 | Usuários (admin/parceiro/cliente). Campos: plan, plan_expires_at, role, tokens |
| `terminals` | 2 | TVs/Telas físicas. Campos: status, last_seen, metrics, assigned_playlist_id, operating_days/hours |
| `playlists` | 8 | Playlists com 13 slots (global/partner/local/wildcard) |
| `playlist_slots` | 41 | Slots individuais: slot_index (0-12), slot_type, media_id, campaign_id |
| `campaigns` | 11 | Campanhas publicitárias: moderation_status, credits_cost, target_terminals, partner_code_id |
| `media` | 36 | Vídeos e imagens. Storage bucket: `media/` |
| `playback_logs` | 7014 | Log de cada exibição no terminal |
| `partner_codes` | 3 | Códigos de afiliado: code, partner_id, terminal_id, discount_pct, assigned_at |
| `partner_commissions` | 0 | Comissões: type (revenue_share/referral_bonus), commission, status |
| `payments` | 2 | Pagamentos PIX via Mercado Pago |
| `leads` | 12 | Leads de marketing |
| `credit_transactions` | 4 | Transações de créditos |
| `business_categories` | 13 | Categorias de negócio para exclusividade |
| `terminal_logs` | 560 | Logs do terminal (debug/info/warn/error) |
| `screen_alerts` | 0 | Alertas de anomalias |

### Modelo de Slots (Playlist)

```
Slot 0:  GLOBAL     ← Campanha da plataforma (admin)
Slot 1:  PARTNER    ← Mídia do dono do estabelecimento
Slot 2:  LOCAL      ← Campanha de anunciante
Slot 3:  LOCAL      ← Campanha de anunciante
...
Slot 9:  LOCAL      ← Campanha de anunciante
Slot 10: LOCAL      ← Campanha de anunciante
Slot 11: WILDCARD   ← Conteúdo dinâmico
Slot 12: WILDCARD   ← Conteúdo dinâmico
```

### Relações Chave

```
users (role=parceiro) ──┐
                        ▼
                   partner_codes ──▶ terminals
                        │
                        ▼
                   partner_commissions
                        │
                        ▼
                   campaigns ◀── playlist_slots ◀── playlists ◀── terminals
```

---

## 💰 Sistema de Comissões (Dual)

### Revenue Share (20%)
- Quando campanha aprovada é alocada em slot LOCAL de terminal com parceiro vinculado
- `comissão = (credits_cost / nº_terminais) × 0.20`
- Gerada em `CampaignModeration.jsx` na aprovação
- Retroativa: `usePartnerData.js` gera para campanhas existentes sem comissão

### Referral Bonus (15%)
- Quando anunciante usa cupom do parceiro ao criar campanha
- `comissão = credits_cost × 0.15`
- Gerada em `CampaignModeration.jsx` na aprovação

### Reset Financeiro do Terminal
- Admin pode resetar Terminal via `Players.jsx` → botão "Resetar"
- Requer senha admin para confirmar
- Prorateia comissões pendentes: `diasAtivos / diasNoMês`
- Desvincula parceiro do terminal

### Preços de Slots

```javascript
SLOT_PRICES = {
  1: { base: 150, final: 150 },   // Sem desconto
  2: { base: 300, final: 270 },   // 10% desconto
  3: { base: 450, final: 382 },   // 15% desconto
}
```

---

## ⚡ Edge Functions (Supabase)

| Function | verify_jwt | Descrição |
|----------|-----------|-----------|
| `create-pix` | false | Cria pagamento PIX via Mercado Pago API. Secret: `MP_ACCESS_TOKEN` |
| `mp-webhook` | false | Recebe callback do MP, atualiza status, ativa plano do usuário |
| `create-user` | false | Cria auth user + registro na tabela users (admin → parceiro/cliente) |
| `cleanup-media` | false | Remove mídia órfã do Storage |
| `cleanup-expired-slots` | false | Limpa slots com campanhas expiradas |

---

## 👥 Roles e Permissões

| Role | Acesso |
|------|--------|
| `admin` | Tudo: terminais, playlists, moderação, usuários, finanças, leads |
| `parceiro` | PartnerDashboard: ver comissões, slot, terminal vinculado, código afiliado |
| `cliente` (anunciante) | Dashboard: campanhas, biblioteca mídia, plano, relatórios, certificado PDF |

---

## 🔧 Comandos Essenciais

```bash
# Dev server
cd admin-panel && npm run dev

# Build
cd admin-panel && npm run build

# Deploy (Vercel)
cd admin-panel && npx vercel --prod --yes

# Player (Electron)
cd player-windows && npm start

# Player build (Windows)
cd player-windows && npm run dist
```

---

## 🚦 Estado Atual e Pendências

### ✅ Funcionando
- Login/cadastro com roles (admin/parceiro/cliente)
- CRUD completo de campanhas com moderação
- Player Electron com MPV + auto-update via GitHub Releases
- Playlist com 13 slots (global/partner/local/wildcard)
- Alocação automática de campanhas em slots locais
- Dashboard do parceiro com comissões
- Relatórios de veiculação (playback_logs)
- Certificado de veiculação em PDF
- Landing page com WhatsApp CTA
- Central de ajuda
- Reset financeiro de terminal com proration
- Vinculação de parceiro a terminal com assigned_at tracking

### ⚠️ Pendências Conhecidas
- **Mercado Pago PIX em modo TESTE** — precisa trocar `MP_ACCESS_TOKEN` para produção
- **Code splitting** — build gera chunk >500kB, precisa lazy loading
- **Comissões retroativas** — lógica no `usePartnerData.js` roda a cada load do dashboard
- **Parceiro: código "guelito5"** — fixado manualmente, lógica de auto-rename foi removida

### 🔮 Roadmap (não implementado)
- Planos de assinatura recorrente
- Dashboard analytics avançado
- App mobile para parceiros
- Geração de mídia com IA
- Multi-tenant para redes de franquias

---

## 🔑 Contas e Credenciais Importantes

| Item | Valor |
|------|-------|
| **Supabase Project** | `tmohttbxrdpxtfjjlkkp` |
| **Supabase Region** | `sa-east-1` |
| **Vercel Project** | `rede-conecta-local` |
| **Domínio** | `redeconecta.ia.br` |
| **GitHub Repo** | `rodolpholacerdaeua-hub/rede-conecta-local` |
| **Pagamentos** | Mercado Pago (Secret: `MP_ACCESS_TOKEN` no Supabase) |

---

## 📋 Notas para AI que vai continuar

1. **RLS está habilitado** em todas as tabelas — sempre verifique permissões
2. **Edge functions** usam `verify_jwt: false` — autenticação é feita manualmente via header
3. **Player Windows** comunica com Supabase via Realtime channels
4. **Orientação padrão** agora é `portrait` (vertical) para todos os terminais
5. **Duração máxima** de mídia é 16 segundos
6. **Storage bucket** para mídia: `media/`
7. **Parceiros** são vinculados a terminais via `partner_codes.terminal_id`
8. **Campanhas** são alocadas em slots locais na aprovação (`CampaignModeration.jsx` + `campaignUtils.js`)
9. **Comissões** são geradas em 2 momentos: aprovação de campanha E retroativamente no PartnerDashboard
10. **Admin password** é pedido para ações destrutivas (reset financeiro)
