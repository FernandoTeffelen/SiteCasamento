import type { PrismaClient } from "@/generated/prisma/client";
import {
  creditPackageDefinitions,
  creditVolumeTierDefinitions,
  subscriptionPeriodDefinitions,
  subscriptionPlanDefinitions,
} from "@/server/billing/commercial-catalog.definition";

type CommercialCatalogClient = Pick<PrismaClient, "creditPackage" | "creditVolumeTier" | "subscriptionPlan">;

/** Sincroniza apenas o catálogo comercial. Não cria contas ou dados de demo. */
export async function syncCommercialCatalog(client: CommercialCatalogClient) {
  await Promise.all(subscriptionPlanDefinitions.flatMap((tier) => (
    subscriptionPeriodDefinitions.map((period) => client.subscriptionPlan.upsert({
      where: { tier_period: { tier: tier.tier, period: period.period } },
      create: {
        slug: `${tier.tier.toLowerCase()}-${period.slug}`,
        name: `${tier.name} ${period.slug}`,
        tier: tier.tier,
        period: period.period,
        creditsPerMonth: tier.creditsPerMonth,
        creditsPerCycle: tier.creditsPerMonth * period.cycleMonths,
        cycleMonths: period.cycleMonths,
        priceCents: tier.pricesByPeriod[period.period],
        currency: "BRL",
      },
      update: {
        name: `${tier.name} ${period.slug}`,
        creditsPerMonth: tier.creditsPerMonth,
        creditsPerCycle: tier.creditsPerMonth * period.cycleMonths,
        cycleMonths: period.cycleMonths,
        priceCents: tier.pricesByPeriod[period.period],
        currency: "BRL",
        active: true,
      },
    }))
  )));

  await Promise.all(creditPackageDefinitions.map((creditPackage) => client.creditPackage.upsert({
    where: { slug: creditPackage.slug },
    create: { ...creditPackage, currency: "BRL" },
    update: { ...creditPackage, currency: "BRL", active: true },
  })));

  await Promise.all(creditVolumeTierDefinitions.map((tier) => client.creditVolumeTier.upsert({
    where: { slug: tier.slug },
    create: { ...tier, currency: "BRL" },
    update: { ...tier, currency: "BRL", active: true },
  })));

  await client.creditPackage.updateMany({
    // Pacote legado do seed anterior; preserva eventuais pacotes personalizados.
    where: { slug: "6-creditos" },
    data: { active: false },
  });
}
