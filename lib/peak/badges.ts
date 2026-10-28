// The badges managers can give in Peak. Keys are stored, so never rename one;
// add new badges instead.

export interface BadgeType {
  key: string;
  name: string;
  /** What it recognises, shown to the person giving it. */
  meaning: string;
}

export const BADGES: BadgeType[] = [
  { key: "above_and_beyond", name: "Above and beyond", meaning: "Did more than anyone asked" },
  { key: "kindness", name: "Kindness", meaning: "Made someone's day with real care" },
  { key: "always_there", name: "Always there", meaning: "Reliable, on time, never lets the team down" },
  { key: "team_player", name: "Team player", meaning: "Helped colleagues and covered when it mattered" },
  { key: "night_hero", name: "Night hero", meaning: "Held things together through the night" },
  { key: "safe_hands", name: "Safe hands", meaning: "Spotted a risk and did the right thing" },
  { key: "learning", name: "Learning champion", meaning: "Grew their skills or helped others grow theirs" },
  { key: "family_praise", name: "Praised by a family", meaning: "A resident's family or client said thank you" },
];

export function badgeType(key: string): BadgeType | undefined {
  return BADGES.find((b) => b.key === key);
}

export const OFFER_CATEGORIES = ["training", "wellbeing", "money", "shopping", "other"] as const;
export type OfferCategory = (typeof OFFER_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<OfferCategory, string> = {
  training: "Training",
  wellbeing: "Wellbeing",
  money: "Money",
  shopping: "Shopping",
  other: "Other",
};
