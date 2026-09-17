# SiteCasamento

Aplicação mobile-first para convidados participarem de missões fotográficas em casamentos por QR Code ou link, sem instalar aplicativo. O projeto reúne o site comercial, a experiência do casamento, o painel da cerimonialista e a gestão interna da plataforma.

## Estado atual

- Produção: [site-casamento-fernando.vercel.app](https://site-casamento-fernando.vercel.app).
- Aplicação e APIs: Next.js na Vercel.
- Banco de produção: PostgreSQL no Neon.
- Fotos em produção: bucket privado `sitecasamento-photos-test` no Cloudflare R2.
- Desenvolvimento: PostgreSQL e MinIO pelo `compose.yaml`.
- Cloudflare Workers não é usado para hospedar a aplicação. O repositório foi desconectado do Worker `sitecasamento`; o R2 continua ativo somente como armazenamento.

## Funcionalidades

- Links privados por casamento com token opaco (`Wedding.publicId`).
- Convidados, missões, pontuação, ranking e uploads validados no servidor.
- Fila offline de fotos com estados `pending`, `uploading`, `uploaded` e `failed`.
- Painel da cerimonialista com casamentos, convidados, ranking e galeria.
- Créditos, planos, catálogo comercial, aceite jurídico e checkout preparado para Mercado Pago.
- Área do proprietário em `/gestao-interna`, protegida no backend.

## Rotas principais

| Área | Rotas | Acesso |
| --- | --- | --- |
| Site comercial | `/`, `/planos` | Público |
| Documentos jurídicos | `/privacidade`, `/termos-de-uso`, `/termo-comercial` | Público |
| Conta do cliente | `/app/login`, `/app/cadastro`, `/app`, `/app/configuracoes` | Cerimonialista ou casal |
| Casamento | `/w/{token}`, `/w/{token}/jogo`, `/w/{token}/fotos` | Convidado com token válido |
| Gestão interna | `/gestao-interna/login`, `/gestao-interna`, `/gestao-interna/clientes` | Administrador da plataforma |

`GET /api/health` verifica a disponibilidade da aplicação. As demais rotas `/api` são Route Handlers do Next.js e validam autenticação, casamento, permissões e dados no servidor.

## Desenvolvimento local

Pré-requisitos: Node.js 24, npm e Docker Desktop.

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run db:deploy
npm run db:generate
npm run catalog:sync
npm run legal:sync
npm run db:check
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O PostgreSQL usa `localhost:5433`; o MinIO usa `localhost:9000` (API) e `localhost:9001` (console). Para parar os containers: `npm run db:stop`.

O seed é somente para desenvolvimento:

```powershell
npm run db:seed
```

Nunca use reset em banco com dados importantes. Em produção, migrations são aplicadas somente com `npm run db:deploy`.

## Produção

Configure as variáveis de `.env.example` no ambiente da Vercel. Os valores principais são:

- `DATABASE_URL`: conexão PostgreSQL do Neon;
- `STORAGE_DRIVER=s3-compatible`;
- `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`: credenciais privadas do R2;
- `APP_URL`, `ALLOWED_ORIGINS`, `COOKIE_SECURE` e `TRUST_PROXY` para o domínio HTTPS;
- `PLATFORM_ADMIN_*` para provisionar o primeiro administrador;
- `MERCADO_PAGO_*` somente quando o checkout for habilitado.

Não coloque `.env`, tokens, senhas, chaves R2 ou credenciais de pagamento no Git. A pasta `docs/` contém anotações operacionais locais e permanece ignorada pelo Git.

### Upload de fotos

Com `STORAGE_DRIVER=s3-compatible`, o navegador solicita uma URL assinada curta (10 minutos) e envia o arquivo diretamente ao R2. A aplicação só registra a foto e a pontuação depois de buscar o objeto privado, validar MIME, tamanho e assinatura do arquivo. O envio local, e qualquer driver sem URLs assinadas, continua usando a rota compatível pela aplicação.

No bucket privado `sitecasamento-photos-test`, mantenha a política CORS abaixo para o upload direto. Ela não torna fotos públicas e só permite `PUT` de produção e localhost com o `Content-Type` assinado:

```json
[
  {
    "AllowedOrigins": [
      "https://site-casamento-fernando.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

As URLs assinadas são limitadas a uma única chave privada por envio e expiram. A fila IndexedDB conserva o arquivo até a confirmação final; reenvios reutilizam o mesmo `uploadId`, sem duplicar foto nem pontos.

## Cache

- Catálogo comercial: cache de 60 segundos; os preços continuam sendo validados no servidor no checkout.
- Templates ativos: cache de 1 hora, com tag `wedding-templates-v1` para invalidação ao alterar o catálogo de templates.
- Configuração visual de cada casamento: cache de 1 hora, invalidado imediatamente pelas funções de troca de template ou personalização daquele casamento.
- Lista-base de missões ativas: cache de 5 minutos por casamento. Pontuação, envios, conclusão por convidado, ranking, sessões, pagamentos e dados administrativos permanecem sem cache compartilhado.

O cache do Next é usado somente no runtime da aplicação; testes e scripts diretos continuam consultando o banco para permanecerem determinísticos.

## Qualidade

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run db:check
```

## Estrutura

```text
src/app/              páginas, layouts e APIs do Next.js
src/features/         domínios da aplicação
src/server/           Prisma, autenticação e regras de negócio
src/lib/              contratos e utilitários compartilhados
prisma/               schema e migrations PostgreSQL
tests/                testes de integração
compose.yaml          PostgreSQL e MinIO locais
```

Regras de arquitetura e segurança estão em [AGENTS.md](AGENTS.md). Alterações de schema exigem migration revisada; não acople regras de domínio ao R2, S3 ou ao disco local.
