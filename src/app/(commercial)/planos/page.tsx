import Link from "next/link";

export default function PlansPage() {
  return (
    <main className="commercial-page">
      <section>
        <p>Planos e créditos</p>
        <h1>Escolha a forma de publicar seus casamentos.</h1>
        <ul>
          <li>Starter: 3 créditos por mês</li>
          <li>Pro: 6 créditos por mês</li>
          <li>Agency: 10 créditos por mês</li>
        </ul>
        <p>Há opções mensal, trimestral, semestral e anual, além de créditos avulsos. O pagamento será conectado nesta página futuramente.</p>
        <Link href="/">Voltar</Link>
      </section>
    </main>
  );
}
