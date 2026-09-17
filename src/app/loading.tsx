export default function RootLoading() {
  return (
    <main className="route-loading-screen" aria-busy="true" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <h1>Carregando</h1>
      <p>Estamos preparando a próxima tela.</p>
    </main>
  );
}
