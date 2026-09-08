# Sentry

O projeto já está preparado para enviar erros e transações ao Sentry nos
runtimes do navegador, Node.js e Edge. O SDK fica desativado quando o DSN não
está preenchido, então o desenvolvimento local continua funcionando sem uma
conta Sentry.

## Configuração

1. Crie uma organização e um projeto do tipo **Next.js** em
   [sentry.io](https://sentry.io/).
2. Copie o DSN do projeto.
3. No ambiente de execução, configure:

   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://public-key@o0.ingest.sentry.io/project-id
   SENTRY_DSN=https://public-key@o0.ingest.sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   SENTRY_TRACES_SAMPLE_RATE=0.1
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
   NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

   `NEXT_PUBLIC_SENTRY_DSN` pode aparecer no bundle do navegador; o DSN não é
   um segredo. `SENTRY_AUTH_TOKEN` é segredo e nunca deve ser colocado nessa
   variável pública.

## Source maps no deploy

Para stack traces legíveis, crie no Sentry um **auth token de deploy** com a
permissão mínima de release/source maps e configure apenas no ambiente de
build/CI:

```env
SENTRY_AUTH_TOKEN=token-do-ci
SENTRY_ORG=slug-da-organizacao
SENTRY_PROJECT=slug-do-projeto
SENTRY_RELEASE=sha-ou-versao-do-deploy
```

O `next.config.ts` só habilita o upload de source maps quando
`SENTRY_AUTH_TOKEN` existe. O token não é enviado ao navegador nem deve ser
commitado.

## Privacidade e operação

- `sendDefaultPii` fica desativado.
- O filtro compartilhado remove e-mails, cookies, autorizações, senhas,
  tokens/identificadores de casamento, query strings e dados de arquivos antes
  do envio.
- Não ative Session Replay sem revisar a política de privacidade e mascarar
  campos de entrada e imagens.
- Use `0.05` a `0.2` para `SENTRY_TRACES_SAMPLE_RATE` em produção, ajustando ao
  volume e ao orçamento. Erros continuam sendo capturados fora da amostragem
  de performance.

## Teste

Depois de preencher o DSN, execute `npm run build && npm start`, abra o site e
confirme o evento no projeto Sentry. Um erro real de produção não deve ser
gerado artificialmente em uma conta de usuário; para teste, use o recurso de
teste do próprio Sentry ou uma rota temporária protegida que seja removida
antes do deploy.
