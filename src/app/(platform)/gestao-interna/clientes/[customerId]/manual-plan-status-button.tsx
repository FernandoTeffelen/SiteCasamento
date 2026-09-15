"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ManualPlanStatusButtonProps = {
  customerId: string;
  planId: string;
  action: "confirm-pix" | "cancel";
};

const actionCopy = {
  "confirm-pix": {
    label: "Confirmar PIX e liberar acesso",
    confirmation: "Confirmar o recebimento do PIX? O plano e os créditos previstos serão liberados para esta conta.",
    success: "PIX confirmado. O acesso foi liberado.",
    status: "ACTIVE",
  },
  cancel: {
    label: "Cancelar plano",
    confirmation: "Cancelar este plano? Os créditos já concedidos permanecem no histórico.",
    success: "Plano cancelado.",
    status: "CANCELED",
  },
} as const;

export function ManualPlanStatusButton({ customerId, planId, action }: ManualPlanStatusButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = actionCopy[action];

  async function submit() {
    if (!window.confirm(copy.confirmation)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/platform/customers/${encodeURIComponent(customerId)}/manual-plans/${encodeURIComponent(planId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ status: copy.status }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? "Não foi possível atualizar o plano.");
      router.replace(`/gestao-interna/clientes/${encodeURIComponent(customerId)}?notice=${action === "confirm-pix" ? "pix_confirmed" : "plan_canceled"}`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o plano.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="platform-status-action">
      <button
        type="button"
        className={action === "confirm-pix" ? "platform-confirm-pix-button" : "platform-cancel-plan-button"}
        onClick={() => void submit()}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Salvando..." : copy.label}
      </button>
      {error ? <p className="platform-inline-error" role="alert">{error}</p> : null}
    </div>
  );
}
