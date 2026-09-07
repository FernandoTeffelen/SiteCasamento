"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Excluir a conta de ${customerName}? Esta ação remove o cliente e os dados da organização dele.`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/platform/customers/${encodeURIComponent(customerId)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        window.alert(body.error?.message ?? "Não foi possível excluir o cliente.");
        return;
      }
      router.push("/gestao-interna/clientes");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return <button type="button" className="platform-delete-button" onClick={() => void handleDelete()} disabled={isDeleting}>{isDeleting ? "Excluindo..." : "Excluir"}</button>;
}
