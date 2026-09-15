export default function AdminLoading() {
  return (
    <main className="route-loading-screen" aria-busy="true" aria-live="polite">
      <span className="route-loading-mark" aria-hidden="true">✦</span>
      <h1>Preparando seu painel</h1>
      <p>Estamos organizando seus casamentos, fotos e créditos.</p>
    </main>
  );
}
