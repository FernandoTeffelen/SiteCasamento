import { LEGAL_DOCUMENT_VERSION, LEGAL_EFFECTIVE_DATE } from "./legal-versions";

export type LegalDocumentTypeValue = "PRIVACY_POLICY" | "TERMS_OF_USE" | "COMMERCIAL_TERMS";

export type LegalDocumentSection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type LegalDocumentDefinition = {
  type: LegalDocumentTypeValue;
  version: string;
  title: string;
  shortTitle: string;
  publicPath: string;
  effectiveDate: string;
  summary: string;
  sections: readonly LegalDocumentSection[];
};

export const legalDocuments = {
  privacyPolicy: {
    type: "PRIVACY_POLICY",
    version: LEGAL_DOCUMENT_VERSION,
    title: "Política de Privacidade",
    shortTitle: "Política de Privacidade",
    publicPath: "/privacidade",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Explica, em linguagem inicial, como dados de contas, convidados e fotos podem ser tratados no SiteCasamento.",
    sections: [
      {
        title: "1. Sobre esta versão",
        paragraphs: [
          "Esta é uma minuta inicial, preparada para revisão por advogado brasileiro antes do lançamento comercial. A identificação completa da empresa responsável, seus canais oficiais e as definições finais sobre os agentes de tratamento ainda devem ser preenchidas.",
          "O SiteCasamento oferece uma plataforma para casais e cerimonialistas criarem experiências fotográficas privadas em eventos e para convidados enviarem fotos por meio de um endereço ou QR Code do casamento.",
        ],
      },
      {
        title: "2. Quem trata os dados",
        paragraphs: [
          "Para dados de cadastro, segurança, contratação e relacionamento comercial, a empresa responsável pelo SiteCasamento tende a atuar como controladora. A qualificação empresarial e o canal do encarregado ou canal de privacidade deverão constar aqui antes da publicação definitiva.",
          "Nos dados e fotos de convidados tratados conforme as escolhas do casal ou da cerimonialista, esses organizadores podem atuar como controladores e o SiteCasamento como operador. Essa divisão é preliminar e precisa ser confirmada juridicamente e nos contratos de tratamento de dados.",
        ],
      },
      {
        title: "3. Dados que podem ser tratados",
        items: [
          "Dados de conta e contato, como nome, e-mail, tipo de cliente e credenciais protegidas por hash.",
          "Dados do evento, como nomes do casal, data, configurações, missões e participantes.",
          "Dados do convidado, como nome, e-mail, perfil opcional, fotos enviadas e pontuação.",
          "Dados comerciais, como plano escolhido, créditos, histórico de contratação e situação de pagamento quando essa funcionalidade for disponibilizada.",
          "Dados técnicos e de segurança, como data e hora, identificadores de sessão, navegador, registros de erro e endereço IP quando fornecido de forma confiável pela infraestrutura.",
          "Arquivos guardados localmente no aparelho, inclusive fotos pendentes em IndexedDB, até a confirmação do envio ou exclusão pelo próprio convidado.",
        ],
      },
      {
        title: "4. Finalidades e bases legais preliminares",
        items: [
          "Executar o cadastro, disponibilizar o evento, receber fotos, calcular pontuação e prestar o serviço solicitado.",
          "Adotar medidas pré-contratuais e executar contratos com clientes pagantes.",
          "Proteger contas, prevenir fraude, investigar incidentes e manter registros de auditoria, conforme interesse legítimo avaliado e obrigações legais aplicáveis.",
          "Cumprir obrigações legais ou regulatórias e exercer direitos em processos.",
          "Solicitar consentimento específico quando uma finalidade realmente depender dele, sem agrupar autorizações opcionais ao uso essencial do serviço.",
        ],
        paragraphs: [
          "As bases legais definitivas dependem da operação real e deverão ser validadas antes do lançamento. A simples ciência desta Política não substitui consentimentos específicos quando eles forem exigidos.",
        ],
      },
      {
        title: "5. Compartilhamento e transferências",
        paragraphs: [
          "Os dados podem ser compartilhados, no limite necessário, com fornecedores de hospedagem, banco de dados, armazenamento de arquivos, monitoramento, comunicação e pagamento; com organizadores do evento; ou com autoridades quando houver obrigação legal. O SiteCasamento não deve vender dados pessoais.",
          "Alguns fornecedores podem processar dados fora do Brasil. Antes do lançamento, deverão ser identificados os países, fornecedores, garantias contratuais e mecanismos adequados de transferência internacional.",
        ],
      },
      {
        title: "6. Retenção, segurança e incidentes",
        paragraphs: [
          "Os dados serão mantidos pelo período necessário às finalidades informadas, à vigência do evento ou contrato e aos prazos legais de defesa e guarda. A tabela definitiva de retenção, inclusive para fotos, contas inativas, backups e aceites, ainda deve ser aprovada.",
          "São adotadas medidas técnicas compatíveis com a fase do produto, como senhas com hash, sessões opacas, validação de arquivos, controle de acesso e armazenamento privado. Nenhum sistema é totalmente imune a incidentes; o procedimento formal de resposta e comunicação ainda deve ser documentado.",
        ],
      },
      {
        title: "7. Direitos dos titulares",
        paragraphs: [
          "Nos limites da legislação, o titular pode pedir confirmação e acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamentos, revisão de decisões automatizadas, oposição e informações sobre consentimento.",
          "O canal oficial para solicitações de privacidade e o prazo operacional de atendimento devem ser definidos antes do lançamento. Dependendo do dado, a solicitação poderá ser encaminhada ao casal ou cerimonialista responsável pelo evento.",
        ],
      },
      {
        title: "8. Crianças e adolescentes",
        paragraphs: [
          "Eventos podem incluir menores de idade. O fluxo definitivo deve prever orientação aos responsáveis, tratamento no melhor interesse e, quando aplicável, autorização específica do responsável legal. Esta minuta não substitui a definição de uma política operacional para fotos de menores.",
        ],
      },
      {
        title: "9. Armazenamento no aparelho e atualizações",
        paragraphs: [
          "O navegador pode usar armazenamento local e IndexedDB para manter a sessão do convidado e preservar fotos durante falhas de rede. A foto local só deve ser descartada após confirmação do envio ou ação do usuário.",
          "Alterações relevantes desta Política deverão gerar uma nova versão, com data de vigência e novo registro de ciência ou aceite quando apropriado.",
        ],
      },
    ],
  },
  termsOfUse: {
    type: "TERMS_OF_USE",
    version: LEGAL_DOCUMENT_VERSION,
    title: "Termos de Uso",
    shortTitle: "Termos de Uso",
    publicPath: "/termos-de-uso",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Regras iniciais de uso da plataforma por clientes, administradores e convidados.",
    sections: [
      {
        title: "1. Natureza desta minuta",
        paragraphs: [
          "Estes Termos são uma versão inicial para revisão jurídica. A identificação da empresa responsável pelo SiteCasamento, endereço, CNPJ e canais oficiais deverá ser incluída antes do lançamento comercial.",
          "Ao marcar a caixa correspondente, a pessoa declara que leu e concorda com a versão indicada. A Política de Privacidade complementa estes Termos quanto ao tratamento de dados pessoais.",
        ],
      },
      {
        title: "2. Funcionamento do serviço",
        paragraphs: [
          "O SiteCasamento permite criar e administrar experiências fotográficas em casamentos, publicar missões, identificar convidados, receber fotos e exibir pontuações. Funcionalidades, limites e disponibilidade podem variar conforme a oferta contratada.",
          "A participação do convidado ocorre pelo navegador e pode usar armazenamento local para preservar fotos durante falhas de conexão. O envio somente é concluído após confirmação do servidor.",
        ],
      },
      {
        title: "3. Cadastro e segurança",
        items: [
          "O usuário deve fornecer informações verdadeiras, manter seus dados atualizados e proteger suas credenciais.",
          "É proibido ceder acesso de administrador a pessoas não autorizadas ou tentar contornar controles de acesso, limites ou segurança.",
          "O responsável pela conta deve comunicar suspeitas de uso indevido pelos canais oficiais a serem publicados.",
        ],
      },
      {
        title: "4. Fotos e outros conteúdos",
        paragraphs: [
          "Quem envia uma foto declara, conforme seu conhecimento, que tem legitimidade para compartilhá-la no contexto do evento e que o conteúdo não viola direitos de terceiros. O envio concede apenas a autorização necessária para armazenar, processar, moderar e disponibilizar a foto dentro das funcionalidades do evento.",
          "Direitos autorais e de imagem permanecem com seus titulares. Organizadores devem orientar convidados e atender pedidos legítimos de remoção. Conteúdo ilícito, abusivo, discriminatório, sexualmente explícito, violento ou que viole privacidade pode ser rejeitado ou removido.",
        ],
      },
      {
        title: "5. Responsabilidades do organizador",
        items: [
          "Configurar corretamente o evento, definir quem poderá acessar e manter o QR Code ou endereço sob controle adequado.",
          "Ter fundamento para tratar dados e imagens dos participantes, inclusive de menores, e prestar as informações exigidas.",
          "Não usar fotos, cadastros ou informações obtidas pela plataforma para finalidades incompatíveis ou não informadas.",
        ],
      },
      {
        title: "6. Disponibilidade e mudanças",
        paragraphs: [
          "O serviço pode sofrer manutenções, indisponibilidades de rede ou falhas de terceiros. Serão empregados esforços razoáveis de continuidade, sem promessa de funcionamento ininterrupto nesta minuta. Condições de suporte e níveis de serviço, se oferecidos, devem constar da proposta comercial.",
          "Mudanças materiais nos Termos deverão ser publicadas em nova versão. O uso continuado não substituirá um novo aceite quando a natureza da alteração exigir manifestação expressa.",
        ],
      },
      {
        title: "7. Suspensão e encerramento",
        paragraphs: [
          "Contas ou conteúdos podem ser suspensos para proteger usuários, cumprir a lei, investigar fraude, conter riscos de segurança ou responder a violação destes Termos, com comunicação e possibilidade de esclarecimento quando cabível.",
          "Regras de cancelamento, exportação e eliminação de dados de clientes pagantes serão complementadas pelo Termo Comercial e pela Política de Privacidade.",
        ],
      },
      {
        title: "8. Lei aplicável e direitos do consumidor",
        paragraphs: [
          "Aplicam-se as leis brasileiras. Nada nestes Termos pretende afastar direitos inderrogáveis previstos no Código de Defesa do Consumidor ou outras normas aplicáveis. A cláusula definitiva de solução de conflitos e foro deve ser revisada conforme o perfil real dos clientes.",
        ],
      },
    ],
  },
  commercialTerms: {
    type: "COMMERCIAL_TERMS",
    version: LEGAL_DOCUMENT_VERSION,
    title: "Termo Comercial para Cerimonialistas e Casais",
    shortTitle: "Termo Comercial",
    publicPath: "/termo-comercial",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Condições comerciais iniciais para planos, créditos e prestação do serviço.",
    sections: [
      {
        title: "1. Minuta e partes",
        paragraphs: [
          "Este documento é uma minuta inicial, ainda não validada juridicamente. Antes de receber pagamentos, deverão ser incluídos a razão social, CNPJ, endereço e canais oficiais da fornecedora, além da identificação do cliente no checkout ou instrumento de contratação.",
          "O cliente pode ser uma cerimonialista, assessoria, empresa ou casal que contrata o SiteCasamento para um ou mais eventos.",
        ],
      },
      {
        title: "2. Objeto e ordem de prevalência",
        paragraphs: [
          "A contratação dá direito de acesso às funcionalidades, créditos e período exibidos no resumo da oferta aceita. Em caso de divergência, prevalecem o resumo registrado no checkout, este Termo Comercial, os Termos de Uso e a Política de Privacidade, nessa ordem, respeitada a legislação aplicável.",
        ],
      },
      {
        title: "3. Planos, créditos e ativação",
        items: [
          "Cada crédito corresponde à ativação de um casamento, conforme a oferta vigente.",
          "Planos recorrentes informam duração do ciclo, créditos disponibilizados, preço total, equivalente mensal e eventuais descontos.",
          "Créditos avulsos não criam mensalidade e seguem quantidade, preço e validade informados na oferta. A validade comercial ainda precisa ser definida.",
          "A ativação depende da confirmação do pagamento ou da liberação manual autorizada. O aceite isolado deste Termo não ativa plano, não concede créditos e não gera cobrança.",
        ],
      },
      {
        title: "4. Preços, pagamento e renovação",
        paragraphs: [
          "Os valores válidos são os mostrados no resumo do checkout em reais, incluindo descontos e período. Tributos aplicáveis serão tratados conforme a documentação fiscal da operação.",
          "O pagamento online ainda não está integrado nesta versão do produto. Antes da integração, deverão ser definidos meios de pagamento, vencimento, emissão fiscal, inadimplência, estorno, reajuste e regras de renovação automática. Nenhuma renovação automática deve ser presumida sem informação clara e autorização adequada.",
        ],
      },
      {
        title: "5. Cancelamento e arrependimento",
        paragraphs: [
          "As regras definitivas de cancelamento, reembolso proporcional, créditos utilizados e encerramento de eventos precisam ser definidas antes da cobrança. Quando a contratação estiver sujeita às normas de consumo e ocorrer fora do estabelecimento comercial, será respeitado o direito de arrependimento aplicável.",
        ],
      },
      {
        title: "6. Obrigações do cliente",
        items: [
          "Usar o serviço somente para eventos legítimos e dentro dos limites contratados.",
          "Orientar convidados sobre o uso de imagens e dados, cuidar do acesso ao evento e responder pelas configurações e conteúdos que publicar.",
          "Não revender, copiar, explorar indevidamente ou tentar contornar créditos e controles técnicos.",
          "Manter dados cadastrais e de cobrança atualizados e cooperar na prevenção de fraude e incidentes.",
        ],
      },
      {
        title: "7. Dados pessoais e propriedade intelectual",
        paragraphs: [
          "O tratamento de dados segue a Política de Privacidade e, quando o SiteCasamento operar dados em nome do cliente, deverá ser complementado por cláusulas de operador, instruções documentadas, segurança, suboperadores, incidentes e devolução ou eliminação de dados.",
          "A contratação não transfere a propriedade da plataforma, marcas ou tecnologia. O cliente mantém os direitos que possuir sobre suas identidades visuais e conteúdos, concedendo as autorizações estritamente necessárias à prestação do serviço.",
        ],
      },
      {
        title: "8. Vigência, suporte e responsabilidade",
        paragraphs: [
          "A vigência acompanha o período indicado na oferta. Canais, horários, prazo de suporte, disponibilidade, cópias de segurança e limites de responsabilidade devem ser definidos na versão final de acordo com o plano e com normas imperativas.",
          "Nenhuma disposição desta minuta exclui responsabilidade que não possa ser afastada por lei. Casos fortuitos, força maior e falhas de fornecedores serão tratados conforme a legislação e a alocação de riscos aprovada na revisão jurídica.",
        ],
      },
    ],
  },
} as const satisfies Record<string, LegalDocumentDefinition>;

export const legalDocumentList = Object.values(legalDocuments);

export function getLegalDocument(type: LegalDocumentTypeValue) {
  const document = legalDocumentList.find((item) => item.type === type);
  if (!document) throw new Error(`Documento jurídico não configurado: ${type}`);
  return document;
}
