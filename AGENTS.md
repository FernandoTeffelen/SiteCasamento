# Jogo de Fotos para Casamentos

## Objetivo

Web app mobile-first para convidados participarem de desafios fotográficos em
casamentos por meio de um QR Code, sem instalação obrigatória.

## Arquitetura

- Next.js App Router com TypeScript no frontend e nas rotas de servidor.
- PostgreSQL como banco de dados; Prisma é a única camada de acesso ao banco.
- `src/features` organiza domínios; `src/server` contém código exclusivo do
  servidor; `src/lib` contém contratos e utilitários compartilhados.
- Fotos usam a abstração `ObjectStorage`; não acoplar regras de domínio a R2,
  S3 ou ao disco local.
- A fila offline ficará em IndexedDB no navegador. O servidor nunca deve
  depender de Background Sync para concluir uploads.

## Prioridades e regras

1. Confiabilidade, Safari/iPhone, experiência mobile e rede instável, nessa ordem.
2. Projetar primeiro para telas pequenas, toque com uma mão, áreas clicáveis
   grandes e `safe-area-inset`; desktop é adaptação posterior.
3. Para captura inicial, preferir `input type="file" accept="image/*"
   capture="environment"`; não introduzir uma câmera WebRTC sem teste real em iPhone.
4. Uma foto local só pode ser descartada após confirmação de upload. Manter
   estados `pending`, `uploading`, `uploaded` e `failed` na fila IndexedDB.
5. O cliente não decide pontuação, permissões, status final de envio ou acesso
   ao evento. Validar MIME, tamanho e conteúdo no servidor antes de persistir.
6. QR Codes usam `Wedding.publicId`, nunca o identificador interno do banco.
7. Não implementar telas, upload, service worker ou regras de jogo sem uma
   etapa explícita e uma verificação proporcional.

## Convenções

- TypeScript estrito; usar imports `@/` para itens em `src`.
- Nomes em inglês para código e banco; textos da interface em português (Brasil).
- Componentes React em PascalCase; arquivos e diretórios em minúsculas/kebab-case,
  salvo componentes e convenções do Next.js.
- Mudanças no schema exigem migration revisada; não executar reset de banco sem
  autorização explícita.
- Variáveis secretas permanecem em `.env`; manter somente exemplos seguros em
  `.env.example`.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
