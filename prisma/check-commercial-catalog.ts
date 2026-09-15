import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import {
  creditPackageDefinitions,
  creditVolumeTierDefinitions,
  subscriptionPeriodDefinitions,
  subscriptionPlanDefinitions,
} from "../src/server/billing/commercial-catalog.definition";

function assertCatalogValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Catálogo comercial inválido: ${message}`);
}

async function main() {
  let checkedPlans = 0;
  for (const tier of subscriptionPlanDefinitions) {
    for (const period of subscriptionPeriodDefinitions) {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { tier_period: { tier: tier.tier, period: period.period } },
      });
      assertCatalogValue(plan !== null, `plano ${tier.name} ${period.slug} não encontrado.`);
      assertCatalogValue(plan.active, `plano ${tier.name} ${period.slug} está inativo.`);
      assertCatalogValue(plan.currency === "BRL", `moeda do plano ${tier.name} ${period.slug} não é BRL.`);
      assertCatalogValue(
        plan.priceCents === tier.pricesByPeriod[period.period],
        `preço do plano ${tier.name} ${period.slug} não corresponde à definição em centavos.`,
      );
      assertCatalogValue(
        plan.creditsPerMonth === tier.creditsPerMonth,
        `créditos mensais do plano ${tier.name} ${period.slug} não correspondem à definição.`,
      );
      assertCatalogValue(
        plan.creditsPerCycle === tier.creditsPerMonth * period.cycleMonths,
        `créditos do ciclo do plano ${tier.name} ${period.slug} estão incorretos.`,
      );
      checkedPlans += 1;
    }
  }

  const monthlyPrices = new Map(subscriptionPlanDefinitions.map((tier) => [
    tier.tier,
    tier.pricesByPeriod.MONTHLY,
  ]));
  for (const period of subscriptionPeriodDefinitions) {
    if (period.cycleMonths === 1) continue;
    const discounts = subscriptionPlanDefinitions.map((tier) => {
      const monthlyPriceCents = monthlyPrices.get(tier.tier)!;
      const totalWithoutDiscount = monthlyPriceCents * period.cycleMonths;
      return 1 - tier.pricesByPeriod[period.period] / totalWithoutDiscount;
    });
    assertCatalogValue(
      discounts[0] < discounts[1] && discounts[1] < discounts[2],
      `descontos de ${period.slug} devem seguir Starter < Pro < Agency.`,
    );
  }

  const [starter, pro] = subscriptionPlanDefinitions;
  for (const period of subscriptionPeriodDefinitions.filter((item) => item.cycleMonths > 1)) {
    assertCatalogValue(
      pro.pricesByPeriod[period.period] < starter.pricesByPeriod[period.period] * 2,
      `duas contas Starter custam menos que uma Pro no ciclo ${period.slug}.`,
    );
  }

  let checkedPackages = 0;
  let previousUnitPriceCents: number | null = null;
  const singleCreditPriceCents = creditPackageDefinitions.find((item) => item.credits === 1)?.priceCents;
  assertCatalogValue(singleCreditPriceCents === 15_000, "o crédito unitário deve custar R$ 150,00.");
  for (const definition of creditPackageDefinitions) {
    const creditPackage = await prisma.creditPackage.findUnique({ where: { slug: definition.slug } });
    assertCatalogValue(creditPackage !== null, `pacote ${definition.slug} não encontrado.`);
    assertCatalogValue(creditPackage.active, `pacote ${definition.slug} está inativo.`);
    assertCatalogValue(creditPackage.currency === "BRL", `moeda do pacote ${definition.slug} não é BRL.`);
    assertCatalogValue(
      creditPackage.priceCents === definition.priceCents,
      `preço do pacote ${definition.slug} não corresponde à definição em centavos.`,
    );
    assertCatalogValue(
      creditPackage.credits === definition.credits,
      `quantidade de créditos do pacote ${definition.slug} está incorreta.`,
    );
    const unitPriceCents = definition.priceCents / definition.credits;
    if (previousUnitPriceCents !== null) {
      assertCatalogValue(
        unitPriceCents < previousUnitPriceCents,
        `o pacote ${definition.slug} não oferece desconto progressivo por crédito.`,
      );
    }
    if (definition.credits > 1) {
      assertCatalogValue(
        definition.priceCents < singleCreditPriceCents * definition.credits,
        `o pacote ${definition.slug} custa mais do que comprar créditos unitários.`,
      );
    }
    previousUnitPriceCents = unitPriceCents;
    checkedPackages += 1;
  }

  const legacyPackage = await prisma.creditPackage.findUnique({ where: { slug: "6-creditos" } });
  assertCatalogValue(!legacyPackage?.active, "o pacote legado de 6 créditos continua ativo.");

  let checkedVolumeTiers = 0;
  let expectedMinimum = 11;
  let previousVolumeUnitPriceCents: number | null = null;
  for (const definition of creditVolumeTierDefinitions) {
    const tier = await prisma.creditVolumeTier.findUnique({ where: { slug: definition.slug } });
    assertCatalogValue(tier !== null, `faixa ${definition.slug} não encontrada.`);
    assertCatalogValue(tier.active, `faixa ${definition.slug} está inativa.`);
    assertCatalogValue(tier.currency === "BRL", `moeda da faixa ${definition.slug} não é BRL.`);
    assertCatalogValue(tier.minCredits === expectedMinimum, `faixa ${definition.slug} deixa lacuna ou sobreposição.`);
    assertCatalogValue(tier.maxCredits === definition.maxCredits, `limite máximo da faixa ${definition.slug} está incorreto.`);
    assertCatalogValue(
      tier.unitPriceCents === definition.unitPriceCents,
      `preço unitário da faixa ${definition.slug} não corresponde à definição em centavos.`,
    );
    if (previousVolumeUnitPriceCents !== null) {
      assertCatalogValue(
        tier.unitPriceCents < previousVolumeUnitPriceCents,
        `a faixa ${definition.slug} não reduz o preço unitário.`,
      );
    }
    expectedMinimum = definition.maxCredits + 1;
    previousVolumeUnitPriceCents = definition.unitPriceCents;
    checkedVolumeTiers += 1;
  }
  assertCatalogValue(expectedMinimum === 31, "as faixas personalizadas devem cobrir continuamente de 11 a 30 créditos.");

  console.log(`Catálogo válido: ${checkedPlans} planos, ${checkedPackages} pacotes e ${checkedVolumeTiers} faixas conferidos em centavos.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
