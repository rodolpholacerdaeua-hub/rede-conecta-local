---
description: Garante isolamento de dados multi-tenant via owner_id em todas as queries
alwaysApply: true
---

# 🏢 Isolamento Multi-Tenant - Owner ID Shield

## Motivo
O Rede Conecta Local é um SaaS multi-tenant. Cada cliente só pode ver/modificar seus próprios dados. Falhar neste isolamento expõe dados de um cliente para outro - uma violação crítica de privacidade.

---

## Cláusula Obrigatória: owner_id

### 1. Toda Query DEVE Filtrar por owner_id
```javascript
// ✅ CORRETO
const { data } = await supabase
  .from('terminals')
  .select('*')
  .eq('owner_id', user.id);

// ❌ ERRADO - VAZAMENTO DE DADOS!
const { data } = await supabase
  .from('terminals')
  .select('*');
```

### 2. owner_id Nunca Vem do Frontend
- O `owner_id` DEVE ser extraído de:
  - `auth.uid()` no Supabase (via RLS policies)
  - Sessão autenticada no servidor
- **NUNCA** aceite `owner_id` como parâmetro de request body ou query string

### 3. Tabelas com Isolamento Obrigatório
| Tabela | Campo de Isolamento |
|--------|---------------------|
| `terminals` | `owner_id` |
| `playlists` | `owner_id` |
| `media` | `owner_id` |
| `campaigns` | `owner_id` |
| `playlist_slots` | via `playlist_id` → `owner_id` |
| `proof_of_play` | via `terminal_id` → `owner_id` |

### 4. RLS Policy Padrão
```sql
-- Exemplo de policy para tabela terminals
CREATE POLICY "Users can only see own terminals"
ON terminals FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can only insert own terminals"
ON terminals FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can only update own terminals"
ON terminals FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can only delete own terminals"
ON terminals FOR DELETE
USING (owner_id = auth.uid());
```

---

## Gatilho
Ativado ao:
- Criar queries de banco de dados (SELECT, INSERT, UPDATE, DELETE)
- Criar migrações SQL
- Modificar arquivos em `admin-panel/src/pages/` ou `admin-panel/src/db.js`
- Criar Edge Functions

---

## Exceções
- Queries administrativas (role = 'admin') podem ver todos os dados
- Tabelas públicas sem owner_id: `business_categories`, `pairing_codes` (temporário)
- Dashboard admin com métricas agregadas

---

## Verificação
Antes de qualquer PR/commit, verifique:
1. [ ] Toda nova query tem `.eq('owner_id', ...)` ou RLS ativo?
2. [ ] Novas tabelas têm RLS habilitado?
3. [ ] Nenhum endpoint aceita owner_id do frontend?
