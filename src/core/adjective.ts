/** Building Creatures columns, highest first; this order breaks derivation ties upwards. */
export const ADJECTIVES = ["extreme", "high", "moderate", "low", "terrible"] as const;

export type Adjective = (typeof ADJECTIVES)[number];
