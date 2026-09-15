import Link from "next/link";
import styles from "./home.module.css";
import { PublicAccountActions } from "@/features/account/PublicAccountActions";
import { getAdminDashboardAccess, getCurrentAdminSession } from "@/server/auth/admin-auth.service";

export const metadata = {
  title: "SiteCasamento | Cada convidado, um novo olhar",
  description: "Missões fotográficas para casamentos, acesso por QR Code e fotos reunidas em um só lugar. Transforme os convidados em parte das lembranças.",
};

const steps = [
  { title: "Prepare o grande dia", text: "Cadastre o casamento, personalize a experiência e escolha as missões para os convidados." },
  { title: "Espalhe o convite", text: "Coloque o QR Code nas mesas ou compartilhe o link. Cada convidado entra pelo próprio celular." },
  { title: "Colecione outros olhares", text: "Acompanhe as fotos e a participação pelo painel. Cada missão revela um pedacinho da festa." },
];

const questions = [
  { title: "Os convidados precisam instalar um aplicativo?", text: "Não. Basta abrir o link ou apontar a câmera para o QR Code do casamento e participar pelo navegador do celular." },
  { title: "E se a internet da festa oscilar?", text: "Depois de entrar e carregar as missões, as fotos confirmadas ficam na fila deste aparelho antes do envio. Com a página aberta e a conexão de volta, o envio é tentado novamente. Em Minhas fotos, o convidado pode acompanhar o status e tentar reenviar." },
  { title: "Como os convidados recebem pontos?", text: "Cada missão tem uma pontuação definida. Os pontos são contabilizados após a confirmação do envio, conforme as regras do casamento." },
  { title: "Onde encontro as fotos do casamento?", text: "No painel, a galeria reúne as fotos enviadas e permite filtrar por convidado e missão. Os convidados também podem acompanhar seus registros em Minhas fotos." },
];

function CameraMark() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6 9.5 3.5h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12.5" r="4"/></svg>;
}

export default async function HomePage() {
  const session = await getCurrentAdminSession();
  const access = session ? await getAdminDashboardAccess(session.id) : null;

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#conteudo">Pular para o conteúdo</a>
      <header className={styles.header}>
        <div className={styles.navbar}>
          <Link href="/" className={styles.brand} aria-label="SiteCasamento — início"><span className={styles.brandMark}><CameraMark /></span>SiteCasamento<span className={styles.brandDot}>.</span></Link>
          <nav className={styles.navigation} aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a><a href="#recursos">A experiência</a><Link href="/planos">Planos</Link>
          </nav>
          <PublicAccountActions user={session} access={access} loginClassName={styles.login} />
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span aria-hidden="true">✳</span> A festa passa. Os olhares ficam.</p>
            <h1 id="hero-title">Um grande dia.<br />Mil jeitos de<br /><em>lembrar.</em></h1>
            <p className={styles.introduction}>Transforme seus convidados em colecionadores de momentos. Missões fotográficas, um QR Code e as lembranças que só eles poderiam registrar.</p>
            <div className={styles.actions}>
              <Link href="/planos" className={styles.primary}>Conhecer os planos <span aria-hidden="true">↗</span></Link>
              <a href="#como-funciona" className={styles.secondary}>Veja como funciona <span aria-hidden="true">↓</span></a>
            </div>
            <p className={styles.heroNote}><span aria-hidden="true">✓</span> Sem baixar aplicativo. Mais tempo para celebrar.</p>
          </div>
          <figure className={styles.preview} aria-label="Exemplo ilustrativo das missões no celular">
            <div className={styles.previewOrbit} aria-hidden="true" />
            <div className={styles.keepsake} aria-hidden="true"><span>um dia para</span><strong>guardar<br />com carinho.</strong><span className={styles.keepsakeHeart}>♡</span><small>memórias feitas por todos</small></div>
            <div className={styles.phone}>
              <div className={styles.phoneTop}><span>9:41</span><span aria-hidden="true">••• ▰</span></div>
              <div className={styles.phoneWedding}><span>JOGO DE FOTOS</span><strong>Clara & Miguel</strong><small>O grande dia, pelo seu olhar</small></div>
              <div className={styles.phoneGreeting}><strong>Olá, Marina <span aria-hidden="true">♡</span></strong><span className={styles.avatar}>M</span></div>
              <div className={styles.phoneScore}><div><small>Seu placar</small><strong>30 <span>pontos</span></strong></div><span>1 de 3<br />missões concluídas</span></div>
              <div className={styles.phoneSection}><strong>Suas missões</strong><span>03</span></div>
              <div className={styles.sampleMission}><div><CameraMark /><span>+20 pontos</span></div><strong>O abraço mais apertado</strong><p>Registre um abraço que merece ficar na memória.</p><span className={styles.sampleAction}>Tirar foto <CameraMark /></span></div>
              <div className={styles.completedMission}><span aria-hidden="true">✓</span><div><strong>Um brinde aos noivos</strong><small>Missão concluída · +30 pontos</small></div></div>
              <div className={styles.phoneHome} aria-hidden="true" />
            </div>
            <div className={styles.floatingNote}><span aria-hidden="true">♡</span><div><strong>Um novo olhar, uma lembrança.</strong><small>A melhor parte é participar.</small></div></div>
            <figcaption>Uma prévia da experiência dos convidados</figcaption>
          </figure>
        </section>
        <div className={styles.promiseStrip} aria-label="Destaques da experiência"><span>Feito para celebrar, <em>simples de usar.</em></span><p><CameraMark /> Acesso por QR Code</p><p><span aria-hidden="true">♡</span> Missões que aproximam</p><p><span aria-hidden="true">▧</span> Fotos em um só lugar</p></div>
        <section id="como-funciona" className={styles.section} aria-labelledby="steps-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>DO CONVITE À LEMBRANÇA</p><h2 id="steps-title">Você prepara.<br /><em>A festa acontece.</em></h2></div><p>Uma experiência fácil para quem organiza.<br />E ainda mais fácil para quem participa.</p></div>
          <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
        </section>
        <section id="recursos" className={styles.experience} aria-labelledby="features-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CADA DETALHE CONTA</p><h2 id="features-title">Todo mundo faz parte<br /><em>dessa história.</em></h2></div><p>Do primeiro registro ao último brinde,<br />um jeito mais leve de guardar o dia.</p></div>
          <div className={styles.features}>
            <article className={styles.featureLead}><CameraMark /><h3>As fotos que você<br />não viu acontecer.</h3><p>A risada na mesa, o encontro de amigos, a pista cheia. Proponha missões que convidem as pessoas a descobrir e registrar esses momentos.</p><span className={styles.featureFoot}>MUITOS OLHARES. UM MESMO DIA.</span></article>
            <article className={styles.feature}><span className={styles.featureSymbol} aria-hidden="true">↗</span><h3>Abriu, participou.</h3><p>O convidado entra pelo QR Code, informa seu nome e e-mail e escolhe uma missão. Tudo pelo navegador.</p></article>
            <article className={styles.feature}><span className={styles.featureSymbol} aria-hidden="true">↻</span><h3>A conexão oscilou?</h3><p>As fotos confirmadas ficam na fila do aparelho antes do envio. O convidado acompanha o status e pode tentar novamente.</p></article>
            <article className={styles.feature}><span className={styles.featureSymbol} aria-hidden="true">▧</span><h3>Seu evento, organizado.</h3><p>Casamentos, missões, participantes e galeria reunidos no painel de quem cuida de cada detalhe.</p></article>
            <article className={styles.feature}><span className={styles.featureSymbol} aria-hidden="true">✧</span><h3>Uma dose de diversão.</h3><p>Missões com pontos e ranking para incentivar os convidados a entrar na brincadeira.</p></article>
          </div>
        </section>
        <section className={styles.faq} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>ANTES DO PRIMEIRO CLIQUE</p><h2 id="faq-title">Pode perguntar.</h2><p>Os detalhes para chegar ao grande dia<br />com tudo combinado.</p></div><div className={styles.questions}>{questions.map(question => <details key={question.title}><summary>{question.title}<span aria-hidden="true">+</span></summary><p>{question.text}</p></details>)}</div></section>
        <section className={styles.finalCta}><span aria-hidden="true">✳</span><p className={styles.eyebrow}>O PRÓXIMO GRANDE DIA</p><h2>Faça da participação<br /><em>uma lembrança.</em></h2><p>Encontre o plano para os eventos que você está preparando.</p><Link href="/planos" className={styles.primary}>Escolher meu plano <span aria-hidden="true">↗</span></Link></section>
      </main>
      <footer className={styles.footer}><div><Link href="/" className={styles.brand}><CameraMark />SiteCasamento.</Link><p>Feito para guardar o que importa.</p></div><nav aria-label="Navegação do rodapé"><Link href="/planos">Planos</Link><Link href={access?.canAccessDashboard ? "/app" : session ? "/planos" : "/app/login"}>Acessar painel</Link><a href="#como-funciona">Como funciona</a><Link href="/privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos</Link><Link href="/termo-comercial">Comercial</Link></nav><small>© {new Date().getFullYear()} SiteCasamento</small></footer>
    </div>
  );
}
