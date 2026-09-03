ALTER TABLE "CreditPackage"
  ADD CONSTRAINT "CreditPackage_credits_positive" CHECK ("credits" > 0),
  ADD CONSTRAINT "CreditPackage_price_non_negative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_creditsPerMonth_positive" CHECK ("creditsPerMonth" > 0),
  ADD CONSTRAINT "SubscriptionPlan_creditsPerCycle_positive" CHECK ("creditsPerCycle" > 0),
  ADD CONSTRAINT "SubscriptionPlan_cycleMonths_valid" CHECK ("cycleMonths" IN (1, 3, 6, 12)),
  ADD CONSTRAINT "SubscriptionPlan_credits_match_cycle" CHECK ("creditsPerCycle" = "creditsPerMonth" * "cycleMonths"),
  ADD CONSTRAINT "SubscriptionPlan_price_non_negative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

ALTER TABLE "OrganizationSubscription"
  ADD CONSTRAINT "OrganizationSubscription_creditsPerCycle_positive" CHECK ("creditsPerCycle" > 0),
  ADD CONSTRAINT "OrganizationSubscription_cycleMonths_valid" CHECK ("cycleMonths" IN (1, 3, 6, 12)),
  ADD CONSTRAINT "OrganizationSubscription_period_range_valid" CHECK (
    "currentPeriodStart" IS NULL OR "currentPeriodEnd" IS NULL OR "currentPeriodEnd" > "currentPeriodStart"
  );

ALTER TABLE "OrganizationCreditBalance"
  ADD CONSTRAINT "OrganizationCreditBalance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "OneTimePurchase"
  ADD CONSTRAINT "OneTimePurchase_credits_positive" CHECK ("credits" > 0),
  ADD CONSTRAINT "OneTimePurchase_price_non_negative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

ALTER TABLE "CreditLedgerEntry"
  ADD CONSTRAINT "CreditLedgerEntry_delta_non_zero" CHECK ("delta" <> 0),
  ADD CONSTRAINT "CreditLedgerEntry_balanceAfter_non_negative" CHECK ("balanceAfter" >= 0);

ALTER TABLE "CommercialAddOn"
  ADD CONSTRAINT "CommercialAddOn_price_non_negative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
