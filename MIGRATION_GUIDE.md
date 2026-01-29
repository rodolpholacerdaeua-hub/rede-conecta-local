# 🚀 GUIA DE MIGRAÇÃO - CONECTA LOCAL

Este documento contém todas as informações necessárias para continuar o desenvolvimento do **Conecta Local** em outra conta Google ou com outro assistente de IA.

---

## 📋 PROMPT DE CONTEXTO COMPLETO

**Cole este prompt na primeira mensagem da nova conversa:**

```
# CONTEXTO DO PROJETO: Conecta Local - Plataforma SaaS de Digital Signage

Você está assumindo o desenvolvimento de um sistema completo de gerenciamento de mídia digital (Digital Signage) com economia de tokens e multi-tenancy. Aqui está o estado atual:

## ARQUITETURA TÉCNICA
- **Frontend:** React + Vite + TailwindCSS + Firebase Auth
- **Backend:** Firebase (Firestore, Storage, Authentication)
- **Localização do Projeto:** `c:\Users\rodol\Desktop\PROJETOS ANTIGRAVITY\admin-panel`
- **Servidor Dev:** `npm run dev` (porta padrão Vite - 5173)
- **Firebase Config:** Já configurado em `src/firebase.js`

## COLEÇÕES FIRESTORE ATIVAS

### 1. `users`
Armazena informações dos usuários do sistema.
- `uid` (string) - ID único do Firebase Auth
- `email` (string) - Email do usuário
- `displayName` (string) - Nome de exibição
- `role` (string) - "admin" ou "cliente"
- `tokens` (number) - Saldo de tokens disponíveis
- `createdAt` (timestamp) - Data de criação

### 2. `campaigns`
Campanhas de mídia criadas pelos usuários.
- `name` (string) - Nome da campanha
- `hMediaId` (string) - ID da mídia horizontal (16:9)
- `vMediaId` (string) - ID da mídia vertical (9:16)
- `ownerId` (string) - UID do criador da campanha
- `status_financeiro` (boolean) - Se foi aprovada financeiramente
- `is_active` (boolean) - Se está no ar
- `screensQuota` (number) - Quantidade de telas permitidas
- `targetTerminals` (array) - IDs dos terminais selecionados
- `isAIGenerating` (boolean) - Se está sendo gerada pela IA
- `createdAt` (timestamp) - Data de criação

### 3. `media`
Arquivos de mídia (vídeos e imagens).
- `name` (string) - Nome do arquivo
- `url` (string) - URL do Firebase Storage
- `type` (string) - "image" ou "video"
- `orientation` (string) - "horizontal" ou "vertical"
- `resolution` (string) - Ex: "1920x1080"
- `size` (number) - Tamanho em bytes
- `storagePath` (string) - Caminho no Storage
- `ownerId` (string) - UID do dono do arquivo
- `createdAt` (timestamp) - Data de upload

### 4. `terminals`
Players físicos de exibição.
- `name` (string) - Nome do terminal
- `location` (string) - Localização física
- `lastSeen` (timestamp) - Última vez online
- `status` (string) - Status de conexão

### 5. `transactions`
Histórico de movimentação de tokens.
- `uid` (string) - UID do usuário
- `userName` (string) - Nome do usuário
- `type` (string) - "credit" (recarga) ou "debit" (gasto)
- `amount` (number) - Quantidade de tokens
- `description` (string) - Descrição da transação
- `createdAt` (timestamp) - Data da transação

### 6. `generation_requests`
Pedidos de geração de conteúdo pela IA.
- `campaignId` (string) - ID da campanha relacionada
- `campaignName` (string) - Nome da campanha
- `prompt` (string) - Texto do briefing
- `status` (string) - "pending", "processing", "completed"
- `type` (string) - "creation" ou "refinement"
- `createdAt` (timestamp) - Data do pedido

## FUNCIONALIDADES IMPLEMENTADAS

### ✅ Sistema Multi-Role
- **Admin:** Acesso total (terminais, usuários, todas as campanhas)
- **Cliente:** Acesso restrito (apenas suas mídias e campanhas, saldo de tokens)
- Dashboards personalizados por role

### ✅ Economia de Tokens
- Custo fixo: **50 tokens** por criação de campanha via IA
- Débito automático ao criar campanha
- Auto-aprovação se houver saldo (`status_financeiro: true`, `is_active: true`)
- Bloqueio de criação se saldo insuficiente

### ✅ Isolamento de Dados (Multi-Tenancy)
- Todas as mídias têm `ownerId`
- Todas as campanhas têm `ownerId`
- Queries filtradas por `ownerId` para clientes
- Admins veem tudo

### ✅ Autenticação
- Login com email/senha
- Cadastro de novos usuários
- Novos usuários: `role: 'cliente'`, `tokens: 0`
- Usuários legados sem documento: `role: 'admin'`, `tokens: 100`

### ✅ Gestão de Usuários (Admin)
- Listar todos os usuários
- Alternar role (admin ↔ cliente)
- Editar nome de exibição
- Ajustar saldo de tokens manualmente

### ✅ Carteira Digital
- Extrato de transações (créditos e débitos)
- Simulação de compra de tokens (mock para testes)
- Histórico de investimentos

### ✅ Biblioteca de Mídia
- Upload de vídeos e imagens
- Validação de orientação (16:9 ou 9:16)
- Filtro por owner (clientes veem só as suas)
- Detecção automática de resolução

### ✅ Criação de Campanhas
- Modo manual: vincular arquivos existentes
- Modo IA: briefing textual para geração automática
- Seleção de terminais alvo
- Sistema de quotas por plano

## CONSTANTES E CONFIGURAÇÕES IMPORTANTES

### Custos e Valores
```javascript
const AI_CREATION_COST = 50; // tokens por criação IA (em Campaigns.jsx)
```

### Planos Disponíveis
- **Start:** 1 tela
- **Business:** 3 telas
- **Premium:** 5 telas
- **Enterprise:** 10 telas
- **Rede Ilimitada:** ∞ telas (apenas admin)

### Nomenclaturas Padronizadas
- Mídia Horizontal: **"Mídia Horizontal 16:9"**
- Mídia Vertical: **"Mídia Vertical 9:16"**

## ESTRUTURA DE ROTAS

### Públicas
- `/` - Login e Cadastro

### Protegidas (Requerem Autenticação)
- `/dashboard` - Dashboard personalizado por role
- `/campaigns` - Gestão de Campanhas
- `/media` - Biblioteca de Mídia
- `/finance` - Tokens & Finanças
- `/users` - Gestão de Usuários (apenas admin)
- `/players` - Terminais (apenas admin)
- `/playlists` - Playlists Globais (apenas admin)
- `/settings` - Configurações (placeholder)

## COMPONENTES PRINCIPAIS

### `AuthContext.jsx`
- Gerencia autenticação e dados do usuário
- Funções: `login()`, `signup()`, `logout()`
- Expõe: `currentUser`, `userData` (role, tokens, etc)

### `Layout.jsx`
- Menu lateral adaptativo por role
- Exibe saldo de tokens no header
- Botão de logout

### `Dashboard.jsx`
- **Admin:** Métricas de rede (terminais online, campanhas ativas)
- **Cliente:** Saldo, campanhas ativas, plano atual, resumo financeiro

### `Campaigns.jsx`
- Criação manual e via IA
- Débito de tokens automático
- Filtragem por owner
- Seleção de terminais e quotas

### `Finance.jsx`
- **Admin:** Visão global (tokens vendidos, receita bruta)
- **Cliente:** Carteira digital (saldo, extrato, botão de recarga)

### `Users.jsx`
- Listagem de usuários
- Alternar roles
- Editar perfis
- Injetar tokens (para testes)

### `MediaLibrary.jsx`
- Upload de arquivos
- Validação de orientação e resolução
- Filtragem por owner

## TRATAMENTO DE ERROS IMPLEMENTADO

### Queries Firestore
- Todas as queries com `onSnapshot` incluem callback de erro
- Fallback para arrays vazios em caso de falha
- Verificação de `userData` antes de renderizar componentes

### Operações Críticas
- Try-catch em uploads de mídia
- Try-catch em criação de campanhas
- Try-catch em transações de tokens

### Validações
- Verificação de saldo antes de criar campanha IA
- Validação de aspect ratio em uploads
- Verificação de seleção de terminais

## PRÓXIMOS PASSOS SUGERIDOS

### 1️⃣ Integração de Pagamento Real (Alta Prioridade)
- Substituir mock de compra por Stripe ou Mercado Pago
- Criar webhook para atualizar saldo após pagamento
- Registrar transações automaticamente

### 2️⃣ Sistema de Planos e Assinaturas (Média Prioridade)
- Implementar planos mensais com vencimento
- Controle de renovação automática
- Alertas de vencimento próximo
- Downgrade/upgrade de planos

### 3️⃣ Relatórios e Analytics (Média Prioridade)
- Gráficos de exibição por campanha
- Métricas de alcance (impressões)
- Relatório de performance por terminal
- Dashboard de analytics para clientes

### 4️⃣ Notificações em Tempo Real (Baixa Prioridade)
- Alertas de campanha aprovada
- Notificação de tela offline
- Aviso de saldo baixo
- Email/SMS de vencimento

### 5️⃣ White-Label (Baixa Prioridade)
- Logo customizado por cliente
- Cores personalizadas
- Domínio próprio

## COMANDOS ÚTEIS

### Desenvolvimento
```bash
cd c:\Users\rodol\Desktop\PROJETOS ANTIGRAVITY\admin-panel
npm run dev
```

### Build de Produção
```bash
npm run build
```

### Instalar Dependências (se necessário)
```bash
npm install
```

## ARQUIVOS DE CONFIGURAÇÃO IMPORTANTES

### `firebase.js`
Contém as credenciais do Firebase. **NÃO COMPARTILHAR PUBLICAMENTE.**

### `tailwind.config.js`
Configurações do TailwindCSS.

### `vite.config.js`
Configurações do Vite (bundler).

## OBSERVAÇÕES FINAIS

### Segurança
- Regras do Firestore devem validar `ownerId` no backend
- Nunca confiar apenas em filtragem frontend
- Implementar rate limiting para APIs

### Performance
- Usar paginação em listas longas
- Lazy loading de imagens/vídeos
- Otimizar queries com índices compostos

### UX/UI
- Feedback visual em todas as ações
- Loading states em operações assíncronas
- Mensagens de erro claras e acionáveis

---

## 🎯 COMO USAR ESTE GUIA

1. **Abra o Antigravity na sua conta principal**
2. **Cole o "PROMPT DE CONTEXTO COMPLETO" acima**
3. **Mencione o caminho do projeto:** `c:\Users\rodol\Desktop\PROJETOS ANTIGRAVITY\admin-panel`
4. **Peça para revisar os arquivos principais** antes de continuar
5. **Continue de onde paramos!**

O Antigravity vai ler os arquivos locais e entender todo o contexto rapidamente. Não há perda de informação! ✅

---

**Desenvolvido com ⚓ por Antigravity AI**
```

---

## 📁 CHECKLIST DE MIGRAÇÃO

Antes de trocar de conta, certifique-se de:

- [ ] Fazer commit de todas as alterações (se usar Git)
- [ ] Copiar este arquivo `MIGRATION_GUIDE.md` para um local seguro
- [ ] Anotar as credenciais do Firebase (se precisar recriar o projeto)
- [ ] Exportar regras do Firestore (se houver)
- [ ] Fazer backup do banco de dados (se houver dados importantes)

---

**Boa migração! 🚀⚓**
