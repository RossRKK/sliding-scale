/** A value that steps up at fixed creature levels. */
export interface Band {
    readonly fromLevel: number;
    readonly value: number;
}

// Player Core alchemical bombs: lesser, moderate, greater and major tiers at item levels 1, 3, 11 and 17.
export const BOMB_TIER: readonly Band[] = [
    { fromLevel: -1, value: 1 },
    { fromLevel: 3, value: 2 },
    { fromLevel: 11, value: 3 },
    { fromLevel: 17, value: 4 },
];

// Player Core rogue Sneak Attack: 1d6, rising to 2d6 at 5th, 3d6 at 11th and 4d6 at 17th level.
export const SNEAK_ATTACK_DICE: readonly Band[] = [
    { fromLevel: -1, value: 1 },
    { fromLevel: 5, value: 2 },
    { fromLevel: 11, value: 3 },
    { fromLevel: 17, value: 4 },
];

export function progressionAt(bands: readonly Band[], level: number): number | undefined {
    return bands.findLast(({ fromLevel }) => fromLevel <= level)?.value;
}

/** Moves a count by the progression's step between two levels, never below one, so moves reverse. */
export function scaleByProgression(
    bands: readonly Band[],
    count: number,
    fromLevel: number,
    toLevel: number,
): number {
    const from = progressionAt(bands, fromLevel);
    const to = progressionAt(bands, toLevel);
    if (from === undefined || to === undefined) return count;
    return Math.max(1, count + to - from);
}
