"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CommercialCatalog, CommercialSubscriptionTier } from "@/lib/billing/commercial-catalog";
import { currentLegalVersions } from "@/lib/legal/legal-versions";

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(priceCents / 100);
}

type CheckoutSelection =
  | { kind: "subscription"; planId: string; title: string; subtitle: string; credits: number; priceCents: number; currency: string }
  | { kind: "credit-package"; packageId: string; title: string; subtitle: string; credits: number; priceCents: number; currency: string }
  | { kind: "credit-volume"; quantity: number; title: string; subtitle: string; credits: number; priceCents: number; currency: string };

function secureRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function PlansConfigurator({
  catalog,
  canRecordCommercialAcceptance,
  paymentConfigured,
}: {
  catalog: CommercialCatalog;
  canRecordCommercialAcceptance: boolean;
  paymentConfigured: boolean;
}) {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<CommercialSubscriptionTier | null>(null);
  const [checkoutSelection, setCheckoutSelection] = useState<CheckoutSelection | null>(null);
  const [step, setStep] = useState<"configure" | "payment">("configure");
  const [acceptedCommercialTerms, setAcceptedCommercialTerms] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const checkoutRequestIdRef = useRef<string | null>(null);
  const minimumCustomCredits = catalog.creditVolumeTiers[0]?.minCredits ?? 11;
  const maximumCustomCredits = catalog.creditVolumeTiers.at(-1)?.maxCredits ?? 30;
  const [customCreditQuantity, setCustomCreditQuantity] = useState(minimumCustomCredits);

  const selectedPlan = selectedTier === null ? undefined : catalog.subscriptionPlans.find((plan) => plan.tier === selectedTier);
  const selectedDurationOption = selectedDuration === null ? undefined : catalog.periods.find((duration) => duration.months === selectedDuration);
  const selectedPrice = selectedPlan && selectedDuration
    ? selectedPlan.prices.find((price) => price.cycleMonths === selectedDuration)
    : undefined;
  const selectedVolumeTier = catalog.creditVolumeTiers.find((tier) => customCreditQuantity >= tier.minCredits && customCreditQuantity <= tier.maxCredits);
  const customCreditTotalCents = selectedVolumeTier ? customCreditQuantity * selectedVolumeTier.unitPriceCents : null;

  function updateCustomCreditQuantity(quantity: number) {
    if (!Number.isFinite(quantity)) return;
    setCustomCreditQuantity(Math.min(maximumCustomCredits, Math.max(minimumCustomCredits, Math.trunc(quantity))));
  }

  function chooseForCheckout(selection: CheckoutSelection) {
    checkoutRequestIdRef.current = null;
    setCheckoutSelection(selection);
    setAcceptedCommercialTerms(false);
    setCheckoutError("");
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continuePlanToPayment() {
    if (!selectedDurationOption || !selectedPlan || !selectedPrice) return;
    chooseForCheckout({
      kind: "subscription",
      planId: selectedPrice.planId,
      title: selectedPlan.name,
      subtitle: `${selectedDurationOption.title} · ${selectedPlan.creditsPerMonth} créditos/mês`,
      credits: selectedPrice.creditsPerCycle,
      priceCents: selectedPrice.totalPriceCents,
      currency: selectedPrice.currency,
    });
  }

  async function startCheckout() {
    if (!checkoutSelection || !acceptedCommercialTerms || isStartingCheckout || !paymentConfigured) return;
    setIsStartingCheckout(true);
    setCheckoutError("");
    checkoutRequestIdRef.current ??= secureRequestId();
    const selection = checkoutSelection.kind === "subscription"
      ? { kind: checkoutSelection.kind, planId: checkoutSelection.planId }
      : checkoutSelection.kind === "credit-package"
        ? { kind: checkoutSelection.kind, packageId: checkoutSelection.packageId }
        : { kind: checkoutSelection.kind, quantity: checkoutSelection.quantity };
    try {
      const response = await fetch(checkoutSelection.kind === "subscription" ? "/api/payments/subscription" : "/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(checkoutSelection.kind === "subscription" ? { planId: checkoutSelection.planId } : { selection }),
          checkoutRequestId: checkoutRequestIdRef.current,
          commercialTermsVersion: currentLegalVersions.commercialTerms,
          acceptedCommercialTerms,
          clientAcceptedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json() as { checkoutUrl?: string; error?: { message?: string } };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error?.message ?? "Não foi possível abrir o checkout.");
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Não foi possível abrir o checkout.");
      setIsStartingCheckout(false);
    }
  }

  if (catalog.periods.length === 0 || catalog.subscriptionPlans.length === 0) {
    return <section className="payment-unavailable-card"><span className="section-tag">PLANOS</span><h2>Catálogo temporariamente indisponível</h2><p>Os planos estão sendo atualizados. Tente novamente em alguns instantes.</p></section>;
  }

  if (step === "payment" && checkoutSelection) {
    // data-mp-subscriptions-page="without-plan-pending"
    return (
      <section className="plan-payment-step" aria-labelledby="payment-step-title" {...(checkoutSelection.kind === "subscription" ? { "data-mp-subscriptions-page": "without-plan-pending" } : {})}>
        <div className="plan-stepper" aria-label="Etapas da compra">
          <span className="plan-step completed"><b>1</b> Escolha</span>
          <span className="plan-step completed"><b>2</b> Resumo</span>
          <span className="plan-step current"><b>3</b> Pagamento</span>
        </div>
        <div className="payment-unavailable-card">
          <span className="payment-unavailable-icon" aria-hidden="true">🔒</span>
          <span className="section-tag">CHECKOUT HOSPEDADO</span>
          <h2 id="payment-step-title">Revise antes de continuar</h2>
          <p>Você será redirecionado ao ambiente seguro do Mercado Pago para escolher cartão ou PIX. Este site não recebe dados do seu cartão.</p>
          <div className="selection-summary" aria-label="Resumo da compra">
            <div><span>Produto</span><strong>{checkoutSelection.title}</strong><small>{checkoutSelection.subtitle}</small></div>
            <div><span>Créditos</span><strong>{checkoutSelection.credits} créditos</strong></div>
            <div><span>Valor total</span><strong>{formatPrice(checkoutSelection.priceCents, checkoutSelection.currency)}</strong></div>
            <div><span>Renovação</span><strong>Não automática nesta versão</strong><small>O período contratado é pago integralmente.</small></div>
          </div>
          <div className="commercial-acceptance">
            {canRecordCommercialAcceptance ? (
              <label className="legal-checkbox">
                <input type="checkbox" checked={acceptedCommercialTerms} disabled={isStartingCheckout} onChange={(event) => setAcceptedCommercialTerms(event.target.checked)} />
                <span>Li e concordo com o <Link href="/termo-comercial" target="_blank">Termo Comercial</Link> (versão {currentLegalVersions.commercialTerms}) para a oferta resumida acima.</span>
              </label>
            ) : <p>Para comprar, <Link href="/app/login">entre na sua conta</Link>. O produto só será liberado após confirmação do Mercado Pago.</p>}
            {checkoutError ? <p className="legal-inline-error" role="alert">{checkoutError}</p> : null}
          </div>
          <div className="payment-actions">
            {canRecordCommercialAcceptance ? (
              checkoutSelection.kind === "subscription" ? (
                <button type="button" id="mercado-pago-subscription-cta" className="btn-plan-continue" data-mp-subscription-cta="without-plan-pending" disabled={!acceptedCommercialTerms || isStartingCheckout || !paymentConfigured} onClick={() => void startCheckout()}>
                  {isStartingCheckout ? "Abrindo checkout…" : paymentConfigured ? "Assinar com Mercado Pago →" : "Checkout aguardando configuração"}
                </button>
              ) : (
                <button type="button" id="mercado-pago-checkout-cta" className="btn-plan-continue" data-mp-checkout-cta="checkout-pro" disabled={!acceptedCommercialTerms || isStartingCheckout || !paymentConfigured} onClick={() => void startCheckout()}>
                  {isStartingCheckout ? "Abrindo checkout…" : paymentConfigured ? "Pagar com Mercado Pago →" : "Checkout aguardando configuração"}
                </button>
              ))
            : <Link className="btn-plan-continue" href="/app/login">Entrar para continuar →</Link>}
            <button type="button" className="btn-plan-back" disabled={isStartingCheckout} onClick={() => setStep("configure")}>← Alterar minha escolha</button>
          </div>
          <p className="payment-safe-note">{paymentConfigured ? "Cartão e PIX são processados pelo Mercado Pago. O retorno do navegador, sozinho, não libera plano nem créditos." : "As credenciais de teste e a URL pública do webhook ainda precisam ser configuradas pelo proprietário."}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="plan-stepper" aria-label="Etapas da escolha do plano">
        <span className="plan-step current"><b>1</b> Período</span>
        <span className={`plan-step ${selectedDuration ? "current" : ""}`}><b>2</b> Créditos</span>
        <span className="plan-step"><b>3</b> Pagamento</span>
      </div>
      <section className="plan-builder" aria-labelledby="plan-builder-title">
        <div className="plan-builder-intro"><span className="section-tag">ASSINATURA PERSONALIZADA</span><h2 id="plan-builder-title">Monte o plano ideal para o seu evento</h2><p>Escolha primeiro por quanto tempo quer contratar. Depois, defina quantos casamentos pretende realizar por mês.</p></div>
        <div className="plan-builder-section">
          <div className="builder-section-heading"><span className="builder-number">1</span><div><h3>Por quantos meses?</h3><p>Você poderá ajustar essa escolha antes do pagamento.</p></div></div>
          <div className="duration-options" role="group" aria-label="Escolha o período da assinatura">
            {catalog.periods.map((option) => <button type="button" key={option.period} className={`duration-option ${selectedDuration === option.months ? "selected" : ""}`} aria-pressed={selectedDuration === option.months} onClick={() => setSelectedDuration(option.months)}><strong>{option.title}</strong><span>{option.caption}</span></button>)}
          </div>
        </div>
        <div className="plan-builder-section credits-builder-section">
          <div className="builder-section-heading"><span className="builder-number">2</span><div><h3>Quantos créditos por mês?</h3><p>1 crédito corresponde a 1 casamento ativo.</p></div></div>
          <div className="credit-plan-options" role="radiogroup" aria-label="Escolha os créditos mensais">
            {catalog.subscriptionPlans.map((plan) => {
              const price = selectedDuration ? plan.prices.find((candidate) => candidate.cycleMonths === selectedDuration) : undefined;
              return (
                <button type="button" key={plan.tier} disabled={!selectedDuration || !price} className={`credit-plan-option ${selectedTier === plan.tier ? "selected" : ""}`} role="radio" aria-checked={selectedTier === plan.tier} onClick={() => setSelectedTier(plan.tier)}>
                  <span className="credit-plan-option-top"><span className="tier-badge">{plan.badge}</span>{selectedTier === plan.tier ? <span className="plan-selected-check">✓</span> : null}</span>
                  <strong className="credit-plan-name">{plan.name}</strong><span className="credit-plan-count">{plan.creditsPerMonth} créditos <small>/ mês</small></span>
                  <span className="credit-plan-price">{price ? <><strong>{formatPrice(price.monthlyPriceCents, price.currency)}</strong><small>/ mês</small></> : "Escolha o período"}</span>
                  {price ? <span className="credit-plan-total">{formatPrice(price.totalPriceCents, price.currency)} no período{price.discountPercentage > 0 ? ` · ${price.discountPercentage}% de desconto` : ""}</span> : null}
                  <span className="credit-plan-description">{plan.description}</span><span className="credit-plan-features">{[price ? `${price.creditsPerCycle} créditos liberados no ciclo` : `${plan.creditsPerMonth} créditos por mês`, ...plan.features].map((feature) => `✓ ${feature}`).join(" · ")}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="plan-selection-bar">
          <div><span>Sua seleção até agora</span><strong>{selectedPlan && selectedDurationOption && selectedPrice ? `${selectedPlan.name} · ${selectedDurationOption.title} · ${selectedPlan.creditsPerMonth} créditos/mês · ${formatPrice(selectedPrice.totalPriceCents, selectedPrice.currency)} (${formatPrice(selectedPrice.monthlyPriceCents, selectedPrice.currency)}/mês)` : selectedDurationOption ? `${selectedDurationOption.title} · escolha seus créditos mensais` : "Escolha um período para começar"}</strong></div>
          <button type="button" className="btn-plan-continue" disabled={!selectedDuration || !selectedPlan || !selectedPrice} onClick={continuePlanToPayment}>Continuar para pagamento →</button>
        </div>
      </section>
      <section className="credit-packages-section one-off-section" aria-labelledby="one-off-title">
        <div className="one-off-heading"><div><span className="section-tag">SEM MENSALIDADE</span><h2 id="one-off-title">Créditos avulsos</h2><p>Para casamentos pontuais ou demandas sazonais, sem assinatura recorrente.</p></div><span className="one-off-status">Cartão ou PIX</span></div>
        <div className="packages-options">
          {catalog.creditPackages.map((item) => <div className="package-pill" key={item.packageId}><strong>{item.name}</strong><span>{formatPrice(item.priceCents, item.currency)}</span><small>{item.description}</small><button type="button" onClick={() => chooseForCheckout({ kind: "credit-package", packageId: item.packageId, title: item.name, subtitle: "Compra avulsa, sem mensalidade", credits: item.credits, priceCents: item.priceCents, currency: item.currency })}>Comprar</button></div>)}
        </div>
        {catalog.creditVolumeTiers.length > 0 ? (
          <div className="custom-credit-selector">
            <div className="custom-credit-copy"><strong>Escolha uma quantidade maior</strong><span>De {minimumCustomCredits} a {maximumCustomCredits} créditos, com desconto progressivo.</span></div>
            <div className="custom-credit-control" aria-label="Quantidade personalizada de créditos">
              <button type="button" aria-label="Diminuir quantidade de créditos" disabled={customCreditQuantity <= minimumCustomCredits} onClick={() => updateCustomCreditQuantity(customCreditQuantity - 1)}>−</button>
              <label><span>Quantidade</span><input type="number" inputMode="numeric" min={minimumCustomCredits} max={maximumCustomCredits} value={customCreditQuantity} onChange={(event) => updateCustomCreditQuantity(event.currentTarget.valueAsNumber)} /></label>
              <button type="button" aria-label="Aumentar quantidade de créditos" disabled={customCreditQuantity >= maximumCustomCredits} onClick={() => updateCustomCreditQuantity(customCreditQuantity + 1)}>+</button>
            </div>
            {selectedVolumeTier && customCreditTotalCents !== null ? <div className="custom-credit-price"><span>{formatPrice(selectedVolumeTier.unitPriceCents, selectedVolumeTier.currency)} por crédito</span><strong>Total: {formatPrice(customCreditTotalCents, selectedVolumeTier.currency)}</strong></div> : null}
            <div className="custom-credit-tiers" aria-label="Faixas de desconto">{catalog.creditVolumeTiers.map((tier) => <span className={selectedVolumeTier?.tierId === tier.tierId ? "active" : ""} key={tier.tierId}>{tier.minCredits}–{tier.maxCredits}: {formatPrice(tier.unitPriceCents, tier.currency)}/crédito</span>)}</div>
            {selectedVolumeTier && customCreditTotalCents !== null ? <button type="button" className="custom-credit-buy" onClick={() => chooseForCheckout({ kind: "credit-volume", quantity: customCreditQuantity, title: `${customCreditQuantity} créditos avulsos`, subtitle: `${formatPrice(selectedVolumeTier.unitPriceCents, selectedVolumeTier.currency)} por crédito`, credits: customCreditQuantity, priceCents: customCreditTotalCents, currency: selectedVolumeTier.currency })}>Comprar {customCreditQuantity} créditos →</button> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
