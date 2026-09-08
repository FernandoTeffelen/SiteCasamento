# Relatório de testes de produção

Data da rodada: 07/09/2026  
Ambiente: aplicação local com PostgreSQL, execução equivalente a produção e navegador Chrome em telas de desktop. O comportamento específico do Safari/iPhone está indicado como validação manual.

## Resultado geral

Os fluxos de negócio principais foram executados com sucesso. Foram aprovados 33 testes automatizados existentes e 23 verificações no smoke test de produção.

Comandos executados:

```text
npm test                         33 testes aprovados
npm run test:production-smoke   SMOKE_OK 23 verificações
npm run typecheck                aprovado
npm run lint                     aprovado
npm run build                    aprovado
```

O smoke test cria um cliente, plano, casamentos, convidado e foto temporários com prefixo `smoke-` e remove o cliente ao terminar. Nenhum reset do banco foi executado.

## Fluxos verificados

| Fluxo | Resultado | Cobertura |
| --- | --- | --- |
| Health check | Aprovado | Aplicação e conexão básica ao banco, sem expor dados internos |
| Cadastro e login de cliente | Aprovado | API e sessão com cookies |
| Login do administrador | Aprovado | API e navegação manual até o painel |
| Criação de cliente | Aprovado | Cadastro aparece no fluxo administrativo |
| Liberação manual de plano | Aprovado | Plano ativo de 1 mês e 2 créditos/mês |
| Geração e consumo de créditos | Aprovado | Créditos liberados, dois casamentos consumindo dois créditos e terceiro bloqueado |
| Criação/ativação de casamento | Aprovado | Ativação consome crédito |
| QR Code/link privado | Aprovado | `publicId` opaco; ID interno não aparece na resposta pública |
| Expiração e revogação | Aprovado | Acesso público retorna bloqueio após expiração e revogação |
| Perfil do convidado | Aprovado | Cadastro e atualização do perfil |
| Missões | Aprovado | Lista de missões disponível com token do convidado |
| Captura e upload | Parcialmente aprovado | Endpoint validado com JPEG válido; câmera física depende de dispositivo |
| Perda de conexão e reenvio | Parcialmente aprovado | Falha/retry e idempotência cobertos por testes; modo offline real depende de dispositivo |
| Prevenção de duplicidade | Aprovado | Mesmo `uploadId` não duplica foto/pontuação |
| Encerramento do casamento | Aprovado | Revogação encerra o acesso público preservando dados |
| Acesso às fotos/Book | Aprovado | Galeria administrativa paginada e foto ampliada por endpoint |
| Isolamento entre casamentos | Aprovado | Testes de autorização e tokens inválidos/expirados/revogados |

## Correções feitas durante a rodada

- O smoke test foi alinhado ao contrato real das rotas: cadastro retorna `200`, e a validação de crédito usa os dois créditos antes de verificar o bloqueio do terceiro casamento.
- A inicialização do Sentry ficou idempotente no servidor e no cliente, evitando listeners duplicados durante reinícios do modo dev.
- Foi removido o endpoint/página de exemplo do wizard do Sentry, que criava uma rota pública de erro e incluía configuração de demonstração desnecessária.
- A configuração de produção foi validada com armazenamento S3-compatible simulado, cookies seguros, origem HTTPS e proxy confiável; o build terminou sem erros.
- Não foram encontrados erros de TypeScript, lint ou testes automatizados nesta rodada.

## Validações manuais pendentes

Ainda é necessário validar em um iPhone/iPad físico com Safari, preferencialmente em rede móvel e Wi-Fi:

- permissões e captura pela câmera traseira;
- envio de fotos HEIC, JPEG/PNG grandes e comportamento próximo do limite configurado;
- colocar o aparelho em modo avião durante o upload, fechar/reabrir a página e confirmar a fila IndexedDB e o reenvio;
- escanear o QR Code físico e abrir o mesmo casamento em mais de um aparelho;
- telas de 320, 375, 390 e 414 px, safe areas, teclado e rotação;
- sair e entrar em contas de convidados diferentes no mesmo aparelho;
- confirmação ponta a ponta com PostgreSQL gerenciado, Object Storage real, HTTPS, proxy e cookies `Secure`;
- recebimento de evento real no Sentry e publicação/consulta de source maps no ambiente de produção.

Também vale repetir o fluxo de encerramento pela interface do painel, verificando visualmente a confirmação e a permanência das fotos no Book após o link público ser revogado.

## Como repetir

Com o banco e o servidor disponíveis:

```powershell
$env:PLATFORM_ADMIN_EMAIL = "admin-do-ambiente@example.com"
$env:PLATFORM_ADMIN_PASSWORD = "senha-do-ambiente"
npm run test:production-smoke
```

É possível apontar para outro servidor com `SMOKE_BASE_URL`. Use uma base de teste: apesar da limpeza automática dos dados criados pelo script, o comando autentica e usa um administrador real do ambiente informado.
