# Jogo de Fotos para Casamentos

Web app mobile-first para convidados participarem de missões fotográficas por
QR Code. A interface identifica o convidado, busca missões e envia fotos reais
com uma fila local tolerante a falhas de conexão.

## Tecnologias

- Next.js 16, React 19 e TypeScript
- CSS puro, com layout mobile-first e suporte a áreas seguras do iPhone
- PostgreSQL e Prisma 7 com adaptador `pg`
- PostgreSQL 16 em Docker Compose para desenvolvimento local
- Manifesto web preparado para a futura PWA
- Object storage local no desenvolvimento e adaptador S3 compatível para R2,
  Amazon S3 ou MinIO em produção

## Instalação e banco local

Pré-requisitos: Node.js 20.9 ou posterior e Docker Desktop.

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env`. A configuração local usa a porta `5433`
   para não conflitar com outro PostgreSQL na porta padrão.
3. Inicie o PostgreSQL local: `npm run db:up`.
4. Aplique as migrations existentes: `npm run db:deploy`.
5. Insira os dados fictícios: `npm run db:seed`.
6. Teste a conexão e o isolamento dos eventos: `npm run db:check`.
7. Inicie o projeto: `npm run dev`.

Abra `http://localhost:3000` no navegador. Para validar o projeto, execute
`npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

Para criar uma migration durante o desenvolvimento, depois de editar
`prisma/schema.prisma`, use `npm run db:migrate -- --name descricao_da_mudanca`.
Para interromper o banco local sem apagar os dados, use `npm run db:stop`.

Em produção, use um PostgreSQL gerenciado e defina a `DATABASE_URL` do provedor.
O deploy deve executar `npm run db:deploy`; não execute o seed de demonstração.

## Fotos e armazenamento

Antes de uma tentativa de upload, a foto original é salva no IndexedDB do
navegador. Enquanto a página estiver aberta, a fila tenta itens pendentes ao
abrir o jogo, ao recuperar conexão e ao voltar para a tela. Isso não depende de
Background Sync, que não é confiável no Safari. Fotos com falha permanecem no
aparelho e podem ser reenviadas em **Minhas fotos**.

No desenvolvimento, use `STORAGE_DRIVER="local"`: os arquivos vão para
`.local-storage/`, ignorado pelo Git. Para R2, S3 ou MinIO, altere para
`STORAGE_DRIVER="s3-compatible"` e preencha as variáveis `S3_*` documentadas
em `.env.example`. O bucket deve ficar privado; URLs de leitura assinadas serão
criadas junto do futuro álbum/painel autorizado.

O servidor aceita JPEG, PNG, WebP e HEIC/HEIF, valida a assinatura do arquivo
e limita cada upload a 15 MB por padrão (`MAX_UPLOAD_BYTES`). A chave enviada
pela fila é idempotente: repetir uma solicitação após queda de rede não cria
uma segunda foto nem concede pontos novamente.

## Estrutura

```
compose.yaml             PostgreSQL local em Docker
prisma/                  schema, migrations, seed e verificação do banco
public/                  arquivos estáticos e manifesto PWA
src/app/                 rotas, layout e estilos globais do Next.js
src/features/            módulos por domínio de negócio (futuros)
src/lib/offline/         fila de fotos em IndexedDB
src/lib/storage/         abstração de object storage
src/server/db/           cliente Prisma exclusivo do servidor
src/server/storage/      adaptadores local e S3 compatível
src/server/uploads/      validação e orquestração de upload
AGENTS.md                regras de desenvolvimento do projeto
```

## Modelo de dados

`Wedding` é o limite de isolamento: todo convidado, missão, envio, foto e
lançamento de pontos referencia o casamento. Relações compostas impedem que um
envio una convidado e missão de eventos diferentes. `Submission` representa o
envio; `Photo` armazena somente metadados e a chave privada do object storage;
`ScoreEntry` é o registro auditável de pontos. O campo `Guest.score` é um cache
para ranking, que deverá ser atualizado pelo servidor em transação com o
lançamento de pontos.

`prisma/seed.ts` cria dois eventos isolados: `ana-e-joao` e
`beatriz-e-rafael`, cada um com convidados, missões, envios, fotos de referência
e pontos próprios. Esses identificadores legíveis existem somente para
demonstração; novos eventos recebem um identificador público opaco. O seed
substitui apenas os dois eventos fictícios.

## API inicial

As rotas abaixo são usadas pela interface e mantêm o escopo do casamento no
servidor. O campo de pontos do cliente não é recebido por nenhuma rota.

- `GET /api/events/[slug-ou-token]`: localiza o casamento.
- `POST /api/events/[slug-ou-token]/guests`: cria ou identifica um convidado.
- `GET /api/events/[slug-ou-token]/missions?guestToken=...`: lista as missões do convidado.
- `POST /api/events/[slug-ou-token]/missions/[missionId]/submissions`: recebe
  `multipart/form-data` com `photo`, `guestToken` e `uploadId`; armazena a foto
  e só então registra a pontuação.
- `DELETE /api/events/[slug-ou-token]/missions/[missionId]/submissions/[submissionId]`:
  remove um envio do próprio convidado e recalcula seu placar.
- `GET /api/events/[slug-ou-token]/guests/me?guestToken=...`: consulta o placar.
- `GET /api/events/[slug-ou-token]/ranking`: consulta o ranking isolado do evento.

`npm test` cria eventos temporários no PostgreSQL e verifica isolamento por
casamento, identificação de convidado, pontuação única, falha de storage,
reenvio idempotente e validação de arquivo.
