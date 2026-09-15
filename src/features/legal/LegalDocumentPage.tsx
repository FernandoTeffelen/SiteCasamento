import Link from "next/link";
import type { LegalDocumentDefinition } from "@/lib/legal/legal-documents";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function LegalDocumentPage({ document }: { document: LegalDocumentDefinition }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-brand">SiteCasamento</Link>
          <nav aria-label="Documentos jurídicos">
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos-de-uso">Termos de Uso</Link>
            <Link href="/termo-comercial">Termo Comercial</Link>
          </nav>
        </div>
      </header>

      <main className="legal-content">
        <Link href="/" className="legal-back">← Voltar ao início</Link>
        <p className="legal-kicker">DOCUMENTO PÚBLICO · MINUTA</p>
        <h1>{document.title}</h1>
        <p className="legal-summary">{document.summary}</p>
        <dl className="legal-version">
          <div><dt>Versão</dt><dd>{document.version}</dd></div>
          <div><dt>Vigência inicial proposta</dt><dd>{formatDate(document.effectiveDate)}</dd></div>
        </dl>
        <aside className="legal-warning" role="note">
          <strong>Aviso importante</strong>
          <p>Esta é uma minuta técnica inicial. Ela não representa parecer jurídico nem afirma que o projeto está juridicamente validado. Revise o conteúdo, a operação real e os campos pendentes com advogado brasileiro antes do lançamento.</p>
        </aside>

        <article>
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ))}
        </article>

        <aside className="legal-review-list">
          <h2>Pendências obrigatórias antes do lançamento</h2>
          <ul>
            <li>Identificar a pessoa jurídica, CNPJ, endereço e canais oficiais.</li>
            <li>Validar bases legais, papéis de controlador e operador e prazos de retenção.</li>
            <li>Definir cancelamento, reembolso, renovação, suporte e emissão fiscal.</li>
            <li>Revisar fornecedores, transferências internacionais e tratamento de fotos de menores.</li>
          </ul>
        </aside>
      </main>

      <footer className="legal-footer">
        <p>SiteCasamento · Documento preliminar para revisão jurídica</p>
        <div><Link href="/privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos</Link><Link href="/termo-comercial">Comercial</Link></div>
      </footer>
    </div>
  );
}
