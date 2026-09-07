"use client";

import { useMemo, useState } from "react";

type OrganizationOption = { id: string; name: string };
type AccessMode = "CREDIT" | "PLAN" | "MONTHLY";

function calculateEndDate(startDate: string, durationMonths: number) {
  if (!startDate || !Number.isInteger(durationMonths) || durationMonths < 1) return "—";
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return "—";
  const date = new Date(year, month - 1 + durationMonths, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("pt-BR");
}

export function ManualPlanForm({ customerId, organizations }: { customerId: string; organizations: OrganizationOption[] }) {
  const [mode, setMode] = useState<AccessMode>("CREDIT");
  const [durationMonths, setDurationMonths] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const endDate = useMemo(() => calculateEndDate(startDate, durationMonths), [startDate, durationMonths]);
  const options = organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>);

  return (
    <div className="platform-access-controls">
      <div className="platform-access-mode-tabs" role="tablist" aria-label="Tipo de liberação">
        <button type="button" role="tab" aria-selected={mode === "CREDIT"} className={mode === "CREDIT" ? "active" : ""} onClick={() => setMode("CREDIT")}>Crédito avulso</button>
        <button type="button" role="tab" aria-selected={mode === "PLAN"} className={mode === "PLAN" ? "active" : ""} onClick={() => setMode("PLAN")}>Plano mensal</button>
        <button type="button" role="tab" aria-selected={mode === "MONTHLY"} className={mode === "MONTHLY" ? "active" : ""} onClick={() => setMode("MONTHLY")}>Ajustar mensal</button>
      </div>

      {mode === "CREDIT" ? (
        <form className="platform-access-form platform-credit-now-form" action={`/api/platform/customers/${customerId}/credits`} method="post">
          <div className="platform-access-form-copy"><strong>Adicionar créditos agora</strong><span>Use esta opção para liberar, por exemplo, somente 1 crédito imediatamente.</span></div>
          <label>Organização<select name="organizationId" required>{options}</select></label>
          <label>Quantidade<input name="credits" type="number" min="1" max="1000" defaultValue="1" required /></label>
          <button type="submit">Adicionar crédito</button>
        </form>
      ) : null}

      {mode === "PLAN" ? (
        <form className="platform-access-form platform-plan-form" action={`/api/platform/customers/${customerId}/manual-plans`} method="post">
          <div className="platform-access-form-copy"><strong>Liberar ou estender acesso</strong><span>Se já existir um plano ativo neste período, os meses serão somados ao plano atual.</span></div>
          <label>Organização<select name="organizationId" required>{options}</select></label>
          <label>Meses de acesso<input name="durationMonths" type="number" min="1" max="36" value={durationMonths} onChange={(event) => setDurationMonths(Number(event.target.value))} required /></label>
          <label>Créditos por mês<input name="creditsPerMonth" type="number" min="1" max="1000" defaultValue="1" required /></label>
          <label>Data de início<input name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
          <input type="hidden" name="status" value="ACTIVE" />
          <input type="hidden" name="adjustmentMode" value="EXTEND" />
          <div className="platform-plan-end-date"><span>Término estimado</span><strong>{endDate}</strong></div>
          <button type="submit">Salvar plano</button>
        </form>
      ) : null}

      {mode === "MONTHLY" ? (
        <form className="platform-access-form platform-monthly-adjustment-form" action={`/api/platform/customers/${customerId}/manual-plans`} method="post">
          <div className="platform-access-form-copy"><strong>Aumentar créditos por mês</strong><span>Adiciona créditos ao plano mensal atual e libera essa diferença imediatamente.</span></div>
          <label>Organização<select name="organizationId" required>{options}</select></label>
          <label>Adicionar por mês<input name="creditsPerMonth" type="number" min="1" max="1000" defaultValue="1" required /></label>
          <input type="hidden" name="durationMonths" value="1" />
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="status" value="ACTIVE" />
          <input type="hidden" name="adjustmentMode" value="INCREASE_CREDITS" />
          <button type="submit">Aumentar créditos mensais</button>
        </form>
      ) : null}
    </div>
  );
}
