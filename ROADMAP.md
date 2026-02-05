# 🚀 ROADMAP - Rede Conecta Local

Este documento lista melhorias planejadas e sugestões para futuras versões do sistema.

---

## 📊 Proof of Play (Logs de Exibição)

### Sugerido em: 2026-02-05

| Melhoria | Prioridade | Esforço | Descrição |
|----------|------------|---------|-----------|
| Materialized View para relatórios | Média | Baixo | Criar view materializada com refresh diário para acelerar consultas pesadas de faturamento |
| Agregação automática | Média | Médio | Job noturno (pg_cron) que totaliza exibições por dia/mídia para tabela `daily_pop_summary` |
| Exportação PDF | Alta | Médio | Gerar relatório mensal em PDF para enviar aos clientes como comprovante |
| Retenção de dados | Baixa | Baixo | Política de arquivamento: mover logs > 6 meses para tabela `playback_logs_archive` |

---

## 💳 Integração de Pagamentos

### Pendente

| Melhoria | Prioridade | Esforço | Descrição |
|----------|------------|---------|-----------|
| Mercado Pago Integration | **CRÍTICA** | Alto | Integrar checkout para assinaturas recorrentes |
| Stripe como alternativa | Média | Alto | Oferecer Stripe para clientes internacionais |
| Webhooks de pagamento | Alta | Médio | Receber eventos de pagamento e atualizar tokens automaticamente |

---

## 🖥️ Player Windows (TV Box)

### Sugerido

| Melhoria | Prioridade | Esforço | Descrição |
|----------|------------|---------|-----------|
| Auto-update silencioso | Alta | Alto | Atualizar o player automaticamente sem intervenção |
| Compressão de logs | Baixa | Baixo | Comprimir logs antes de enviar em batch para economia de banda |
| Screenshot periódico | Média | Médio | Capturar tela a cada X minutos para prova visual |

---

## 📱 Admin Panel

### Sugerido

| Melhoria | Prioridade | Esforço | Descrição |
|----------|------------|---------|-----------|
| Dashboard de Analytics | Média | Médio | Gráficos de exibições por período |
| Notificações push | Baixa | Médio | Alertas quando terminal fica offline |
| Multi-idioma (i18n) | Baixa | Alto | Suporte a português e inglês |

---

## 🔒 Segurança

### Implementado ✅

- [x] RLS (Row Level Security) em todas as tabelas
- [x] Isolamento por `owner_id`
- [x] Chave anon pública (sem service_role no frontend)

### Pendente

| Melhoria | Prioridade | Esforço | Descrição |
|----------|------------|---------|-----------|
| 2FA para admins | Média | Médio | Autenticação em dois fatores |
| Audit log | Baixa | Médio | Registrar ações sensíveis (delete, update user, etc) |

---

## 📝 Notas

- **Prioridade**: Crítica > Alta > Média > Baixa
- **Esforço**: Baixo (< 2h) | Médio (2-8h) | Alto (> 8h)
- Este documento deve ser atualizado conforme novas ideias surgirem

---

*Última atualização: 2026-02-05*
