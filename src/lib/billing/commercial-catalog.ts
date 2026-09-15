export type CommercialBillingPeriod = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export type CommercialSubscriptionTier = "STARTER" | "PRO" | "AGENCY";

export type CommercialPeriodOption = {
  period: CommercialBillingPeriod;
  months: number;
  title: string;
  caption: string;
};

export type CommercialSubscriptionPrice = {
  planId: string;
  period: CommercialBillingPeriod;
  cycleMonths: number;
  creditsPerCycle: number;
  totalPriceCents: number;
  monthlyPriceCents: number;
  discountPercentage: number;
  currency: string;
};

export type CommercialSubscriptionPlan = {
  tier: CommercialSubscriptionTier;
  name: string;
  badge: string;
  description: string;
  features: readonly string[];
  creditsPerMonth: number;
  prices: CommercialSubscriptionPrice[];
};

export type CommercialCreditPackage = {
  packageId: string;
  slug: string;
  name: string;
  description: string;
  credits: number;
  priceCents: number;
  currency: string;
};

export type CommercialCreditVolumeTier = {
  tierId: string;
  slug: string;
  minCredits: number;
  maxCredits: number;
  unitPriceCents: number;
  currency: string;
};

export type CommercialCatalog = {
  periods: CommercialPeriodOption[];
  subscriptionPlans: CommercialSubscriptionPlan[];
  creditPackages: CommercialCreditPackage[];
  creditVolumeTiers: CommercialCreditVolumeTier[];
};
