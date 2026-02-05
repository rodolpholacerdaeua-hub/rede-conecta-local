# Supabase Setup - Rede Conecta DOOH

## 1. Criar Projeto Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha:
   - **Name:** `rede-conecta`
   - **Database Password:** (anote em local seguro!)
   - **Region:** São Paulo (South America)
5. Aguarde a criação (1-2 minutos)

## 2. Executar Migrations

Após criar o projeto:

1. Vá no menu lateral → **SQL Editor**
2. Execute os arquivos na ordem:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_rls_policies.sql`  
   - `migrations/003_functions_views.sql`

## 3. Configurar Storage

1. Vá em **Storage** no menu lateral
2. Clique **"New bucket"**
3. Crie o bucket:
   - **Name:** `media`
   - **Public:** ✅ Habilitado
4. Clique em **Policies** e adicione:
   - Policy para upload (authenticated users)
   - Policy para leitura (public)

## 4. Obter Credenciais

1. Vá em **Settings** → **API**
2. Copie:
   - **Project URL:** `https://xxx.supabase.co`
   - **anon/public key:** `eyJ...`
3. Atualize o arquivo `shared/supabase.js` com esses valores

## 5. Instalar Dependência

```bash
# No player-app
cd player-app
npm install @supabase/supabase-js

# No admin-panel
cd ../admin-panel
npm install @supabase/supabase-js
```

## 6. Próximos Passos

Após setup:
1. [ ] Migrar dados do Firebase para Supabase
2. [ ] Atualizar Player App para usar Supabase
3. [ ] Atualizar Admin Panel para usar Supabase
4. [ ] Testar e validar
