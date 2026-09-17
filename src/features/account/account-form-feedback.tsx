"use client";

import { useEffect } from "react";

const loginActions = new Set(["/api/admin/auth/login", "/api/platform/auth/login"]);

function clearPendingState(form: HTMLFormElement) {
  const timeoutId = Number(form.dataset.pendingTimeout);
  if (Number.isFinite(timeoutId)) window.clearTimeout(timeoutId);

  const button = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
  if (button) {
    if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    button.disabled = false;
    delete button.dataset.originalLabel;
  }

  form.querySelector("[data-login-pending-status]")?.remove();
  form.removeAttribute("aria-busy");
  delete form.dataset.submitting;
  delete form.dataset.pendingTimeout;
}

export function AccountFormFeedback() {
  useEffect(() => {
    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !loginActions.has(form.getAttribute("action") ?? "")) return;

      const button = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      if (!button || form.dataset.submitting === "true") return;

      form.dataset.submitting = "true";
      form.setAttribute("aria-busy", "true");
      button.dataset.originalLabel = button.textContent ?? "Entrar";
      button.textContent = "Entrando...";
      button.disabled = true;

      const status = document.createElement("p");
      status.className = "form-pending-status";
      status.dataset.loginPendingStatus = "true";
      status.setAttribute("role", "status");
      status.textContent = "Estamos acessando seu painel.";
      form.append(status);

      const timeoutId = window.setTimeout(() => {
        if (form.dataset.submitting === "true") {
          status.textContent = "Ainda estamos acessando. Não feche esta página.";
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
