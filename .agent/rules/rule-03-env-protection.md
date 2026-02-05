---
description: Proteção contra operações destrutivas em ambiente de produção
alwaysApply: true
---

# 🛡️ Proteção de Ambiente - Produção Segura

## Motivo
Prevenir execução acidental de comandos destrutivos no banco de produção. Um DELETE ou TRUNCATE errado pode apagar dados de todos os clientes permanentemente.

---

## Proibições Absolutas

### 1. Operações Destrutivas
**NUNCA execute em produção sem confirmação explícita do usuário:**
- `DELETE FROM tabela` (sem WHERE específico)
- `TRUNCATE TABLE`
- `DROP TABLE`
- `DROP DATABASE`
- `UPDATE tabela SET ...` (sem WHERE específico)

### 2. MCP Supabase Safety
Ao usar o MCP (Model Context Protocol) do Supabase:
- ⚠️ **SEMPRE** confirme o `project_id` antes de executar SQL
- ⚠️ **PERGUNTE** ao usuário se é ambiente de DEV ou PROD
- ⚠️ **NUNCA** execute migrations automáticas em produção

### 3. Variáveis de Ambiente
- Arquivos `.env`, `.env.local`, `.env.production` **NUNCA** devem ser commitados
- O `.gitignore` DEVE conter:
  ```
  .env
  .env.local
  .env.production
  .env*.local
  ```

---

## Checklist Antes de Operações Críticas

### Para Migrations SQL:
- [ ] Estou no projeto CORRETO? (dev vs prod)
- [ ] A migration tem rollback definido?
- [ ] Testei em dev primeiro?
- [ ] Fiz backup antes?

### Para DELETE/UPDATE em Massa:
- [ ] Tenho WHERE clause específico?
- [ ] Quantos registros serão afetados?
- [ ] O usuário confirmou explicitamente?

---

## Padrão de Confirmação
```javascript
// Antes de operações destrutivas, SEMPRE confirme:
const confirmed = window.confirm(
  `⚠️ ATENÇÃO: Esta ação irá deletar ${count} registros. Deseja continuar?`
);
if (!confirmed) return;
```

---

## Gatilho
Ativado ao:
- Executar SQL via MCP Supabase (`execute_sql`, `apply_migration`)
- Criar scripts de migração
- Modificar dados em massa
- Trabalhar com arquivos `.env`

---

## Ambiente Seguro para Testes

### Identificação de Ambientes:
| Ambiente | Indicador | Operações Permitidas |
|----------|-----------|----------------------|
| DEV | `localhost`, projeto de teste | Todas |
| STAGING | Projeto separado | Migrations com cuidado |
| PROD | Projeto principal | Somente leitura via MCP |

---

## Exceções
- Scripts de seed para desenvolvimento inicial (apenas em DEV)
- Migrations já testadas e aprovadas pelo usuário
- Operações de manutenção agendadas (com backup prévio)
