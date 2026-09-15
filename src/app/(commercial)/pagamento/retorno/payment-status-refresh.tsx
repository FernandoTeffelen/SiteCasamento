"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentStatusRefresh() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <button
      type="button"
      className="btn-plan-back"
      disabled={isRefreshing}
      onClick={() => {
        setIsRefreshing(true);
        router.refresh();
        window.setTimeout(() => setIsRefreshing(false), 700);
      }}
    >
      {isRefreshing ? "Atualizando status..." : "Atualizar status"}
    </button>
  );
}
