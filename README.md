# SiteCasamento

Plataforma mobile-first para convidados participarem de missões fotográficas em casamentos por QR Code ou link, sem instalar aplicativo. O projeto reúne o site comercial, a experiência privada de cada casamento, o painel da cerimonialista e a área interna do proprietário da plataforma.

## Funcionalidades atuais

- Links privados por casamento usando token opaco e não enumerável (`Wedding.publicId`), nunca o ID interno do banco.
- Janela de acesso público com expiração e revogação manual, sem apagar os dados do casamento.
- Cadastro de convidados isolado por casamento, com possibilidade de trocar de convidado no mesmo celular.
- Missões, envio de fotos, pontuação e ranking calculados e validados no servidor.
- Fila local de fotos com estados de envio e armazenamento por meio da abstração `ObjectStorage`.
- Painel da cerimonialista com casamentos, links, convidados, ranking, fotos recentes e Book/Galeria.
- Galeria administrativa paginada, com filtros por convidado e missão e visualização ampliada.
- Planos com créditos mensais, créditos avulsos e histórico de movimentações.
- Catálogo comercial centralizado no banco, com preços em centavos (`priceCents`), planos, pacotes e descontos progressivos.
- Checkout hospedado do Mercado Pago preparado para cartão e PIX; o navegador nunca manipula dados de cartão.
- Webhook do Mercado Pago com validação de assinatura, consulta direta ao provedor, auditoria de eventos/tentativas e idempotência antes de liberar créditos ou plano.
- Liberação manual de acesso pelo proprietário após pagamento via PIX, com confirmação explícita e histórico preservado.
- Páginas públicas de Privacidade, Termos de Uso e Termo Comercial; os aceites são versionados e registrados no cadastro, checkout e envio de fotos.
- Área exclusiva do proprietário em `/gestao-interna`, protegida no backend por usuário com `PLATFORM_ADMIN`.
- Exclusão de casamento protegida pela senha da cerimonialista e com confirmação em modal.

## Rotas principais

| Área | Rotas | Acesso |
| --- | --- | --- |
| Site comercial | `/`, `/planos` | Público |
| Documentos jurídicos | `/privacidade`, `/termos-de-uso`, `/termo-comercial` | Público |
| Conta do cliente | `/app/login`, `/app/cadastro`, `/app`, `/app/configuracoes` | Cerimonialista ou casal |
| Retorno do pagamento | `/pagamento/retorno` | Cliente autenticado; mostra somente o status confirmado no servidor |
| Casamento | `/w/{token}`, `/w/{token}/jogo`, `/w/{token}/fotos` | Convidado com token válido |
| Gestão do proprietário | `/gestao-interna/login`, `/gestao-interna`, `/gestao-interna/clientes` | Somente administrador da plataforma |

As rotas `/api` são Route Handlers do Next.js. A área do proprietário não é exibida no painel comum e todas as operações administrativas são verificadas no backend.

`GET /api/health` verifica a disponibilidade da aplicação e do banco sem retornar dados internos. Ele serve para monitoramento externo e não deve ser indexado.

As rotas legadas `/evento/{token}` continuam apenas como redirecionamento para `/w/{token}`. A experiência pública, o painel e a gestão interna não têm telas duplicadas para o mesmo fluxo.

## Oferta comercial atual

O catálogo é sincronizado por `npm run catalog:sync`; o frontend apenas o consulta. Valores são gravados em centavos — por exemplo, `R$ 599,00` é `59900`.

| Período | Starter | Pro | Agency |
| --- | ---: | ---: | ---: |
| 1 mês | R$ 399/mês | R$ 750/mês | R$ 1.100/mês |
| 3 meses | R$ 350/mês | R$ 650/mês | R$ 950/mês |
| 6 meses | R$ 300/mês | R$ 550/mês | R$ 800/mês |
| 12 meses | R$ 250/mês | R$ 450/mês | R$ 650/mês |

Créditos avulsos: 1 crédito por R$ 150, 3 por R$ 140 cada, 5 por R$ 130 cada e 10 por R$ 120 cada. Na compra personalizada, de 11 a 15 créditos custam R$ 110 cada; de 16 a 20, R$ 100; e de 21 a 30, R$ 90. O total exibido é sempre calculado pelo servidor a partir do catálogo vigente.

## Stack e arquitetura

- Next.js 16 com App Router, React e TypeScript estrito.
- PostgreSQL 16 com Prisma como única camada de acesso ao banco.
- `src/features` para domínios da aplicação.
- `src/server` para autenticação, autorização, regras de negócio e acesso ao banco.
- `src/lib` para contratos e utilitários compartilhados.
- `ObjectStorage` para fotos: disco local em desenvolvimento e S3-compatible/R2 em produção.
- Testes de integração com `tsx --test`.

## Configuração local

Pré-requisitos: Node.js, npm e Docker Desktop (para o PostgreSQL local).

No PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run db:deploy
npm run db:generate
npm run catalog:sync
npm run catalog:check
npm run legal:sync
npm run legal:check
npm run db:seed
npm run db:check
npm run dev
```

Abra `http://localhost:3000`. O PostgreSQL local usa a porta `5433`, conforme o `compose.yaml`.

Para parar somente o banco local:

```powershell
npm run db:stop
```

Nunca use reset do banco em um ambiente com dados importantes. Use migrations com `npm run db:deploy`.

## Implantação em produção

Com um PostgreSQL vazio e um Object Storage privado já provisionados, configure
as variáveis de `.env.example` no secret manager do ambiente e execute:

```powershell
npm ci
npm run db:deploy
npm run db:generate
npm run catalog:sync
npm run catalog:check
npm run legal:sync
npm run legal:check
npm run platform:admin
npm run build
npm run start
```

`npm run db:deploy` é o único comando de schema permitido em produção: ele
aplica as migrations sem resetar dados. `npm run catalog:sync` e `npm run legal:sync` fazem apenas
upserts do catálogo comercial e das versões jurídicas definidas pelo projeto. Não execute
`npm run db:seed` em produção; o seed é somente para desenvolvimento e inclui
dados fictícios.

A arquitetura recomendada e o procedimento completo de publicação manual, domínio, HTTPS, banco, R2, backups, monitoramento, atualização e restauração estão em [`docs/DEPLOY.md`](docs/DEPLOY.md). A configuração do checkout está em [`docs/MERCADO_PAGO.md`](docs/MERCADO_PAGO.md), e as pendências para revisão por advogado estão em [`docs/LEGAL_REVIEW.md`](docs/LEGAL_REVIEW.md). Nenhuma conta ou deploy é criado automaticamente pelo projeto.

### Primeiro administrador da plataforma

Defina `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` e
`PLATFORM_ADMIN_NAME` no secret manager ou no ambiente do deploy, sem gravá-los
no código, README, `.env.example` ou commits. A senha deve ter de 6 a 256
caracteres. Depois execute `npm run platform:admin` em um ambiente com acesso
ao banco. O comando cria ou atualiza somente o usuário informado e persiste
apenas o hash da senha. Em produção não existe conta demo automática.

## Contas de demonstração

O seed cria a conta demo da cerimonialista usando `DEMO_ADMIN_EMAIL` e `DEMO_ADMIN_PASSWORD` do `.env` local. Exemplo de configuração:

```text
DEMO_ADMIN_EMAIL=cerimonial@demo.test
DEMO_ADMIN_PASSWORD=defina-uma-senha-local-com-no-minimo-6-caracteres
Painel: http://localhost:3000/app/login
```

A conta demo possui créditos amplos apenas fora de produção. Para criar o administrador do proprietário, preencha no `.env`:

```text
PLATFORM_ADMIN_EMAIL=dono@demo.test
PLATFORM_ADMIN_PASSWORD=uma-senha-com-no-minimo-6-caracteres
PLATFORM_ADMIN_NAME=Dono do SiteCasamento
```

Depois execute:

```powershell
npm run platform:admin
```

O login do proprietário fica em `http://localhost:3000/gestao-interna/login`. O e-mail e a senha reais permanecem somente no `.env`; não os coloque no README, em commits ou em screenshots.

## Fluxos de teste

1. Cadastre uma conta em `/app/cadastro` escolhendo casal ou cerimonialista.
2. Entre no painel do proprietário e abra `/gestao-interna/clientes`.
3. Abra os detalhes do novo cliente e libere um crédito avulso ou um plano mensal.
4. Faça login novamente como cliente em `/app/login` e confirme os créditos em `/app/configuracoes`.
5. Crie um casamento. A ativação consome um crédito e o link aparece no painel.
6. Abra o link `/w/{token}` em outro navegador ou dispositivo, registre convidados e envie fotos.
7. No painel da cerimonialista, abra o Book/Galeria para paginar e filtrar as fotos.

### Checkout Mercado Pago em desenvolvimento

1. Configure as quatro variáveis `MERCADO_PAGO_*` descritas em [docs/MERCADO_PAGO.md](docs/MERCADO_PAGO.md), usando somente credenciais de teste.
2. Escolha um plano ou pacote em `/planos`, aceite o Termo Comercial e conclua o checkout hospedado.
3. Confirme no Mercado Pago que a notificação chegou a `/api/payments/mercado-pago/webhook`.
4. Abra `/pagamento/retorno?external_reference=...` ou a área de assinatura da conta. O acesso só muda após a confirmação autenticada registrada pelo servidor.

O retorno do navegador não concede produto. Pagamentos pendentes, recusados e falhas temporárias ficam auditáveis para conferência e reprocessamento seguro.

O link público deixa de funcionar ao expirar ou ser revogado, mas o casamento, convidados e fotos continuam disponíveis para a cerimonialista autorizada.

## Variáveis de ambiente

As variáveis obrigatórias e seus exemplos estão em `.env.example`:

- `DATABASE_URL`: conexão PostgreSQL.
- `STORAGE_DRIVER` e `LOCAL_STORAGE_PATH`: armazenamento local de desenvolvimento.
- `MAX_UPLOAD_BYTES`: limite de upload.
- `DATABASE_POOL_MAX` e `DATABASE_CONNECTION_TIMEOUT_MS`: limites do pool e timeout por conexão.
- `APP_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `COOKIE_SECURE` e `SESSION_TTL_DAYS`: origem, proxy confiável, cookies e duração das sessões.
- `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` e `PLATFORM_ADMIN_NAME`: provisionamento do proprietário.
- `S3_*`: armazenamento compatível com S3/R2 em produção.
- `MERCADO_PAGO_*`: token de servidor, segredo da assinatura do webhook, origem HTTPS pública e modo sandbox do Checkout Pro. Sem essas variáveis o botão de checkout permanece indisponível de propósito.
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, ambiente e amostragem: monitoramento de erros e performance.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_RELEASE`: somente no CI/deploy para publicar source maps.

O armazenamento local não é indicado para ambientes serverless. Em produção, use PostgreSQL gerenciado e Object Storage privado.
Para configurar o monitoramento, consulte [`docs/operations/sentry.md`](docs/operations/sentry.md).

## Comandos de qualidade

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run db:check
npm run deploy:check
npm run test:production-smoke
```

O verificador de produção exige armazenamento persistente e configuração segura
do Mercado Pago. Com valores locais ou sandbox ele falha de propósito antes da
publicação.

O relatório da rodada de testes de produção está em [`docs/operations/production-test-report.md`](docs/operations/production-test-report.md).

Os testes cobrem autenticação, isolamento entre organizações e casamentos, tokens inválidos/expirados/revogados, créditos, uploads, galeria, exclusão protegida por senha e pagamentos aprovados, pendentes, recusados, duplicados e reprocessados após falha de comunicação.

O histórico de alterações administrativas fica em `AdminAuditLog`; `CreditLedgerEntry` permanece como fonte de auditoria dos créditos.

## Estrutura resumida

```text
src/app/              páginas, layouts e APIs do Next.js
src/features/         domínios de convidados, jogo e casamento
src/server/           Prisma, autenticação, billing e regras de negócio
src/lib/              contratos e utilitários compartilhados
prisma/schema.prisma  modelo PostgreSQL
prisma/migrations/    histórico do schema
tests/                testes de integração
docs/                 operação, segurança e deploy (não publicado pela aplicação)
```

## Pendências conhecidas

- A integração Mercado Pago depende de credenciais, URL HTTPS pública e webhook configurados pelo proprietário. Até isso acontecer, a liberação manual por PIX continua disponível.
- A geração de álbum físico e edição avançada da galeria ainda não fazem parte do produto.
- O serviço de tarefas para liberar créditos mensais deve ser executado por um scheduler/worker em produção.
- Os textos jurídicos são versões iniciais e precisam de revisão de advogado brasileiro antes de publicação comercial.
