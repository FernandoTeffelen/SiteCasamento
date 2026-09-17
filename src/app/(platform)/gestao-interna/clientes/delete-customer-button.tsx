"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Excluir a conta de ${customerName}? Esta ação remove o cliente e os dados da organização dele.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/platform/customers/${encodeURIComponent(customerId)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Não foi possível excluir o cliente.");
        return;
      }
      router.push("/gestao-interna/clientes");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="platform-status-action">
      <button type="button" className="platform-delete-button" onClick={() => void handleDelete()} disabled={isDeleting}>{isDeleting ? "Excluindo..." : "Excluir"}</button>
      {error ? <p className="platform-inline-error" role="alert">{error}</p> : null}
    </div>
  );
}
