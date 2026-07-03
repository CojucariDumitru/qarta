/** Loyalty tiers: cashback % grows with lifetime spend. 100 points = $1. */
export const TIERS = [
  { name: 'BRONZE', label: 'Bronze', rate: 0.05, from: 0 },
  { name: 'SILVER', label: 'Silver', rate: 0.07, from: 300 },
  { name: 'GOLD', label: 'Gold', rate: 0.1, from: 1000 },
] as const;

export function tierFor(totalSpent: number) {
  return [...TIERS].reverse().find((t) => totalSpent >= t.from) ?? TIERS[0];
}

/** Points earned for an order total at the guest's current tier. */
export function earnPoints(total: number, totalSpent: number) {
  return Math.round(total * tierFor(totalSpent).rate * 100);
}

/** Max share of the order payable with points. */
export const MAX_REDEEM_SHARE = 0.5;
