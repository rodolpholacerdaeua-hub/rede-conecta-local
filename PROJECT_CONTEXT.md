# 🧠 CONTEXTO DO PROJETO: REDE CONECTA

> **Instrução para a IA:** Leia este arquivo para entender o estado atual do projeto, o que foi feito e os próximos passos.

---

## 🚀 O que é o projeto?
Um sistema SaaS de Digital Signage (Painel de Telas) focado em redes locais. 
- **Tecnologias:** React (Vite), Firebase (Firestore, Auth/Storage), Tailwind CSS.
- **Diferencial:** Estratégia PWA com CacheFirst (funciona offline) e Gestão de Grupos em Massa.

---

## ✅ Histórico de Conquistas (Resumo)

### 1. Gestão de Grupos
- **CRUD Completo:** Criado modal para gerenciar coleções no Firestore (`terminal_groups`).
- **Batch Updates:** Atualiza todos os terminais vinculados ao renomear ou excluir um grupo.
- **Legacy Cleanup:** Lógica para adotar grupos "soltos" (strings) nos terminais e trazê-los para o sistema oficial.

### 2. Player App (Robustez)
- **PWA Offiline:** Implementado via `vite-plugin-pwa`. Baixa e armazena mídias localmente.
- **Standby Real (Anti Burn-in):** O player exibe tela 100% preta nos horários inativos, prevenindo danos às TVs.
- **Heartbeat:** Monitoramento em tempo real do status (Online/Standby) de cada tela.

### 3. Filtros e UX
- **Filtro por Grupo:** Dashboard filtra telas por grupo.
- **Edição Rápida:** Mudança de grupo diretamente no card do player.
- **Dias da Semana:** Controle de operação de Segunda a Domingo.

---

## 🎯 PRÓXIMO PASSO: Módulo de Pagamentos (SaaS)
O sistema precisa começar a cobrar. O plano aprovado é:
1.  **Checkout:** Criar `CheckoutModal.jsx` para seleção de plano.
2.  **Liberação de Quota:** Atualizar o campo `plan` e `quota` do usuário após confirmação.
3.  **Segurança:** Bloquear criação de novas telas se a quota for excedida ou o plano vencer.
4.  **Sugestão:** Iniciar com simulação (Mock) e evoluir para Mercado Pago/Stripe.

---

## 📂 Arquivos Importantes
- `src/pages/Players.jsx`: Coração do Gerenciamento.
- `src/components/GroupManagerModal.jsx`: Gestão de Grupos.
- `src/utils/planHelpers.js`: Lógica de quotas e planos.
- `../player-app/src/App.jsx`: Lógica do Player (Loop e Standby).
- `firestore.rules`: Regras de segurança (precisam ser atualizadas no deploy).

---

## ⚠️ Notas Técnicas
- **Git:** O repositório está na raiz (`PROJETOS ANTIGRAVITY`). 
- **Deploy:** O script `deploy_rules.bat` ajuda a subir as regras do Firebase.
- **Hardware:** O projeto prevê evolução para App Nativo Android (APK) para suporte a HDMI-CEC.

---
*Gerado em: 29/01/2026 às 21:55*
