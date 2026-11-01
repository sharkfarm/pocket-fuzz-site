const DEAL_FIELDS = [
  "facility_fee_per_ticket", "package_expenses", "deal_base_percent",
  "deal_tier_1_threshold", "deal_tier_1_percent",
  "deal_tier_2_threshold", "deal_tier_2_percent",
] as const;

export function parseShowDealTerms(formData: FormData) {
  const terms = {} as Record<(typeof DEAL_FIELDS)[number], number>;
  for (const key of DEAL_FIELDS) {
    const raw = formData.get(key);
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("Complete every deal term before saving.");
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Deal terms must be valid nonnegative numbers.");
    }
    if (key.endsWith("_threshold") && !Number.isInteger(value)) {
      throw new Error("Ticket thresholds must be whole numbers.");
    }
    if (key.endsWith("_percent") && value > 100) {
      throw new Error("Deal percentages cannot exceed 100.");
    }
    terms[key] = value;
  }
  if (terms.deal_tier_2_threshold < terms.deal_tier_1_threshold) {
    throw new Error("Tier 2 must be at or above Tier 1.");
  }
  return terms;
}
