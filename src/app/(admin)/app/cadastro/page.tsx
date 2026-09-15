"use client";

import Link from "next/link";
import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { currentLegalVersions } from "@/lib/legal/legal-versions";

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [serverError, setServerError] = useState(searchParams.get("error") ?? "");
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; legal?: string }>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    setFieldErrors({});
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get("name") as string).trim();
    const email = (data.get("email") as string).trim();
    const password = data.get("password") as string;
    const confirm = data.get("confirm") as string;
    const customerType = data.get("customerType") as string;
    const acceptedTerms = data.get("acceptedTerms") === "on";
    const acknowledgedPrivacy = data.get("acknowledgedPrivacy") === "on";

    const errors: typeof fieldErrors = {};
    if (name.length < 2) errors.name = "Informe seu nome completo.";
    if (!email) errors.email = "Informe um e-mail válido.";
    if (password.length < 6) errors.password = "A senha deve ter pelo menos 6 caracteres.";
    if (password !== confirm) errors.password = "As senhas não coincidem.";
    if (!acceptedTerms || !acknowledgedPrivacy) errors.legal = "Confirme os dois itens para criar sua conta.";
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            customerType,
            acceptedTerms,
            acknowledgedPrivacy,
            termsVersion: currentLegalVersions.termsOfUse,
            privacyVersion: currentLegalVersions.privacyPolicy,
          }),
        });
        const json = (await res.json()) as { redirectPath?: string; error?: { message?: string } };
        if (!res.ok) {
          setServerError(json.error?.message ?? "Erro ao criar conta.");
          return;
        }
        router.push(json.redirectPath ?? "/planos?notice=new_account");
      } catch {
        setServerError("Erro de conexão. Tente novamente.");
      }
    });
  }

  return (
    <>
      {serverError && <div className="form-error-banner">{serverError}</div>}

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="login-field">
          <label htmlFor="name">Seu Nome Completo</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Ex: Ana Lima" required />
          {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
        </div>

        <div className="login-field">
          <label htmlFor="email">E-mail Profissional</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="seu.email@exemplo.com" required />
          {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
        </div>

        <div className="login-field">
          <label htmlFor="customerType">Você está se cadastrando como</label>
          <select id="customerType" name="customerType" defaultValue="CEREMONIALIST">
            <option value="CEREMONIALIST">Cerimonialista</option>
            <option value="COUPLE">Casal</option>
          </select>
        </div>

        <div className="login-field">
          <label htmlFor="password">Senha de Acesso</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" required />
          {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
        </div>

        <div className="login-field">
          <label htmlFor="confirm">Confirmar Senha</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="Repita a senha" required />
        </div>

        <label className="legal-checkbox">
          <input name="acceptedTerms" type="checkbox" required />
          <span>Li e concordo com os <Link href="/termos-de-uso" target="_blank">Termos de Uso</Link> (versão {currentLegalVersions.termsOfUse}).</span>
        </label>
        <label className="legal-checkbox">
          <input name="acknowledgedPrivacy" type="checkbox" required />
          <span>Declaro que li a <Link href="/privacidade" target="_blank">Política de Privacidade</Link> (versão {currentLegalVersions.privacyPolicy}).</span>
        </label>
        {fieldErrors.legal ? <p className="legal-inline-error" role="alert">{fieldErrors.legal}</p> : null}

        <button type="submit" className="btn-login-submit" disabled={isPending}>
          {isPending ? "Criando conta..." : "Criar Conta e Entrar ➔"}
        </button>
      </form>
    </>
  );
}

export default function AdminRegisterPage() {
  return (
    <div className="admin-login-layout">
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-header">
            <Link href="/" className="login-brand">
              <span className="brand-icon">💍</span>
              <span className="brand-name">SiteCasamento</span>
            </Link>
            <h1>Criar sua conta</h1>
            <p>Cadastre-se como casal ou cerimonialista para criar experiências fotográficas nos seus casamentos.</p>
          </div>

          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>

          <div className="login-card-footer">
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#6d4e52" }}>
              Já tem uma conta?{" "}
              <Link href="/app/login" style={{ color: "#a95954", fontWeight: 750 }}>
                Fazer login
              </Link>
            </p>
            <Link href="/" className="link-back-home">← Voltar para a Página Inicial</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
