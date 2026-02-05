# Rule 04: Autorização Expressa para Testes no Browser

Esta regra define o protocolo obrigatório para a realização de testes de interface ou funcionais que utilizem as ferramentas de browser.

## Contexto
Para evitar o uso excessivo de recursos, loops de execução indesejados e garantir que o usuário tenha controle total sobre a execução de ações no seu ambiente local, o assistente **jamais** deve iniciar um teste automático sem consentimento.

## Protocolo Obrigatório

### 1. Identificação de Necessidade
Sempre que uma tarefa exigir verificação visual ou funcional no navegador (ex: "verificar se o botão X está funcionando", "validar novo layout"), o assistente deve parar e perguntar ao usuário.

### 2. A Pergunta Padrão
O assistente deve apresentar as seguintes opções ao usuário de forma clara:
> **"Deseja realizar o teste deste recurso de qual forma?"**
> 1. **Manual:** O usuário realiza o teste e reporta o resultado ao assistente.
> 2. **Automático:** O assistente utiliza o `browser_subagent` para executar o teste e reportar o resultado.

### 3. Execução
- **Manual:** O assistente deve aguardar o input do usuário com os resultados do teste.
- **Automático:** O assistente só pode chamar a ferramenta `browser_subagent` **após** a autorização expressa para o modo automático.

## Exemplo de Aplicação Correta
**ASSISTENTE:** "Finalizei a implementação do modal. Para prosseguir e verificar se ele está funcionando corretamente: você prefere realizar o teste de modo **manual** ou quer que eu faça o teste **automático** pelo browser?"

## Restrições
- Não assumir que o usuário quer um teste automático.
- Não usar `browser_subagent` para "dar uma olhadinha" ou "verificar se quebrou" sem que isso tenha sido explicitamente autorizado nesta sessão de trabalho.
