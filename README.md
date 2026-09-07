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
- Liberação manual de acesso pelo proprietário após pagamento via PIX.
- Área exclusiva do proprietário em `/gestao-interna`, protegida no backend por usuário com `PLATFORM_ADMIN`.
- Exclusão de casamento protegida pela senha da cerimonialista e com confirmação em modal.

## Rotas principais

| Área | Rotas | Acesso |
| --- | --- | --- |
| Site comercial | `/`, `/planos` | Público |
| Conta do cliente | `/app/login`, `/app/cadastro`, `/app`, `/app/configuracoes` | Cerimonialista ou casal |
| Casamento | `/w/{token}`, `/w/{token}/jogo`, `/w/{token}/fotos` | Convidado com token válido |
| Gestão do proprietário | `/gestao-interna/login`, `/gestao-interna`, `/gestao-interna/clientes` | Somente administrador da plataforma |

As rotas `/api` são Route Handlers do Next.js. A área do proprietário não é exibida no painel comum e todas as operações administrativas são verificadas no backend.

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

## Contas de demonstração

O seed cria a conta demo da cerimonialista:

```text
E-mail: cerimonial@demo.test
Senha:  cerimonial1234
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

O link público deixa de funcionar ao expirar ou ser revogado, mas o casamento, convidados e fotos continuam disponíveis para a cerimonialista autorizada.

## Variáveis de ambiente

As variáveis obrigatórias e seus exemplos estão em `.env.example`:

- `DATABASE_URL`: conexão PostgreSQL.
- `STORAGE_DRIVER` e `LOCAL_STORAGE_PATH`: armazenamento local de desenvolvimento.
- `MAX_UPLOAD_BYTES`: limite de upload.
- `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` e `PLATFORM_ADMIN_NAME`: provisionamento do proprietário.
- `S3_*`: armazenamento compatível com S3/R2 em produção.

O armazenamento local não é indicado para ambientes serverless. Em produção, use PostgreSQL gerenciado e Object Storage privado.

## Comandos de qualidade

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run db:check
```

Os testes cobrem autenticação, isolamento entre organizações e casamentos, tokens inválidos/expirados/revogados, créditos, uploads, galeria e exclusão protegida por senha.

## Estrutura resumida

```text
src/app/              páginas, layouts e APIs do Next.js
src/features/         domínios de convidados, jogo e casamento
src/server/           Prisma, autenticação, billing e regras de negócio
src/lib/              contratos e utilitários compartilhados
prisma/schema.prisma  modelo PostgreSQL
prisma/migrations/    histórico do schema
tests/                testes de integração
```

## Pendências conhecidas

- O gateway de pagamento ainda não está conectado; a liberação via PIX é manual.
- A geração de álbum físico e edição avançada da galeria ainda não fazem parte do produto.
- O serviço de tarefas para liberar créditos mensais deve ser executado por um scheduler/worker em produção.
