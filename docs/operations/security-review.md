# Relatório de revisão de segurança

**Data:** 07/09/2026

## Verificações e correções

- **Rotas administrativas:** páginas e Route Handlers exigem sessão; a área do proprietário exige `PLATFORM_ADMIN`. Os serviços repetem a autorização e filtram por organização/casamento.
- **Autenticação:** senhas são armazenadas com `scrypt`, salt aleatório e comparação em tempo constante. Login possui limite por IP/credencial e rejeita entradas excessivamente grandes.
- **Sessões:** o navegador recebe somente token opaco; o banco guarda SHA-256, com expiração, revogação e cookie `HttpOnly`. Trocar uma senha invalida as demais sessões; o provisionamento do administrador invalida todas as sessões daquela conta.
- **Cookies e CSRF:** cookies usam `SameSite=Lax`, `Secure` em produção e `HttpOnly`. Operações administrativas mutáveis exigem `Origin` autorizado ou `Referer` da mesma origem.
- **Uploads:** MIME permitido é conferido junto com assinatura/magic bytes. Fotos aceitam JPEG, PNG, WebP e HEIC/HEIF, com limite configurável e teto absoluto de 25 MB; avatares aceitam JPEG/PNG/WebP até 5 MB. O nome original é sanitizado e nunca define o caminho de armazenamento.
- **Fotos privadas:** o Object Storage de produção é S3-compatible e privado. Rotas administrativas verificam sessão e organização; respostas de imagens usam `private, no-store` e MIME permitido.
- **SQL Injection:** consultas de aplicação usam Prisma; não há `queryRawUnsafe` ou SQL dinâmico em `src`.
- **XSS:** não há `dangerouslySetInnerHTML`; textos são renderizados pelo React. Personalizações visuais validam cores, fontes, URLs HTTPS e tamanho dos textos antes de virar CSS.
- **Exposição de dados:** respostas públicas deixaram de retornar IDs internos de organização, casamento e convidado. O token público do casamento usa 128 bits aleatórios; novos tokens de convidado usam 256 bits aleatórios.
- **Isolamento:** consultas públicas e administrativas combinam organização + casamento + convidado/missão quando aplicável. Fotos, missões, ranking e envios não atravessam casamentos.
- **Expiração e revogação:** páginas públicas são `force-dynamic` e validam status, início, fim e revogação em cada requisição. O painel administrativo continua acessando dados após a expiração.
- **Ambiente:** produção exige `APP_URL` HTTPS, Object Storage S3-compatible e não aceita armazenamento local. Segredos ficam no ambiente/secret manager; `.env.example` contém somente placeholders. Erros internos não são enviados ao cliente em produção.
- **Observabilidade:** Sentry foi integrado para erros, requisições e navegações. O envio de PII fica desativado e um filtro remove credenciais, tokens, query strings e dados de fotos antes do envio.
- **Headers:** foram mantidos/fortalecidos `CSP`, HSTS em produção, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- **Rate limiting:** há limites para login, cadastro, registro de convidados, upload, edição de perfil e exclusão de envios. O proxy só é confiável quando `TRUST_PROXY=true`.

## Validação

- `npm run typecheck` — aprovado
- `npm run lint` — aprovado
- `npm test` — 33 testes aprovados
- `npm run build` com configuração equivalente à produção — aprovado
- `npx prisma migrate status` — migrations atualizadas

## Requisitos operacionais antes do lançamento

- Manter o bucket de fotos privado e liberar somente as rotas autorizadas da aplicação.
- Configurar TLS, `APP_URL`, `ALLOWED_ORIGINS` e `TRUST_PROXY` de acordo com o proxy real.
- Em múltiplas instâncias, complementar o rate limiting em WAF, gateway ou Redis; o limite local da aplicação é por processo.
- Monitorar tentativas de login, uploads rejeitados, respostas 429 e erros 5xx sem registrar senhas, tokens ou URLs com credenciais.
