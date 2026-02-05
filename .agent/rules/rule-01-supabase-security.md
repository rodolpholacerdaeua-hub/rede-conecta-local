---
description: Regras de segurança para uso do Supabase no projeto Rede Conecta Local
alwaysApply: true
---

# 🔒 Segurança Supabase - Rede Conecta Local

## Motivo
Esta regra previne vazamento de credenciais administrativas e garante que o código frontend nunca tenha acesso privilegiado ao banco de dados. Violações podem expor dados de todos os clientes.

---

## Restrições Inegociáveis

### 1. Proibição de Service Role Key no Frontend
- **NUNCA** utilize `SUPABASE_SERVICE_ROLE_KEY` ou `service_role` em arquivos dentro de:
  - `admin-panel/src/`
  - `player-windows/src/`
  - Qualquer código que execute no navegador ou Electron renderer

### 2. Chaves Permitidas no Frontend
- ✅ `VITE_SUPABASE_URL` - URL pública do projeto
- ✅ `VITE_SUPABASE_ANON_KEY` - Chave pública (anon key)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` - **PROIBIDO NO FRONTEND**

### 3. RLS Sempre Ativado
- Toda nova tabela DEVE ter `ALTER TABLE nome ENABLE ROW LEVEL SECURITY;`
- Toda nova tabela DEVE ter pelo menos uma policy de leitura/escrita

### 4. Storage Bucket Security
- Buckets públicos: apenas para assets estáticos (logos, thumbnails)
- Uploads de mídia: bucket privado com policies baseadas em `auth.uid()`

---

## Gatilho
Ativado ao criar ou modificar arquivos em:
- `admin-panel/src/**/*.{js,jsx,ts,tsx}`
- `player-windows/src/**/*.{js,jsx,ts,tsx}`
- `supabase/migrations/*.sql`
- Qualquer arquivo `.env`

---

## Exemplo Correto ✅
```javascript
// admin-panel/src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // ✅ Chave pública

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Exemplo ERRADO ❌
```javascript
// ❌ NUNCA FAÇA ISSO!
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Isso expõe acesso administrativo total ao banco!
```

---

## Exceções
- Edge Functions (Supabase Functions) podem usar service_role para operações administrativas
- Scripts de migração local (nunca commitados)
