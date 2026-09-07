"use client";

import { useState } from "react";

type DurationOption = {
  months: number;
  title: string;
  caption: string;
};

type PlanOption = {
  id: "starter" | "pro" | "agency";
  name: string;
  badge: string;
  credits: number;
  description: string;
  features: string[];
  prices: Record<number, { total: number; monthly: number }>;
};

const durationOptions: DurationOption[] = [
  { months: 1, title: "1 mês", caption: "Flexível" },
  { months: 3, title: "3 meses", caption: "Ciclo trimestral" },
  { months: 6, title: "6 meses", caption: "Mais estabilidade" },
  { months: 12, title: "12 meses", caption: "Ciclo anual" },
];

const planOptions: PlanOption[] = [
  {
    id: "starter",
    name: "Starter",
    badge: "Para começar",
    credits: 3,
    description: "Para profissionais começando a oferecer a experiência.",
    features: ["Até 3 casamentos por mês", "QR Codes individuais", "Ranking em tempo real"],
    prices: {
      1: { total: 599, monthly: 599 },
      3: { total: 1647, monthly: 549 },
      6: { total: 2994, monthly: 499 },
      12: { total: 5388, monthly: 449 },
    },
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Mais escolhido",
    credits: 6,
    description: "Para cerimonialistas com uma agenda ativa de casamentos.",
    features: ["Até 6 casamentos por mês", "Templates personalizáveis", "Download do álbum completo"],
    prices: {
      1: { total: 1099, monthly: 1099 },
      3: { total: 2997, monthly: 999 },
      6: { total: 5394, monthly: 899 },
      12: { total: 9588, monthly: 799 },
    },
  },
  {
    id: "agency",
    name: "Agency",
    badge: "Grande volume",
    credits: 10,
    description: "Para assessorias completas e produtoras de eventos.",
    features: ["10 casamentos ou mais", "Estatísticas avançadas", "Suporte VIP dedicado"],
    prices: {
      1: { total: 1699, monthly: 1699 },
      3: { total: 4647, monthly: 1549 },
      6: { total: 8394, monthly: 1399 },
      12: { total: 14988, monthly: 1249 },
    },
  },
];

const oneOffPackages = [
  { title: "1 crédito", price: 250, caption: "Uso único" },
  { title: "3 créditos", price: 690, caption: "Para poucos eventos" },
  { title: "5 créditos", price: 1090, caption: "Desconto moderado" },
  { title: "10 créditos", price: 1990, caption: "Melhor custo por evento" },
];

function formatPeriod(months: number) {
  return months === 1 ? "1 mês" : `${months} meses`;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PlansConfigurator() {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<number | null>(null);
  const [step, setStep] = useState<"configure" | "payment">("configure");

  const selectedPlan = selectedCredits === null
    ? undefined
    : planOptions.find((plan) => plan.credits === selectedCredits);
  const selectedDurationOption = selectedDuration === null
    ? undefined
    : durationOptions.find((duration) => duration.months === selectedDuration);
  const selectedPrice = selectedPlan && selectedDuration
    ? selectedPlan.prices[selectedDuration]
    : undefined;

  function continueToPayment() {
    if (!selectedDuration || !selectedPlan) return;
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (step === "payment") {
    return (
      <section className="plan-payment-step" aria-labelledby="payment-step-title">
        <div className="plan-stepper" aria-label="Etapas da escolha do plano">
          <span className="plan-step completed"><b>1</b> Período</span>
          <span className="plan-step completed"><b>2</b> Créditos</span>
          <span className="plan-step current"><b>3</b> Pagamento</span>
        </div>

        <div className="payment-unavailable-card">
          <span className="payment-unavailable-icon" aria-hidden="true">⌛</span>
          <span className="section-tag">PAGAMENTO</span>
          <h2 id="payment-step-title">Sua escolha está pronta</h2>
          <p>O pagamento online ainda não está disponível. Deixamos tudo preparado para continuar assim que essa etapa for liberada.</p>

          <div className="selection-summary" aria-label="Resumo do plano escolhido">
            <div>
              <span>Plano escolhido</span>
              <strong>{selectedPlan?.name ?? "—"}</strong>
            </div>
            <div>
              <span>Período</span>
              <strong>{selectedDurationOption?.title ?? "—"}</strong>
            </div>
            <div>
              <span>Créditos por mês</span>
              <strong>{selectedPlan ? `${selectedPlan.credits} créditos` : "—"}</strong>
            </div>
            <div>
              <span>Valor do período</span>
              <strong>{selectedPrice ? formatPrice(selectedPrice.total) : "—"}</strong>
              {selectedPrice ? <small>{formatPrice(selectedPrice.monthly)}/mês</small> : null}
            </div>
          </div>

          <div className="payment-actions">
            <button type="button" className="btn-plan-payment-disabled" disabled>
              Pagamento indisponível no momento
            </button>
            <button type="button" className="btn-plan-back" onClick={() => setStep("configure")}>
              ← Alterar minha escolha
            </button>
          </div>
          <p className="payment-safe-note">Nenhuma cobrança será feita agora.</p>
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
        <div className="plan-builder-intro">
          <span className="section-tag">ASSINATURA PERSONALIZADA</span>
          <h2 id="plan-builder-title">Monte o plano ideal para o seu evento</h2>
          <p>Escolha primeiro por quanto tempo quer assinar. Depois, defina quantos casamentos pretende realizar por mês.</p>
        </div>

        <div className="plan-builder-section">
          <div className="builder-section-heading">
            <span className="builder-number">1</span>
            <div>
              <h3>Por quantos meses?</h3>
              <p>Você poderá ajustar essa escolha antes do pagamento.</p>
            </div>
          </div>
          <div className="duration-options" role="group" aria-label="Escolha o período da assinatura">
            {durationOptions.map((option) => (
              <button
                type="button"
                key={option.months}
                className={`duration-option ${selectedDuration === option.months ? "selected" : ""}`}
                aria-pressed={selectedDuration === option.months}
                onClick={() => setSelectedDuration(option.months)}
              >
                <strong>{option.title}</strong>
                <span>{option.caption}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="plan-builder-section credits-builder-section">
          <div className="builder-section-heading">
            <span className="builder-number">2</span>
            <div>
              <h3>Quantos créditos por mês?</h3>
              <p>1 crédito corresponde a 1 casamento ativo.</p>
            </div>
          </div>
          <div className="credit-plan-options" role="radiogroup" aria-label="Escolha os créditos mensais">
            {planOptions.map((plan) => {
              const price = selectedDuration ? plan.prices[selectedDuration] : undefined;
              return (
              <button
                type="button"
                key={plan.id}
                disabled={!selectedDuration}
                className={`credit-plan-option ${selectedCredits === plan.credits ? "selected" : ""}`}
                role="radio"
                aria-checked={selectedCredits === plan.credits}
                onClick={() => setSelectedCredits(plan.credits)}
              >
                <span className="credit-plan-option-top">
                  <span className="tier-badge">{plan.badge}</span>
                  {selectedCredits === plan.credits ? <span className="plan-selected-check">✓</span> : null}
                </span>
                <strong className="credit-plan-name">{plan.name}</strong>
                <span className="credit-plan-count">{plan.credits} créditos <small>/ mês</small></span>
                <span className="credit-plan-price">
                  {price ? <><strong>{formatPrice(price.monthly)}</strong><small>/ mês</small></> : "Escolha o período"}
                </span>
                {price ? <span className="credit-plan-total">{formatPrice(price.total)} no período</span> : null}
                <span className="credit-plan-description">{plan.description}</span>
                <span className="credit-plan-features">{plan.features.map((feature) => `✓ ${feature}`).join(" · ")}</span>
              </button>
              );
            })}
          </div>
        </div>

        <div className="plan-selection-bar">
          <div>
            <span>Sua seleção até agora</span>
            <strong>
              {selectedPlan && selectedDurationOption
                ? `${selectedPlan.name} · ${formatPeriod(selectedDurationOption.months)} · ${selectedPlan.credits} créditos/mês · ${formatPrice(selectedPrice!.total)} (${formatPrice(selectedPrice!.monthly)}/mês)`
                : selectedDurationOption
                  ? `${formatPeriod(selectedDurationOption.months)} · escolha seus créditos mensais`
                  : "Escolha um período para começar"}
            </strong>
          </div>
          <button type="button" className="btn-plan-continue" disabled={!selectedDuration || !selectedPlan} onClick={continueToPayment}>
            Continuar para pagamento →
          </button>
        </div>
      </section>

      <section className="credit-packages-section one-off-section" aria-labelledby="one-off-title">
        <div className="one-off-heading">
          <div>
            <span className="section-tag">SEM MENSALIDADE</span>
            <h2 id="one-off-title">Créditos avulsos</h2>
            <p>Para casamentos pontuais ou demandas sazonais, sem assinatura recorrente.</p>
          </div>
          <span className="one-off-status">Em breve</span>
        </div>
        <div className="packages-options">
          {oneOffPackages.map((item) => (
            <div className="package-pill" key={item.title}>
              <strong>{item.title}</strong>
              <span>{formatPrice(item.price)}</span>
              <small>{item.caption} · Pagamento em breve</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
