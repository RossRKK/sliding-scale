export type Adjustment = "elite" | "weak";

/** HP an elite or weak creature gains or loses, keyed by its base level. */
export function hitPointAdjustment(adjustment: Adjustment | undefined, level: number): number {
    if (adjustment === undefined) return 0;
    const band = HIT_POINT_BANDS[adjustment].find(({ upTo }) => level <= upTo);
    return band?.hitPoints ?? 0;
}

// Monster Core "Elite and Weak Adjustments" HP bands, as pf2e implements them in getHpAdjustment.
const HIT_POINT_BANDS: Record<Adjustment, readonly { upTo: number; hitPoints: number }[]> = {
    elite: [
        { upTo: 1, hitPoints: 10 },
        { upTo: 4, hitPoints: 15 },
        { upTo: 19, hitPoints: 20 },
        { upTo: Infinity, hitPoints: 30 },
    ],
    weak: [
        { upTo: 0, hitPoints: 0 },
        { upTo: 2, hitPoints: -10 },
        { upTo: 5, hitPoints: -15 },
        { upTo: 20, hitPoints: -20 },
        { upTo: Infinity, hitPoints: -30 },
    ],
};
