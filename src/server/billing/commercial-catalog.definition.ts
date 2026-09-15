import { SubscriptionPeriod, SubscriptionTier } from "@/generated/prisma/client";

export const subscriptionPeriodDefinitions = [
  { period: SubscriptionPeriod.MONTHLY, slug: "mensal", cycleMonths: 1, title: "1 mês", caption: "Flexível" },
  { period: SubscriptionPeriod.QUARTERLY, slug: "trimestral", cycleMonths: 3, title: "3 meses", caption: "Ciclo trimestral" },
  { period: SubscriptionPeriod.SEMIANNUAL, slug: "semestral", cycleMonths: 6, title: "6 meses", caption: "Mais estabilidade" },
  { period: SubscriptionPeriod.ANNUAL, slug: "anual", cycleMonths: 12, title: "12 meses", caption: "Ciclo anual" },
] as const;

// priceCents é o preço total do ciclo, em centavos. Os valores comerciais
// fornecidos por mês são multiplicados pela duração do ciclo.
export const subscriptionPlanDefinitions = [
  {
    tier: SubscriptionTier.STARTER,
    name: "Starter",
    badge: "Para começar",
    description: "Para profissionais começando a oferecer a experiência.",
    features: ["QR Codes individuais", "Ranking em tempo real"],
    creditsPerMonth: 3,
    pricesByPeriod: {
      [SubscriptionPeriod.MONTHLY]: 39_900,
      [SubscriptionPeriod.QUARTERLY]: 105_000,
      [SubscriptionPeriod.SEMIANNUAL]: 180_000,
      [SubscriptionPeriod.ANNUAL]: 300_000,
    },
  },
  {
    tier: SubscriptionTier.PRO,
    name: "Pro",
    badge: "Mais escolhido",
    description: "Para cerimonialistas com uma agenda ativa de casamentos.",
    features: ["Templates personalizáveis", "Download do álbum completo"],
    creditsPerMonth: 6,
    pricesByPeriod: {
      [SubscriptionPeriod.MONTHLY]: 75_000,
      [SubscriptionPeriod.QUARTERLY]: 195_000,
      [SubscriptionPeriod.SEMIANNUAL]: 330_000,
      [SubscriptionPeriod.ANNUAL]: 540_000,
    },
  },
  {
    tier: SubscriptionTier.AGENCY,
    name: "Agency",
    badge: "Grande volume",
    description: "Para assessorias completas e produtoras de eventos.",
    features: ["Estatísticas avançadas", "Suporte VIP dedicado"],
    creditsPerMonth: 10,
    pricesByPeriod: {
      [SubscriptionPeriod.MONTHLY]: 110_000,
      [SubscriptionPeriod.QUARTERLY]: 285_000,
      [SubscriptionPeriod.SEMIANNUAL]: 480_000,
      [SubscriptionPeriod.ANNUAL]: 780_000,
    },
  },
] as const;

export const creditPackageDefinitions = [
  { slug: "1-credito", name: "1 crédito", description: "R$ 150 por crédito", credits: 1, priceCents: 15_000 },
  { slug: "3-creditos", name: "3 créditos", description: "R$ 140 por crédito", credits: 3, priceCents: 42_000 },
  { slug: "5-creditos", name: "5 créditos", description: "R$ 130 por crédito", credits: 5, priceCents: 65_000 },
  { slug: "10-creditos", name: "10 créditos", description: "R$ 120 por crédito", credits: 10, priceCents: 120_000 },
] as const;

export const creditVolumeTierDefinitions = [
  { slug: "11-a-15-creditos", minCredits: 11, maxCredits: 15, unitPriceCents: 11_000 },
  { slug: "16-a-20-creditos", minCredits: 16, maxCredits: 20, unitPriceCents: 10_000 },
  { slug: "21-a-30-creditos", minCredits: 21, maxCredits: 30, unitPriceCents: 9_000 },
] as const;
