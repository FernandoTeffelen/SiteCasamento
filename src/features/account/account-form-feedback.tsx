"use client";

import { useEffect } from "react";

function getPendingCopy(action: string) {
  if (action.endsWith("/login")) return { button: "Entrando...", status: "Estamos acessando seu painel." };
  if (action.endsWith("/logout")) return { button: "Saindo...", status: "Estamos encerrando sua sessão." };
  return { button: "Salvando...", status: "Estamos registrando esta alteração." };
}

function clearPendingState(form: HTMLFormElement) {
  const timeoutId = Number(form.dataset.pendingTimeout);
  if (Number.isFinite(timeoutId)) window.clearTimeout(timeoutId);

  const button = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
  if (button) {
    if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    button.disabled = false;
    delete button.dataset.originalLabel;
    delete button.dataset.formPending;
  }

  form.querySelector("[data-form-pending-status]")?.remove();
  form.removeAttribute("aria-busy");
  delete form.dataset.submitting;
  delete form.dataset.pendingTimeout;
}

export function AccountFormFeedback() {
  useEffect(() => {
    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.getAttribute("action") ?? "";
      if (!action.startsWith("/api/")) return;

      const button = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      if (!button || form.dataset.submitting === "true") return;

      form.dataset.submitting = "true";
      form.setAttribute("aria-busy", "true");
      const copy = getPendingCopy(action);
      button.dataset.originalLabel = button.textContent ?? "Entrar";
      button.dataset.formPending = "true";
      button.textContent = copy.button;
      button.disabled = true;

      const status = document.createElement("p");
      status.className = "form-pending-status";
      status.dataset.formPendingStatus = "true";
      status.setAttribute("role", "status");
      status.textContent = copy.status;
      form.append(status);

      const timeoutId = window.setTimeout(() => {
        if (form.dataset.submitting === "true") {
          status.textContent = "Ainda estamos processando. Não feche esta página.";
        }
      }, 4_000);
      form.dataset.pendingTimeout = String(timeoutId);
    }

    function resetPendingForms() {
      document.querySelectorAll<HTMLFormElement>('form[data-submitting="true"]').forEach(clearPendingState);
    }

    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", resetPendingForms);
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", resetPendingForms);
    };
  }, []);

  return null;
}
