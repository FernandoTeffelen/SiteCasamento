export default function CommercialLoading() {
  return (
    <main className="route-loading-screen" aria-busy="true" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <h1>Carregando opções</h1>
      <p>Estamos preparando os planos e créditos disponíveis.</p>
    </main>
  );
}
