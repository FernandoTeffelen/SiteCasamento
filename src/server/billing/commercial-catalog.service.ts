import "server-only";

import { SubscriptionPeriod } from "@/generated/prisma/client";
import type {
  CommercialBillingPeriod,
  CommercialCatalog,
  CommercialSubscriptionTier,
} from "@/lib/billing/commercial-catalog";
import {
  subscriptionPeriodDefinitions,
  subscriptionPlanDefinitions,
} from "@/server/billing/commercial-catalog.definition";
import { prisma } from "@/server/db/prisma";

function calculateDiscountPercentage(monthlyPriceCents: number | undefined, totalPriceCents: number, months: number) {
  if (!monthlyPriceCents || months <= 1) return 0;
  const fullPriceCents = monthlyPriceCents * months;
  return Math.max(0, Math.round((1 - totalPriceCents / fullPriceCents) * 100));
}

/**
 * Retorna somente itens ativos e com preço definido. O PostgreSQL é a fonte
 * de verdade do catálogo exibido; o cliente nunca mantém uma cópia dos preços.
 */
export async function getPublicCommercialCatalog(): Promise<CommercialCatalog> {
  const [subscriptionRows, packageRows, volumeTierRows] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { active: true, priceCents: { not: null } },
      select: {
        id: true,
        tier: true,
        period: true,
        creditsPerMonth: true,
        creditsPerCycle: true,
        cycleMonths: true,
        priceCents: true,
        currency: true,
      },
    }),
    prisma.creditPackage.findMany({
      where: { active: true, priceCents: { not: null } },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        credits: true,
        priceCents: true,
        currency: true,
      },
      orderBy: { credits: "asc" },
    }),
    prisma.creditVolumeTier.findMany({
      where: { active: true },
      select: {
        id: true,
        slug: true,
        minCredits: true,
        maxCredits: true,
        unitPriceCents: true,
        currency: true,
      },
      orderBy: { minCredits: "asc" },
    }),
  ]);

  const periods = subscriptionPeriodDefinitions
    .filter((definition) => subscriptionRows.some((plan) => plan.period === definition.period))
    .map((definition) => {
      return {
        period: definition.period as CommercialBillingPeriod,
        months: definition.cycleMonths,
        title: definition.title,
        caption: definition.caption,
      };
    });

  const subscriptionPlans = subscriptionPlanDefinitions.flatMap((definition) => {
    const rows = subscriptionRows.filter((plan) => plan.tier === definition.tier);
    if (rows.length === 0) return [];

    const creditsPerMonth = rows[0].creditsPerMonth;
    const monthlyPlan = rows.find((plan) => plan.period === SubscriptionPeriod.MONTHLY);
    const monthlyPriceCents = monthlyPlan?.priceCents ?? undefined;

    if (rows.some((plan) => plan.creditsPerMonth !== creditsPerMonth)) {
      throw new Error(`Catálogo inconsistente: os créditos mensais do plano ${definition.tier} não coincidem.`);
    }

    const prices = subscriptionPeriodDefinitions.flatMap((periodDefinition) => {
      const plan = rows.find((candidate) => candidate.period === periodDefinition.period);
      if (!plan || plan.priceCents === null) return [];

      return [{
        planId: plan.id,
        period: plan.period as CommercialBillingPeriod,
        cycleMonths: plan.cycleMonths,
        creditsPerCycle: plan.creditsPerCycle,
        totalPriceCents: plan.priceCents,
        monthlyPriceCents: Math.round(plan.priceCents / plan.cycleMonths),
        discountPercentage: calculateDiscountPercentage(monthlyPriceCents, plan.priceCents, plan.cycleMonths),
        currency: plan.currency,
      }];
    });

    return [{
      tier: definition.tier as CommercialSubscriptionTier,
      name: definition.name,
      badge: definition.badge,
      description: definition.description,
      features: definition.features,
      creditsPerMonth,
      prices,
    }];
  });

  const creditPackages = packageRows.flatMap((item) => item.priceCents === null ? [] : [{
    packageId: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description ?? "Uso único, sem mensalidade.",
    credits: item.credits,
    priceCents: item.priceCents,
    currency: item.currency,
  }]);

  const creditVolumeTiers = volumeTierRows.map((tier) => ({
    tierId: tier.id,
    slug: tier.slug,
    minCredits: tier.minCredits,
    maxCredits: tier.maxCredits,
    unitPriceCents: tier.unitPriceCents,
    currency: tier.currency,
  }));

  return { periods, subscriptionPlans, creditPackages, creditVolumeTiers };
}
