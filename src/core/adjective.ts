/** Building Creatures columns, highest first within a table; this order breaks derivation ties upwards. */
export const ADJECTIVES = [
    "extreme",
    "high",
    "moderate",
    "low",
    "terrible",
    // Area Damage's columns: limited-use abilities deal more than ones usable at will.
    "limited",
    "unlimited",
    // Resistances and Weaknesses' ends: weaknesses and single-type resistances use the maximum,
    // broad resistances the minimum.
    "maximum",
    "minimum",
] as const;

export type Adjective = (typeof ADJECTIVES)[number];
