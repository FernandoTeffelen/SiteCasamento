# SiteCasamento

Aplicação mobile-first para convidados participarem de missões fotográficas em casamentos, acessada por QR Code ou link. O mesmo projeto Next.js reúne o site comercial, o site privado de cada casamento e a base do painel administrativo.

## Arquitetura dos ambientes

| Área | Rotas principais | Acesso |
| --- | --- | --- |
| Comercial | `/`, `/planos` | Público |
| Casamento | `/w/{token}`, `/w/{token}/jogo`, `/w/{token}/fotos` | Token público não enumerável e janela do evento |
| Administrativo | `/app/login`, `/app` | Usuária da cerimonialista com e-mail e senha |

As rotas `/api` são Route Handlers do próprio Next.js; não existe um backend separado para hospedar. O identificador público do casamento é um token opaco (`Wedding.publicId`), nunca o ID interno nem um slug previsível. Links antigos em `/evento/{token}` apenas redirecionam para `/w/{token}`.

## Stack

- Next.js (App Router), React e TypeScript estrito;
- PostgreSQL com Prisma como única camada de acesso ao banco;
- `ObjectStorage` para fotos (local em desenvolvimento e S3-compatible em produção);
- Vitest para testes.

## Banco de dados e migrations

O banco é PostgreSQL de verdade, não SQLite nem memória. O modelo está em [`prisma/schema.prisma`](prisma/schema.prisma) e as alterações versionadas em [`prisma/migrations`](prisma/migrations). Ele contém organizações/cerimonialistas, usuários, casamentos, convidados, missões, fotos, pontuação, templates, créditos e assinaturas.

No desenvolvimento desta cópia, `DATABASE_URL` aponta para `localhost:5433`, banco `site_casamento`. Os arquivos do cluster ficam em `.local-postgres-data/`, fora do código e ignorados pelo Git. Isso é apenas um banco local: não fica disponível na internet e não deve ser usado como banco de produção.

### Rodar localmente

```bash
npm install
# configure DATABASE_URL em .env
npm run db:deploy
npm run db:generate
npm run db:seed       # somente desenvolvimento/demo
npm run db:check
npm run dev
```

Se o PostgreSQL estiver em outro host/porta, altere somente `DATABASE_URL`. Nunca faça reset do banco de produção; use `npm run db:deploy`, que aplica migrations pendentes sem apagar dados.

## Deploy com frontend e backend no mesmo link

O caminho mais simples é hospedar o repositório em Vercel (ou outro host que execute Next.js) e usar um PostgreSQL gerenciado, como Neon, Supabase, Railway, Render ou RDS. O provedor de hospedagem fornece uma única URL para páginas e APIs.

1. Suba o projeto para um repositório Git e importe-o no host Next.js.
2. Crie um PostgreSQL gerenciado e copie a `DATABASE_URL` (com SSL quando exigido). Para migrations, prefira a URL direta do provedor; poolers podem ser usados pela aplicação quando o provedor recomendar.
3. Configure no ambiente de produção:

   ```text
   DATABASE_URL=postgresql://...
   STORAGE_DRIVER=s3-compatible
   S3_ENDPOINT=https://...
   S3_REGION=...
   S3_BUCKET=...
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   MAX_UPLOAD_BYTES=15728640
   ```

   O bucket deve ser privado. Não publique `.env`, chaves ou credenciais.
4. Execute uma vez, apontando para o banco de produção, `npm run db:deploy` (ou `npx prisma migrate deploy`). Não execute `db:seed` em produção: o seed recria dados de demonstração.
5. Configure o build como `npm run build`. Em hosts que exigem comando de start, use `npm run start` após o build. No Vercel, o adaptador Next.js faz isso automaticamente.
6. Abra a URL gerada e teste uma página comercial, uma rota `/w/{token}` e uma chamada `/api`. O backend já está no mesmo deploy.

O armazenamento local (`STORAGE_DRIVER=local` e `.local-storage/`) não é adequado para Vercel/serverless, pois pode ser efêmero. Em produção use R2, S3 ou outro storage compatível e mantenha o bucket privado.

## Links e ciclo de vida do casamento

Um link público tem o formato `https://seu-dominio/w/{publicId}`. Ele só funciona quando o casamento está ativo e dentro de `publicAccessStartsAt`/`publicAccessEndsAt`; depois do fim, convidados perdem acesso, mas os dados continuam no banco para o painel. O `publicId` deve ser gerado de forma opaca e compartilhado pelo QR Code.

## Painel administrativo

O login inicial está em `/app/login`. Não existe senha padrão nem cadastro público: a senha deve ser provisionada de forma segura pelo serviço de autenticação (`setAdminPassword`). As telas administrativas completas ainda serão construídas, mas a sessão, proteção da rota e isolamento por organização já estão preparados.

## Créditos e pagamentos

A estrutura de planos recorrentes, créditos avulsos, saldo, histórico e consumo idempotente já existe no banco e nos serviços. Gateway de pagamento, cobrança real, templates Premium e White Label ainda não estão conectados a um provedor.

## Fotos, pontuação e testes

O servidor valida MIME/tamanho, vincula foto a casamento, convidado e missão, registra moderação futura e concede pontos uma única vez por origem. O ranking é separado por casamento. Para validar antes de publicar:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run db:check
```

## Estrutura resumida

```text
src/app/              páginas, layouts e APIs Next.js
src/features/         domínios de convidados, jogo e casamento
src/server/           Prisma, autenticação, billing e regras de negócio
src/lib/              contratos e utilitários compartilhados
prisma/schema.prisma  modelo PostgreSQL
prisma/migrations/    histórico do schema
```

Consulte [`notas.txt`](notas.txt) para o passo a passo operacional de deploy e banco.
