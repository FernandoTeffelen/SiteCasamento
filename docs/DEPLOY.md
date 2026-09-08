# Deploy do SiteCasamento

Este guia prepara uma publicação manual. Nenhum comando abaixo cria contas, compra serviços ou executa deploy sem ser chamado explicitamente por uma pessoa autorizada.

## Arquitetura recomendada

| Camada | Solução | Motivo |
| --- | --- | --- |
| Aplicação | Vercel | Executa Next.js App Router nativamente, com HTTPS, CDN, logs e deploy por Git/CLI. |
| Banco | Neon PostgreSQL | PostgreSQL gerenciado, conexão TLS e recursos de backup/restauração. |
| Fotos | Cloudflare R2 privado | API S3-compatible já suportada por `ObjectStorage`; fotos não precisam ser públicas. |
| Monitoramento | Sentry + logs da Vercel | Captura erros sem enviar senhas, tokens ou fotos; logs para diagnóstico operacional. |

Essa combinação preserva Next.js, Prisma, PostgreSQL e a implementação atual de armazenamento. Não use export estático: o produto depende de Route Handlers, sessões, banco e validação de uploads no servidor.

Escolha regiões próximas do público e confirme requisitos de LGPD, residência de dados e orçamento com os provedores antes de liberar o serviço.

## Antes de começar

- Node.js `>= 20.9.0` e npm.
- Repositório Git privado, com branch principal protegida.
- Domínio próprio já registrado.
- Conta nos três provedores escolhidos e permissões para configurar DNS e variáveis seguras.
- Uma janela de manutenção para a primeira migration, mesmo que ela seja curta.

Não copie `.env` para o repositório nem para tickets, mensagens ou prints. Use o secret manager de cada provedor.

## 1. Criar e proteger os serviços

### Banco PostgreSQL

1. Crie um projeto e um banco de **produção** no Neon.
2. Habilite a conexão TLS e guarde duas URLs: uma direta, para migrations/backups administrativos, e outra poolada, se oferecida pelo provedor, para a aplicação serverless.
3. Configure a retenção de histórico/PITR disponível no plano e snapshots agendados. Mantenha pelo menos uma restauração testada em banco isolado.
4. Use usuário exclusivo da aplicação, sem permissões administrativas fora do banco do SiteCasamento.
5. Defina alerta de uso de armazenamento e conexões no painel do provedor.

Para migrations, use a URL direta somente em uma máquina ou CI confiável. Para o runtime serverless, prefira a URL poolada e mantenha `DATABASE_POOL_MAX="2"` como ponto inicial; ajuste depois de observar uso real.

### Bucket de fotos

1. Crie um bucket R2 exclusivo, por exemplo `sitecasamento-production-photos`.
2. Mantenha o bucket privado. Não habilite `r2.dev`, domínio público ou listagem pública.
3. Gere uma credencial S3 com permissão apenas de leitura/gravação/remoção para esse bucket. Guarde o segredo imediatamente: ele não pode ser consultado de novo.
4. Configure alertas de custo/armazenamento no Cloudflare.
5. Crie regra de ciclo de vida somente para uploads multipart incompletos. Não configure exclusão automática de fotos sem uma política de retenção aprovada.
6. Planeje cópia periódica para um segundo bucket/conta antes de depender das fotos como acervo definitivo.

O navegador envia fotos pelo servidor, portanto não é necessário liberar CORS do bucket para convidados. Os limites atuais da aplicação são `MAX_UPLOAD_BYTES` (recomendado: 15 MB) e teto absoluto de 25 MB por foto.

### Domínio e HTTPS

1. Escolha um domínio canônico, por exemplo `sitecasamento.com.br` ou `www.sitecasamento.com.br`.
2. No projeto Vercel, adicione o domínio em **Settings > Domains**.
3. Execute `vercel domains inspect SEU_DOMINIO` ou use a tela da Vercel para obter o registro DNS exato.
4. Crie no registrador/DNS o registro informado e remova registros conflitantes.
5. Configure redirecionamento do domínio alternativo para o canônico.
6. Espere a verificação. A Vercel provisiona e renova o certificado HTTPS após o DNS ser validado.

## 2. Configurar variáveis de produção

Cadastre as variáveis a seguir como **Production** e marque segredos como sensíveis no painel da Vercel. Nunca use valores de desenvolvimento em Production.

```dotenv
APP_URL="https://SEU_DOMINIO"
ALLOWED_ORIGINS="https://SEU_DOMINIO"
TRUST_PROXY="true"
COOKIE_SECURE="true"
SESSION_TTL_DAYS="30"

DATABASE_URL="postgresql://USUARIO:SENHA@HOST_POOLADO:5432/BANCO?sslmode=require"
DATABASE_POOL_MAX="2"
DATABASE_CONNECTION_TIMEOUT_MS="10000"

STORAGE_DRIVER="s3-compatible"
MAX_UPLOAD_BYTES="15728640"
S3_BUCKET="sitecasamento-production-photos"
S3_REGION="auto"
S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_FORCE_PATH_STYLE="false"

PLATFORM_ADMIN_EMAIL="admin@SEU_DOMINIO"
PLATFORM_ADMIN_PASSWORD="senha-exclusiva-com-no-minimo-6-caracteres"
PLATFORM_ADMIN_NAME="Administrador SiteCasamento"

SENTRY_DSN="https://..."
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="0.1"
```

Opcional somente no ambiente de build/CI, para source maps do Sentry:

```dotenv
SENTRY_AUTH_TOKEN="..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
SENTRY_RELEASE="versao-ou-sha"
```

Não defina `DEMO_ADMIN_*`, `LOCAL_STORAGE_PATH` ou `STORAGE_DRIVER=local` em Production. `NEXT_PUBLIC_*` é incorporada ao JavaScript do navegador no build; apenas valores públicos podem usar esse prefixo.

## 3. Validar antes do primeiro deploy

Em uma máquina confiável, crie um arquivo local com os valores de produção, sem commitá-lo. No PowerShell:

```powershell
$env:NODE_ENV = "production"
npm ci
npm run deploy:check
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run build` executa `prisma generate` antes do Next.js, portanto uma instalação limpa não depende do Prisma Client gerado localmente.

## 4. Aplicar migrations e criar o primeiro administrador

Faça estas ações **uma vez** para a primeira publicação e sempre de forma controlada nas atualizações de schema. Não coloque `prisma migrate deploy` no build de cada instância serverless.

1. Carregue temporariamente a URL direta do banco de produção e as três variáveis `PLATFORM_ADMIN_*` em um terminal confiável.
2. Confirme que está apontando para produção pelo hostname do banco, sem imprimir a URL ou a senha.
3. Execute:

```powershell
$env:NODE_ENV = "production"
npm run db:deploy
npm run platform:admin
npm run db:check
```

4. Remova o arquivo/local environment com os segredos ao terminar ou mantenha-o em cofre local criptografado.

`db:deploy` apenas aplica migrations existentes. Nunca execute `db:seed`, `db:migrate` ou reset no banco de produção. `platform:admin` cria/atualiza somente o administrador informado e persiste hash de senha, não a senha em texto.

## 5. Publicar a aplicação

### Pelo painel da Vercel

1. Importe o repositório privado.
2. Confirme que o framework detectado é **Next.js**.
3. Use `npm ci` como Install Command e `npm run build` como Build Command. Não configure Output Directory nem Static Export.
4. Cadastre as variáveis em Production.
5. Crie primeiro um Preview sem dados de produção. Um preview não deve compartilhar banco, bucket ou chaves de produção.
6. Depois da aprovação, promova/publice em Production pelo painel.

### Pela CLI, após autorização

```powershell
npx vercel login
npx vercel link
npx vercel deploy
npx vercel deploy --prod
```

Os dois últimos comandos criam deploys; execute-os apenas quando a publicação estiver autorizada. Antes disso, `npx vercel deploy --dry` permite conferir arquivos incluídos sem publicar nada.

## 6. Verificação depois do deploy

1. Abra `https://SEU_DOMINIO/api/health`. A resposta esperada é `{"status":"ok"}`; ela não expõe dados internos e não deve ser indexada.
2. Confirme HTTPS e redirecionamento para o domínio canônico.
3. Faça login do administrador e de uma cerimonialista de teste.
4. Crie um casamento de teste, abra o QR Code/link em outro navegador e envie uma foto.
5. Confirme a foto no Book/Galeria e depois revogue o acesso público, verificando que o Book continua acessível ao painel.
6. Confira logs de erro na Vercel e o evento de teste permitido no Sentry.
7. Execute o smoke test somente contra uma base de teste, nunca contra a base real de casamentos sem revisão:

```powershell
$env:SMOKE_BASE_URL = "https://SEU_DOMINIO"
npm run test:production-smoke
```

## Logs e monitoramento

- Use os logs da Vercel para respostas 5xx, erros de function e diagnóstico pontual. Não registre senhas, tokens de convidados ou URLs com credenciais.
- Use Sentry para alertas de exceções e performance. Consulte [operations/sentry.md](operations/sentry.md).
- Configure monitor externo para chamar `/api/health` a cada 1 a 5 minutos e alertar após falhas consecutivas.
- Acompanhe espaço do Neon, conexões, capacidade/custo do R2, rejeições de upload e respostas 429.
- O rate limit da aplicação é por processo; complemente-o com WAF/rate limiting do provedor quando houver múltiplas instâncias ou tráfego alto.

## Backups e restauração

### Rotina mínima

1. Ative PITR/snapshots no banco e reveja a retenção mensalmente.
2. Exporte backup lógico periódico com `pg_dump` usando conexão direta, armazene criptografado e teste a restauração em banco isolado.
3. Mantenha cópia das fotos em bucket/conta de backup separado. Banco e fotos precisam ser recuperáveis no mesmo ponto lógico: a tabela `Photo.storageKey` deve existir no bucket restaurado.
4. Registre quem pode iniciar restauração e exija confirmação de um segundo responsável antes de trocar produção.

### Restaurar sem piorar o incidente

1. Pause mudanças administrativas e preserve logs.
2. Restaure primeiro para novo projeto/branch/banco, nunca por cima da produção.
3. Execute `npm run db:check` contra a cópia restaurada e confira fotos de amostra no bucket de backup.
4. Aponte um ambiente de diagnóstico isolado para a cópia e valide login, casamento, missão e galeria.
5. Só então programe a troca de `DATABASE_URL`/bucket em produção e faça um novo deploy. Documente horário e ponto de recuperação usados.

Reverter somente a aplicação na Vercel não desfaz uma migration. Para mudanças de schema, use migrations compatíveis com versões antigas (expandir, publicar, migrar dados, remover em versão posterior).

## Atualizações futuras

1. Trabalhe em branch e abra pull request.
2. Rode `npm run deploy:check`, typecheck, lint, testes e build com variáveis de teste.
3. Revise migrations. Se existirem, faça backup/snapshot e aplique `npm run db:deploy` uma única vez antes do deploy que depende delas.
4. Valide Preview com banco/bucket isolados.
5. Publique em Production, valide `/api/health`, fluxos críticos e logs/Sentry.
6. Se necessário, reverta o deploy da aplicação na Vercel; trate migrations e dados com o plano de restauração, nunca com reset automático.

## Revisão final de arquivos

- `.env`, `.env.*`, bancos locais, logs, `.next`, storage local e credenciais já são ignorados pelo Git.
- `docs/` e material interno são excluídos do upload da Vercel por `.vercelignore`; nenhum documento é uma rota pública do Next.js.
- Somente arquivos em `public/` são servidos estaticamente. Não coloque documentação, export de banco, chaves ou fotos privadas nessa pasta.
- O código não usa URLs locais em produção: `APP_URL` HTTPS e `STORAGE_DRIVER=s3-compatible` são validados por `npm run deploy:check`.

## Fontes oficiais

- [Deploy de projeto pela Vercel CLI](https://vercel.com/docs/projects/deploy-from-cli)
- [Domínio e HTTPS na Vercel](https://vercel.com/docs/domains/set-up-custom-domain)
- [Arquivos excluídos com `.vercelignore`](https://vercel.com/docs/deployments/vercel-ignore)
- [Cloudflare R2 S3-compatible](https://developers.cloudflare.com/r2/get-started/s3/)
- [Ciclo de vida de objetos no R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Backup e restore no Neon](https://neon.com/docs/changelog/2025-10-31)
