# 🧠 CONTEXTO PARA ANTIGRAVITY (Handoff)
> **LEIA ESTE ARQUIVO PRIMEIRO** ao iniciar uma nova sessão.

**Projeto:** Rede Conecta Local (SaaS Digital Signage)
**Data do Handoff:** 2026-02-06
**Status do Git:** Branch `main` atualizada (commit `6c56a38`)

---

## 🎯 Onde paramos?
Acabamos de implementar funcionalidades críticas para preparar o sistema para **Beta**:
1.  **Auto-Update do Player (Windows):** O player agora baixa atualizações do GitHub Releases automaticamente.
2.  **Reset de Senha:** Fluxo completo via link de email funcionando.
3.  **Deploy Config:** Admin Panel configurado para Vercel (`vercel.json`), dependendo apenas de execução do deploy.
4.  **Roadmap Definido:** Arquivo `ROADMAP.md` criado com visão de futuro.

---

## 🏗️ Estrutura Técnica Consolidad
- **Frontend Admin:** React + Vite (em `admin-panel/`)
- **Player Windows:** Electron + React (em `player-windows/`)
- **Backend:** Supabase (Auth, DB, Storage, Realtime, Edge Functions)
- **Banco de Dados:** PostgreSQL 15 com RLS habilitado e 10 tabelas principais.

> 📄 **Detalhes Profundos:** Leia o arquivo `RELATORIO_TECNICO_STATUS.md` localizado em `C:\Users\rodol\.gemini\antigravity\brain\c4e57b62-9e1d-4339-912d-55ef05dd9e12\RELATORIO_TECNICO_STATUS.md` (ou peça para eu listar os arquivos na pasta `.gemini` se não encontrar).

---

## 🚀 Próxima Ação Imediata (Dívida Técnica)
O próximo passo lógico é o **Deploy do Admin Panel**.
- Tudo está configurado (`vercel.json`, `.env.example`).
- Ação: Rodar `vercel` ou conectar o repositório GitHub ao Vercel Dashboard.
- Após deploy: Atualizar as URLs de redirecionamento no Supabase Auth.

## ⚠️ Pontos de Atenção
1.  **Repositório Git:** A URL mudou para `https://github.com/rodolpholacerdaeua-hub/rede-conecta-local.git`.
2.  **Arquivos Grandes:** A pasta `player-windows/dist-electron` foi adicionada ao `.gitignore` porque os instaladores (`.exe`) excediam o limite do GitHub.
3.  **Variáveis de Ambiente:** As chaves do Supabase estão em `admin-panel/.env`. **NÃO COMITE ESTE ARQUIVO.**

---

## 🔧 Comandos Rápidos
- **Rodar Admin:** `cd admin-panel && npm run dev`
- **Rodar Player (Dev):** `cd player-windows && npm run electron:dev`
- **Buildar Player:** `cd player-windows && npm run electron:build`

---

*Use este contexto para continuar o trabalho sem perder o fio da meada.*
