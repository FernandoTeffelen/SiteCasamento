# SiteCasamento

Plataforma mobile-first de gamificação fotográfica para casamentos. Convidados participam de missões pelo celular via QR Code ou link, sem instalar nada. O mesmo projeto Next.js reúne o site comercial público, o jogo privado de cada casamento e o painel administrativo das cerimonialistas.

## Arquitetura dos ambientes

| Área | Rotas principais | Acesso |
| --- | --- | --- |
| Comercial | `/`, `/planos` | Público |
| Autenticação | `/app/login`, `/app/cadastro` | Público |
| Casamento | `/w/{token}`, `/w/{token}/jogo`, `/w/{token}/fotos` | Token público não enumerável |
| Administrativo | `/app`, `/app/configuracoes` | Cerimonialista autenticada + plano ativo |

As rotas `/api` são Route Handlers do Next.js; não existe backend separado. O identificador público do casamento é um token opaco (`Wedding.publicId`), nunca o ID interno. Links antigos em `/evento/{token}` redirecionam para `/w/{token}`.

## Fluxo de acesso da cerimonialista

1. **Cadastro** em `/app/cadastro`: cria conta, organização e faz login automaticamente.
2. **Sem plano ativo**: redireciona para `/planos` para escolher uma assinatura.
3. **Com plano ativo**: redireciona para `/app` (painel administrativo).
4. O usuário demo `cerimonial@demo.test` é tratado como pagante vitalício para testes locais.

## Stack

- Next.js 16 (App Router), React e TypeScript estrito
- PostgreSQL com Prisma como única camada de acesso ao banco
- `ObjectStorage` para fotos (local em desenvolvimento, S3-compatible em produção)
- `tsx --test` para testes de integração

## Banco de dados e migrations

O banco é PostgreSQL. O modelo está em [`prisma/schema.prisma`](prisma/schema.prisma) e as migrações em [`prisma/migrations`](prisma/migrations).

### Rodar localmente

```bash
npm install
# configure DATABASE_URL em .env (veja .env.example)
npm run db:deploy
npm run db:generate
npm run db:seed       # somente desenvolvimento/demo
npm run db:check
npm run dev
```

Nunca faça reset do banco de produção; use `npm run db:deploy`, que aplica migrations pendentes sem apagar dados.

## Deploy (frontend e backend no mesmo link)

Hospede em Vercel (ou similar) com um PostgreSQL gerenciado (Neon, Supabase, Railway, etc.).

1. Importe o repositório no host Next.js.
2. Crie um PostgreSQL gerenciado e configure `DATABASE_URL`.
3. Configure as variáveis de ambiente:

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

4. Execute `npm run db:deploy` uma vez no banco de produção.
5. Configure o build como `npm run build`.

O armazenamento local (`STORAGE_DRIVER=local`) não é adequado para ambientes serverless.

## Links e ciclo de vida do casamento

Um link público tem o formato `https://seu-dominio/w/{publicId}`. Ele funciona apenas enquanto o casamento está ativo e dentro da janela `publicAccessStartsAt`/`publicAccessEndsAt`. Após expirar, convidados perdem acesso, mas os dados permanecem no banco para o painel administrativo. O `publicId` é gerado de forma opaca e compartilhado via QR Code.

## Painel administrativo

Acesso em `/app`. Requer conta cadastrada e plano ativo (ou ser o usuário demo). A cerimonialista pode:

- Criar casamentos (gera link/token seguro + missões padrão);
- Visualizar fotos enviadas pelos convidados em tempo real;
- Ver ranking de convidados por casamento;
- Excluir casamentos;
- Gerenciar perfil e senha em `/app/configuracoes`.

## Créditos e pagamentos

A estrutura de planos, créditos e assinaturas existe no banco e nos serviços. Gateway de pagamento e cobrança real ainda não estão conectados a um provedor.

## Verificação antes de publicar

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
